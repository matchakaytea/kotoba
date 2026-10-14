import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { AttemptInput } from '../shared/api';
import { getSummary, recordAttempt } from './database';

export function registerIpcHandlers(
  db: DatabaseSync,
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean,
): void {
  function guard(event: IpcMainInvokeEvent) {
    if (!isTrustedSender(event)) {
      throw new Error('Untrusted sender');
    }
  }

  ipcMain.handle('attempt:save', (event, payload: unknown) => {
    guard(event);
    recordAttempt(db, AttemptInput.parse(payload));
  });

  ipcMain.handle('summary:get', (event) => {
    guard(event);
    return getSummary(db);
  });
}
