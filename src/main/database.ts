import { DatabaseSync } from 'node:sqlite';
import type { AttemptInput, DueTarget, Summary, Today } from '../shared/api';
import type { Target } from '../shared/test-schema';
import {
  localDay,
  parseCard,
  review,
  serializeCard,
  type ReviewState,
} from './scheduler';

export const MIGRATIONS: string[] = [
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
  `
  CREATE TABLE review_states (
    target_id INTEGER PRIMARY KEY REFERENCES targets (id),
    card TEXT NOT NULL,
    due_day TEXT NOT NULL,
    last_review_day TEXT NOT NULL
  );

  CREATE INDEX review_states_due_day ON review_states (due_day);
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
      const targetId = upsertTarget(db, target, now);
      link.run(attemptId, targetId);
      scheduleTarget(db, targetId, input.correct, now);
    }
    return attemptId;
  });
}

export function getToday(db: DatabaseSync, now = new Date()): Today {
  const today = localDay(now);
  const due = db
    .prepare(
      `SELECT t.expression, t.reading, t.skill, r.due_day AS dueDay
       FROM targets t
       LEFT JOIN review_states r ON r.target_id = t.id
       WHERE r.due_day IS NULL OR r.due_day <= ?
       ORDER BY r.due_day IS NULL, r.due_day, t.id`,
    )
    .all(today) as DueTarget[];
  const next = db
    .prepare('SELECT MIN(due_day) AS day FROM review_states WHERE due_day > ?')
    .get(today) as { day: string | null };
  return { today, due, nextDueDay: next.day, summary: getSummary(db) };
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

function scheduleTarget(
  db: DatabaseSync,
  targetId: number,
  correct: boolean,
  now: Date,
): void {
  const row = db
    .prepare(
      'SELECT card, due_day, last_review_day FROM review_states WHERE target_id = ?',
    )
    .get(targetId) as
    | { card: string; due_day: string; last_review_day: string }
    | undefined;

  const previous: ReviewState | null = row
    ? {
        card: parseCard(row.card),
        dueDay: row.due_day,
        lastReviewDay: row.last_review_day,
      }
    : null;

  const next = review(previous, correct, now);
  if (!next) return;

  db.prepare(
    `INSERT INTO review_states (target_id, card, due_day, last_review_day)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (target_id) DO UPDATE SET
       card = excluded.card,
       due_day = excluded.due_day,
       last_review_day = excluded.last_review_day`,
  ).run(targetId, serializeCard(next.card), next.dueDay, next.lastReviewDay);
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
