import { clipboard, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { AttemptInput, Settings, type ImportReport } from '../shared/api';
import { briefPrompt, buildBrief } from './brief';
import {
  buildSession,
  getLibrary,
  getMistakes,
  getSettings,
  getSummary,
  getToday,
  recordAttempt,
  saveSettings,
} from './database';
import { extractJson, findClaude, runClaude } from './generate';
import { ensureInboxDirs, importInbox, type InboxDirs } from './inbox';
import { localDay } from './scheduler';

type Context = {
  db: DatabaseSync;
  dirs: InboxDirs;
  workDir: string;
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean;
};

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
  let generating = false;

  function importAndRemember(): ImportReport {
    const report = importInbox(db, dirs);
    unseen = {
      imported: [...unseen.imported, ...report.imported],
      rejected: [...unseen.rejected, ...report.rejected],
    };
    return unseen;
  }

  handle('attempt:save', (_event, payload) => {
    recordAttempt(db, AttemptInput.parse(payload));
  });
  handle('summary:get', () => getSummary(db));
  handle('today:get', () => getToday(db));
  handle('session:get', () => buildSession(db));
  handle('mistakes:get', () => getMistakes(db));
  handle('library:get', () => getLibrary(db));
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

  handle('claude:status', () => ({ found: findClaude() !== null }));

  handle('claude:generate', async () => {
    if (generating) throw new Error('A test is already being generated.');
    const claude = findClaude();
    if (!claude) throw new Error('The Claude CLI was not found.');

    generating = true;
    try {
      fs.mkdirSync(workDir, { recursive: true });
      const reply = await runClaude(
        claude,
        briefPrompt(buildBrief(db)),
        workDir,
      );
      ensureInboxDirs(dirs);
      const now = new Date();
      const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const file = path.join(
        dirs.inbox,
        `claude-${localDay(now)}-${time}.json`,
      );
      fs.writeFileSync(file, extractJson(reply), 'utf8');
      return importAndRemember();
    } finally {
      generating = false;
    }
  });
}
