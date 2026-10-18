import type { DatabaseSync } from 'node:sqlite';
import { Settings } from '../../shared/api';
import type { LangTest } from '../../shared/test-schema';
import {
  applySyncedAttempts,
  deleteTest,
  getSettings,
  getTest,
  saveTest,
  unsyncedAttempts,
  type SyncedAttempt,
} from '../database';

// Kotoba keeps a full copy of the data on every device. Syncing uploads what
// changed here and downloads what changed elsewhere since the last time.

export type SyncedTest = {
  test_id: string;
  body: LangTest | null;
  imported_at: string;
  deleted: boolean;
};

export type SyncedSettings = { body: Settings; changed_at: string };

export type Changes = {
  attempts: SyncedAttempt[];
  tests: SyncedTest[];
  settings: SyncedSettings | null;
};

/** Where the shared copy lives (Supabase in the app, a fake in tests). */
export interface RemoteStore {
  push(changes: Changes): Promise<void>;
  /** Everything changed after `cursor`, and the cursor to use next time. */
  pull(cursor: string | null): Promise<{ changes: Changes; cursor: string }>;
}

export type SyncResult = {
  uploaded: number;
  downloaded: number;
  at: string;
};

function readKey(db: DatabaseSync, key: string): string | null {
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function writeKey(db: DatabaseSync, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export function localChanges(db: DatabaseSync): Changes {
  const tests: SyncedTest[] = [];
  const changedTests = db
    .prepare('SELECT id, imported_at FROM tests WHERE synced = 0')
    .all() as { id: string; imported_at: string }[];
  for (const row of changedTests) {
    const stored = getTest(db, row.id);
    if (stored) {
      tests.push({
        test_id: row.id,
        body: stored.test,
        imported_at: row.imported_at,
        deleted: false,
      });
    }
  }
  const deleted = db
    .prepare('SELECT id FROM deleted_tests WHERE synced = 0')
    .all() as { id: string }[];
  for (const row of deleted) {
    tests.push({
      test_id: row.id,
      body: null,
      imported_at: new Date().toISOString(),
      deleted: true,
    });
  }

  // Settings saved before sync existed have no change time; they count as
  // older than any change made since.
  let changedAt = readKey(db, 'learner_changed_at');
  if (!changedAt && readKey(db, 'learner')) {
    changedAt = new Date(0).toISOString();
    writeKey(db, 'learner_changed_at', changedAt);
  }
  const pushedAt = readKey(db, 'sync_settings_at');
  const settings =
    changedAt && changedAt !== pushedAt
      ? { body: getSettings(db), changed_at: changedAt }
      : null;

  return { attempts: unsyncedAttempts(db), tests, settings };
}

function markPushed(db: DatabaseSync, changes: Changes): void {
  const attempt = db.prepare('UPDATE attempts SET synced = 1 WHERE uid = ?');
  for (const a of changes.attempts) attempt.run(a.uid);
  const test = db.prepare('UPDATE tests SET synced = 1 WHERE id = ?');
  const gone = db.prepare('UPDATE deleted_tests SET synced = 1 WHERE id = ?');
  for (const t of changes.tests) (t.deleted ? gone : test).run(t.test_id);
  if (changes.settings) {
    writeKey(db, 'sync_settings_at', changes.settings.changed_at);
  }
}

/** Applies another device's changes. Returns how many items changed here. */
export function applyRemote(db: DatabaseSync, changes: Changes): number {
  let changed = applySyncedAttempts(db, changes.attempts);

  for (const remote of changes.tests) {
    const local = db
      .prepare('SELECT imported_at FROM tests WHERE id = ?')
      .get(remote.test_id) as { imported_at: string } | undefined;
    if (remote.deleted) {
      if (local) {
        deleteTest(db, remote.test_id);
        changed++;
      }
      db.prepare('UPDATE deleted_tests SET synced = 1 WHERE id = ?').run(
        remote.test_id,
      );
    } else if (
      remote.body &&
      (!local || local.imported_at < remote.imported_at)
    ) {
      saveTest(db, remote.body, new Date(remote.imported_at));
      db.prepare('UPDATE tests SET synced = 1 WHERE id = ?').run(
        remote.test_id,
      );
      changed++;
    }
  }

  if (changes.settings) {
    const localAt = readKey(db, 'learner_changed_at');
    const parsed = Settings.safeParse(changes.settings.body);
    if (parsed.success && (!localAt || localAt < changes.settings.changed_at)) {
      writeKey(db, 'learner', JSON.stringify(parsed.data));
      writeKey(db, 'learner_changed_at', changes.settings.changed_at);
      writeKey(db, 'sync_settings_at', changes.settings.changed_at);
      changed++;
    }
  }
  return changed;
}

/** Uploads local changes, then downloads and applies remote ones. */
export async function runSync(
  db: DatabaseSync,
  store: RemoteStore,
  now = new Date(),
): Promise<SyncResult> {
  const outgoing = localChanges(db);
  const uploaded =
    outgoing.attempts.length +
    outgoing.tests.length +
    (outgoing.settings ? 1 : 0);
  if (uploaded > 0) {
    await store.push(outgoing);
    markPushed(db, outgoing);
  }

  const { changes, cursor } = await store.pull(readKey(db, 'sync_cursor'));
  const downloaded = applyRemote(db, changes);
  writeKey(db, 'sync_cursor', cursor);
  const at = now.toISOString();
  writeKey(db, 'sync_last', at);
  return { uploaded, downloaded, at };
}
