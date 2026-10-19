/// <reference types="vite/client" />
import type { DatabaseSync } from 'node:sqlite';
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { migrate } from '../main/database';
import { SyncManager } from '../main/sync/manager';
import { webApi } from './api';
import { WebDatabase } from './sqlite';
import { loadDatabase, saveDatabase } from './storage';

// Starts Kotoba in a browser: opens the local copy of the data, gives the app
// the same API the desktop window has, and syncs with the learner's
// Supabase project.

const SAVE_DELAY_MS = 50;

async function start() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const raw = new SQL.Database((await loadDatabase()) ?? undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    // Exporting reopens the database, which resets this setting.
    void saveDatabase(raw.export());
    raw.exec('PRAGMA foreign_keys = ON');
  };
  const web = new WebDatabase(raw, () => {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  });
  const db = web as unknown as DatabaseSync;
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  save();
  window.addEventListener('pagehide', save);

  const listeners = new Set<() => void>();
  const sync = new SyncManager(db, () => {
    for (const listener of listeners) listener();
  });
  // The web build can come with the Supabase project already set (the URL
  // and publishable key are safe to ship), so devices only need to sign in.
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
  if (url && key && !(await sync.status()).url) {
    await sync.configure({ url, key });
  }
  window.kotoba = webApi(db, sync, listeners);
  // Lets the dev server's console load sample data; not in the built site.
  if (import.meta.env.DEV) {
    (window as unknown as { kotobaDb: DatabaseSync }).kotobaDb = db;
  }

  await import('../renderer/index');
  void sync.syncNow();
}

void start();
