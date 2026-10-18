import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupDatabase, readBackup, restoreDatabase } from './backup';
import {
  getMistakes,
  getSettings,
  MIGRATIONS,
  openDatabase,
  recordAttempt,
  saveSettings,
} from './database';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotoba-backup-test-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function answer(db: DatabaseSync, expression: string, correct: boolean) {
  recordAttempt(db, {
    testId: 't',
    questionIndex: 0,
    template: 'reading',
    answer: 'x',
    correct,
    targets: [{ expression, skill: 'reading' }],
  });
}

describe('backup and restore', () => {
  it('backs up, then restores everything into the open database', () => {
    const db = openDatabase(path.join(dir, 'kotoba.db'));
    answer(db, '納期', false);
    saveSettings(db, { ...getSettings(db), topics: ['travel'] });
    const file = path.join(dir, 'backup.db');
    backupDatabase(db, file);
    expect(readBackup(file)).toEqual({ tests: 0, answers: 1, words: 1 });

    answer(db, '原則', false);
    saveSettings(db, { ...getSettings(db), topics: ['work'] });
    restoreDatabase(db, file);

    expect(getMistakes(db).map((m) => m.targets)).toEqual([['納期']]);
    expect(getSettings(db).topics).toEqual(['travel']);
    answer(db, '見地', true);
    expect(readBackup(file).answers).toBe(1);
    db.close();
  });

  it('brings an older backup up to date when restoring', () => {
    const old = new DatabaseSync(path.join(dir, 'old.db'));
    old.exec(MIGRATIONS[0]);
    old.exec(MIGRATIONS[1]);
    old.exec('PRAGMA user_version = 2');
    old.exec(
      "INSERT INTO targets (id, expression, skill, created_at) VALUES (1, '納期', 'reading', '2026-10-01T00:00:00Z')",
    );
    old.exec(
      "INSERT INTO attempts (id, test_id, question_index, template, answer, correct, answered_at) VALUES (1, 't', 0, 'reading', 'なっき', 0, '2026-10-01T00:00:00Z')",
    );
    old.exec('INSERT INTO attempt_targets VALUES (1, 1)');
    old.close();

    const db = openDatabase(path.join(dir, 'kotoba.db'));
    answer(db, '原則', false);
    restoreDatabase(db, path.join(dir, 'old.db'));
    expect(getMistakes(db)).toMatchObject([
      { answer: 'なっき', targets: ['納期'] },
    ]);
    db.close();
  });

  it('refuses files that are not Kotoba backups', () => {
    const text = path.join(dir, 'notes.db');
    fs.writeFileSync(text, 'hello');
    expect(() => readBackup(text)).toThrow('not a Kotoba backup');

    const other = new DatabaseSync(path.join(dir, 'other.db'));
    other.exec('CREATE TABLE x (y)');
    other.close();
    expect(() => readBackup(path.join(dir, 'other.db'))).toThrow(
      'not a Kotoba backup',
    );

    const db = openDatabase(path.join(dir, 'kotoba.db'));
    answer(db, '納期', false);
    expect(() => restoreDatabase(db, text)).toThrow('not a Kotoba backup');
    expect(getMistakes(db)).toHaveLength(1);
    db.close();
  });
});
