import {
  app,
  clipboard,
  dialog,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import {
  AttemptInput,
  LANGUAGES,
  Settings,
  VocabQuery,
  type ImportReport,
  type Mistake,
} from '../shared/api';
import { missingLanguages } from '../shared/localize';
import { checkAddedTranslations } from '../shared/translation-check';
import { validateTestFile } from '../shared/validate-test-file';
import {
  briefPrompt,
  buildBrief,
  missingNewWords,
  missingWordsPrompt,
  translatePrompt,
} from './brief';
import {
  buildSession,
  deleteTest,
  dismissMistake,
  getLibrary,
  getMistakes,
  getSettings,
  getSummary,
  getTest,
  getToday,
  recordAttempt,
  saveSettings,
  saveTest,
} from './database';
import { extractJson, findClaude, runClaude } from './generate';
import { ensureInboxDirs, importInbox, type InboxDirs } from './inbox';
import {
  otherWords,
  withReadings,
  searchVocab,
  vocabSummary,
  wordStatuses,
} from './vocab';
import { localDay } from './scheduler';
import { backupDatabase, readBackup, restoreDatabase } from './backup';
import { readSkinPicture, saveSkinPicture } from './skin-picture';
import type { SyncManager } from './sync/manager';
import type { Updater } from './updater';

type Context = {
  db: DatabaseSync;
  dirs: InboxDirs;
  workDir: string;
  dataDir: string;
  sync: SyncManager;
  updater: Updater;
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean;
};

const TestId = z.string().min(1).max(200);
const MAX_PICTURE_BYTES = 15 * 1024 * 1024;

export function registerIpcHandlers({
  db,
  dirs,
  workDir,
  dataDir,
  sync,
  updater,
  isTrustedSender,
}: Context): void {
  function handle(
    channel: string,
    listener: (event: IpcMainInvokeEvent, payload: unknown) => unknown,
  ) {
    ipcMain.handle(channel, (event, payload: unknown) => {
      if (!isTrustedSender(event)) {
        throw new Error('Untrusted sender');
      }
      return listener(event, payload);
    });
  }

  let unseen: ImportReport = { imported: [], rejected: [] };
  let claudeBusy = false;

  function importAndRemember(): ImportReport {
    const report = importInbox(db, dirs);
    if (report.imported.length > 0) sync.schedule();
    unseen = {
      imported: [...unseen.imported, ...report.imported],
      rejected: [...unseen.rejected, ...report.rejected],
    };
    return unseen;
  }

  async function askClaude(prompt: string): Promise<string> {
    if (claudeBusy) throw new Error('Claude is already working on something.');
    const claude = findClaude();
    if (!claude) throw new Error('The Claude CLI was not found.');

    claudeBusy = true;
    try {
      fs.mkdirSync(workDir, { recursive: true });
      return extractJson(await runClaude(claude, prompt, workDir));
    } finally {
      claudeBusy = false;
    }
  }

  handle('attempt:save', (_event, payload) => {
    recordAttempt(db, AttemptInput.parse(payload));
    sync.schedule();
  });
  handle('summary:get', () => getSummary(db));
  handle('today:get', () => getToday(db));
  handle('session:get', () => buildSession(db));
  handle('mistakes:get', () => withReadings(getMistakes(db)));
  handle('mistakes:dismiss', (_event, payload) => {
    dismissMistake(db, z.number().int().parse(payload));
    sync.schedule();
    return withReadings(getMistakes(db));
  });
  handle('library:get', () => getLibrary(db));
  handle('library:delete', (_event, payload) => {
    deleteTest(db, TestId.parse(payload));
    sync.schedule();
    return getLibrary(db);
  });
  handle('settings:get', () => getSettings(db));
  handle('settings:save', (_event, payload) => {
    const saved = saveSettings(db, Settings.parse(payload));
    sync.schedule();
    return saved;
  });

  handle('sync:status', () => sync.status());
  handle('sync:configure', (_event, payload) => sync.configure(payload));
  handle('sync:signIn', (_event, payload) => sync.signIn(payload));
  handle('sync:signUp', (_event, payload) => sync.signUp(payload));
  handle('sync:signOut', () => sync.signOut());
  handle('sync:now', () => sync.syncNow(true));
  handle('update:state', () => updater.current());
  handle('update:check', () => updater.check());
  handle('update:install', () => updater.install());
  handle('inbox:import', () => importAndRemember());

  handle('inbox:dismiss', () => {
    unseen = { imported: [], rejected: [] };
  });

  handle('inbox:open', async () => {
    ensureInboxDirs(dirs);
    const error = await shell.openPath(dirs.inbox);
    if (error) throw new Error(error);
  });

  handle('data:backup', async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(
        app.getPath('documents'),
        `kotoba-backup-${localDay(new Date())}.db`,
      ),
      filters: [{ name: 'Kotoba backup', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) return null;
    backupDatabase(db, result.filePath);
    return result.filePath;
  });

  // The file picked for restoring waits here until the learner confirms.
  let pendingRestore: string | null = null;

  handle('data:pickRestore', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Kotoba backup', extensions: ['db'] }],
    });
    const file = result.filePaths[0];
    if (result.canceled || !file) return null;
    const info = readBackup(file);
    pendingRestore = file;
    return { name: path.basename(file), ...info };
  });

  handle('data:restore', () => {
    if (!pendingRestore) throw new Error('Choose a backup first.');
    const backups = path.join(dataDir, 'backups');
    fs.mkdirSync(backups, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupDatabase(db, path.join(backups, `before-restore-${stamp}.db`));
    restoreDatabase(db, pendingRestore);
    pendingRestore = null;
  });

  handle('skin:savePicture', (_event, payload) =>
    saveSkinPicture(dataDir, z.string().max(25_000_000).parse(payload)),
  );
  handle('skin:picture', () => readSkinPicture(dataDir));

  handle('data:openFolder', async () => {
    const error = await shell.openPath(dataDir);
    if (error) throw new Error(error);
  });

  handle('brief:copy', () => {
    clipboard.writeText(briefPrompt(buildBrief(db)));
  });

  handle('picture:pick', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: 'Pictures',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'],
        },
      ],
    });
    const file = result.filePaths[0];
    if (result.canceled || !file) return null;
    if (fs.statSync(file).size > MAX_PICTURE_BYTES) {
      throw new Error('That picture is larger than 15 MB.');
    }
    const extension = path.extname(file).slice(1).toLowerCase();
    const type = extension === 'jpg' ? 'jpeg' : extension;
    return `data:image/${type};base64,${fs.readFileSync(file).toString('base64')}`;
  });

  handle('vocab:summary', () => vocabSummary(wordStatuses(db)));
  handle('vocab:others', () => otherWords(db));
  handle('vocab:search', (_event, payload) =>
    searchVocab(VocabQuery.parse(payload), wordStatuses(db)),
  );

  handle('claude:status', () => ({ found: findClaude() !== null }));

  handle('claude:generate', async () => {
    const brief = buildBrief(db);
    let reply = await askClaude(briefPrompt(brief));
    let missing = missingNewWords(brief, reply);
    if (missing.length > 0) {
      // Ask once more for the words left out. Keep the retry only if it
      // covers more of them.
      const retry = await askClaude(missingWordsPrompt(reply, missing));
      const retryMissing = missingNewWords(brief, retry);
      if (retryMissing.length < missing.length) {
        reply = retry;
        missing = retryMissing;
      }
    }
    ensureInboxDirs(dirs);
    const now = new Date();
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const file = path.join(dirs.inbox, `claude-${localDay(now)}-${time}.json`);
    fs.writeFileSync(file, reply, 'utf8');
    return {
      ...importAndRemember(),
      missingWords: missing.map((word) => word.expression),
    };
  });

  handle('library:translate', async (_event, payload) => {
    const stored = getTest(db, TestId.parse(payload));
    if (!stored) throw new Error('That test no longer exists.');

    const languages = missingLanguages(
      stored.test,
      LANGUAGES.map((option) => option.code),
    );
    if (languages.length === 0) return getLibrary(db);

    const reply = await askClaude(translatePrompt(stored.test, languages));

    const result = validateTestFile(reply);
    if (!result.ok) {
      throw new Error(
        `Claude returned a test that doesn't pass the checks, so nothing was changed. ${result.errors.slice(0, 3).join(' · ')}`,
      );
    }
    const problems = checkAddedTranslations(
      stored.test,
      result.test,
      languages,
    );
    if (problems.length > 0) {
      throw new Error(
        `The translation changed more than it should have, so nothing was changed. ${problems.slice(0, 3).join(' · ')}`,
      );
    }
    saveTest(db, result.test, stored.importedAt);
    sync.schedule();
    return getLibrary(db);
  });
}
