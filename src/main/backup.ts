import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, openDatabase, schemaVersion } from './database';

export type BackupInfo = { tests: number; answers: number; words: number };

function quote(file: string): string {
  return `'${file.replace(/'/g, "''")}'`;
}

/** Writes a consistent copy of the database to `file`, replacing it. */
export function backupDatabase(db: DatabaseSync, file: string): void {
  fs.rmSync(file, { force: true });
  db.exec(`VACUUM INTO ${quote(file)}`);
}

function count(db: DatabaseSync, table: string): number {
  return (
    db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  ).n;
}

/** What a backup holds, or an error when the file is not a Kotoba backup. */
export function readBackup(file: string): BackupInfo {
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(file, { readOnly: true });
  } catch {
    throw new Error('That file is not a Kotoba backup.');
  }
  try {
    const version = schemaVersion(db);
    if (version < 1) throw new Error('That file is not a Kotoba backup.');
    if (version > MIGRATIONS.length) {
      throw new Error('That backup is from a newer version of Kotoba.');
    }
    const tables = new Set(
      (
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as { name: string }[]
      ).map((row) => row.name),
    );
    if (!['attempts', 'targets'].every((table) => tables.has(table))) {
      throw new Error('That file is not a Kotoba backup.');
    }
    return {
      tests: tables.has('tests') ? count(db, 'tests') : 0,
      answers: count(db, 'attempts'),
      words: count(db, 'targets'),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Kotoba')) throw error;
    throw new Error('That file is not a Kotoba backup.');
  } finally {
    db.close();
  }
}

/**
 * Replaces everything in `db` with the contents of the backup at `file`,
 * keeping the same connection open. The backup is first brought up to the
 * current schema on a temporary copy.
 */
export function restoreDatabase(db: DatabaseSync, file: string): void {
  readBackup(file);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotoba-restore-'));
  const copy = path.join(dir, 'backup.db');
  try {
    fs.copyFileSync(file, copy);
    openDatabase(copy).close();

    const tables = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        )
        .all() as { name: string }[]
    ).map((row) => row.name);

    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`ATTACH DATABASE ${quote(copy)} AS backup`);
    try {
      db.exec('BEGIN');
      try {
        for (const table of tables) {
          db.exec(`DELETE FROM main."${table}"`);
          db.exec(
            `INSERT INTO main."${table}" SELECT * FROM backup."${table}"`,
          );
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } finally {
      db.exec('DETACH DATABASE backup');
      db.exec('PRAGMA foreign_keys = ON');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
