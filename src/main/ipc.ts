import { clipboard, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { AttemptInput, type ImportReport } from '../shared/api';
import { briefPrompt, buildBrief } from './brief';
import { buildSession, getSummary, getToday, recordAttempt } from './database';
import { ensureInboxDirs, importInbox, type InboxDirs } from './inbox';

type Context = {
  db: DatabaseSync;
  dirs: InboxDirs;
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean;
};

export function registerIpcHandlers({
  db,
  dirs,
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

  handle('attempt:save', (_event, payload) => {
    recordAttempt(db, AttemptInput.parse(payload));
  });
  handle('summary:get', () => getSummary(db));
  handle('today:get', () => getToday(db));
  handle('session:get', () => buildSession(db));
  let unseen: ImportReport = { imported: [], rejected: [] };

  handle('inbox:import', () => {
    const report = importInbox(db, dirs);
    unseen = {
      imported: [...unseen.imported, ...report.imported],
      rejected: [...unseen.rejected, ...report.rejected],
    };
    return unseen;
  });

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
}
