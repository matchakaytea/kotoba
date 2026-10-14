import { DatabaseSync } from 'node:sqlite';
import type { AttemptInput, Summary } from '../shared/api';
import type { Target } from '../shared/test-schema';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE targets (
    id INTEGER PRIMARY KEY,
    expression TEXT NOT NULL,
    skill TEXT NOT NULL,
    reading TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (expression, skill)
  );

  CREATE TABLE attempts (
    id INTEGER PRIMARY KEY,
    test_id TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    template TEXT NOT NULL,
    answer TEXT NOT NULL,
    correct INTEGER NOT NULL,
    answered_at TEXT NOT NULL
  );

  CREATE TABLE attempt_targets (
    attempt_id INTEGER NOT NULL REFERENCES attempts (id),
    target_id INTEGER NOT NULL REFERENCES targets (id),
    PRIMARY KEY (attempt_id, target_id)
  );
  `,
];

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  return db;
}

export function schemaVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  return row.user_version;
}

export function migrate(db: DatabaseSync): void {
  for (
    let version = schemaVersion(db);
    version < MIGRATIONS.length;
    version++
  ) {
    transaction(db, () => {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

export function recordAttempt(
  db: DatabaseSync,
  input: AttemptInput,
  now = new Date(),
): number {
  return transaction(db, () => {
    const result = db
      .prepare(
        `INSERT INTO attempts (test_id, question_index, template, answer, correct, answered_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.testId,
        input.questionIndex,
        input.template,
        input.answer,
        input.correct ? 1 : 0,
        now.toISOString(),
      );
    const attemptId = Number(result.lastInsertRowid);

    const link = db.prepare(
      'INSERT OR IGNORE INTO attempt_targets (attempt_id, target_id) VALUES (?, ?)',
    );
    for (const target of input.targets) {
      link.run(attemptId, upsertTarget(db, target, now));
    }
    return attemptId;
  });
}

export function getSummary(db: DatabaseSync): Summary {
  const attempts = db
    .prepare(
      'SELECT COUNT(*) AS attempts, COALESCE(SUM(correct), 0) AS correct FROM attempts',
    )
    .get() as { attempts: number; correct: number };
  const targets = db
    .prepare('SELECT COUNT(*) AS targets FROM targets')
    .get() as {
    targets: number;
  };
  return { ...attempts, ...targets };
}

function upsertTarget(db: DatabaseSync, target: Target, now: Date): number {
  const row = db
    .prepare(
      `INSERT INTO targets (expression, skill, reading, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (expression, skill)
         DO UPDATE SET reading = COALESCE(excluded.reading, targets.reading)
       RETURNING id`,
    )
    .get(
      target.expression,
      target.skill,
      target.reading ?? null,
      now.toISOString(),
    ) as {
    id: number;
  };
  return row.id;
}

function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
