import {
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
  WordQuery,
  type ImportReport,
} from '../shared/api';
import { missingLanguages } from '../shared/localize';
import { checkAddedTranslations } from '../shared/translation-check';
import { validateTestFile } from '../shared/validate-test-file';
import { briefPrompt, buildBrief, translatePrompt } from './brief';
import {
  buildSession,
  deleteTest,
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
import { jlptSummary, jlptWords } from './jlpt';
import { localDay } from './scheduler';

type Context = {
  db: DatabaseSync;
  dirs: InboxDirs;
  workDir: string;
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean;
};

const TestId = z.string().min(1).max(200);
const MAX_PICTURE_BYTES = 15 * 1024 * 1024;

export function registerIpcHandlers({
  db,
  dirs,
  workDir,
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
  });
  handle('summary:get', () => getSummary(db));
  handle('today:get', () => getToday(db));
  handle('session:get', () => buildSession(db));
  handle('mistakes:get', () => getMistakes(db));
  handle('library:get', () => getLibrary(db));
  handle('library:delete', (_event, payload) => {
    deleteTest(db, TestId.parse(payload));
    return getLibrary(db);
  });
  handle('settings:get', () => getSettings(db));
  handle('settings:save', (_event, payload) =>
    saveSettings(db, Settings.parse(payload)),
  );
  handle('inbox:import', () => importAndRemember());

  handle('inbox:dismiss', () => {
    unseen = { imported: [], rejected: [] };
  });

  handle('inbox:open', async () => {
    ensureInboxDirs(dirs);
    const error = await shell.openPath(dirs.inbox);
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

  handle('jlpt:summary', () => jlptSummary(db));
  handle('jlpt:words', (_event, payload) =>
    jlptWords(db, WordQuery.parse(payload)),
  );

  handle('claude:status', () => ({ found: findClaude() !== null }));

  handle('claude:generate', async () => {
    const reply = await askClaude(briefPrompt(buildBrief(db)));
    ensureInboxDirs(dirs);
    const now = new Date();
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const file = path.join(dirs.inbox, `claude-${localDay(now)}-${time}.json`);
    fs.writeFileSync(file, reply, 'utf8');
    return importAndRemember();
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
    return getLibrary(db);
  });
}
