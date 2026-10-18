import { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_SETTINGS,
  Settings,
  type AttemptInput,
  type DueTarget,
  type LibraryTest,
  type Mistake,
  type Session,
  type SessionItem,
  type Summary,
  type SettingsInput,
  type Today,
} from '../shared/api';
import { LANGUAGES } from '../shared/languages';
import { missingLanguages } from '../shared/localize';
import { Question, type LangTest, type Target } from '../shared/test-schema';
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
  `
  CREATE TABLE tests (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    imported_at TEXT NOT NULL
  );

  CREATE TABLE questions (
    id INTEGER PRIMARY KEY,
    test_id TEXT NOT NULL REFERENCES tests (id),
    question_index INTEGER NOT NULL,
    body TEXT NOT NULL,
    UNIQUE (test_id, question_index)
  );

  CREATE TABLE question_targets (
    question_id INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES targets (id),
    PRIMARY KEY (question_id, target_id)
  );

  CREATE INDEX question_targets_target ON question_targets (target_id);
  `,
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  `
  ALTER TABLE tests ADD COLUMN title_i18n TEXT;
  `,
  `
  ALTER TABLE attempts ADD COLUMN dismissed INTEGER NOT NULL DEFAULT 0;
  `,
];

export const SESSION_LIMITS = { maxQuestions: 20, maxNewTargets: 10 };

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

export function saveTest(
  db: DatabaseSync,
  test: LangTest,
  now = new Date(),
): void {
  transaction(db, () => {
    db.prepare(
      `INSERT INTO tests (id, title, title_i18n, imported_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         title = excluded.title,
         title_i18n = excluded.title_i18n,
         imported_at = excluded.imported_at`,
    ).run(
      test.test_id,
      test.title,
      test.title_i18n ? JSON.stringify(test.title_i18n) : null,
      now.toISOString(),
    );
    db.prepare('DELETE FROM questions WHERE test_id = ?').run(test.test_id);

    const insertQuestion = db.prepare(
      'INSERT INTO questions (test_id, question_index, body) VALUES (?, ?, ?) RETURNING id',
    );
    const link = db.prepare(
      'INSERT OR IGNORE INTO question_targets (question_id, target_id) VALUES (?, ?)',
    );
    test.questions.forEach((question, index) => {
      const row = insertQuestion.get(
        test.test_id,
        index,
        JSON.stringify(question),
      ) as { id: number };
      for (const target of question.targets) {
        link.run(row.id, upsertTarget(db, target, now));
      }
    });
  });
}

type DueRow = {
  id: number;
  expression: string;
  reading: string | null;
  skill: string;
  dueDay: string | null;
  hasQuestion: number;
};

function dueTargets(db: DatabaseSync, today: string): DueRow[] {
  return db
    .prepare(
      `SELECT t.id, t.expression, t.reading, t.skill, r.due_day AS dueDay,
              EXISTS (SELECT 1 FROM question_targets qt WHERE qt.target_id = t.id) AS hasQuestion
       FROM targets t
       LEFT JOIN review_states r ON r.target_id = t.id
       WHERE r.due_day IS NULL OR r.due_day <= ?
       ORDER BY r.due_day IS NULL, r.due_day, t.id`,
    )
    .all(today) as DueRow[];
}

export function buildSession(
  db: DatabaseSync,
  now = new Date(),
  limits = SESSION_LIMITS,
): Session {
  const questionsFor = db.prepare(
    `SELECT q.id, q.test_id AS testId, q.question_index AS questionIndex, q.body
     FROM questions q
     JOIN question_targets qt ON qt.question_id = q.id
     WHERE qt.target_id = ?
     ORDER BY q.id DESC`,
  );
  const targetsOf = db.prepare(
    'SELECT target_id AS id FROM question_targets WHERE question_id = ?',
  );

  const covered = new Set<number>();
  const chosen = new Set<number>();
  const items: SessionItem[] = [];
  let newTargets = 0;

  for (const target of dueTargets(db, localDay(now))) {
    if (items.length >= limits.maxQuestions) break;
    if (covered.has(target.id)) continue;

    const isNew = target.dueDay === null;
    if (isNew && newTargets >= limits.maxNewTargets) continue;

    const candidates = questionsFor.all(target.id) as {
      id: number;
      testId: string;
      questionIndex: number;
      body: string;
    }[];
    const question = candidates.find((c) => !chosen.has(c.id));
    if (!question) continue;

    chosen.add(question.id);
    for (const row of targetsOf.all(question.id) as { id: number }[]) {
      covered.add(row.id);
    }
    if (isNew) newTargets++;

    items.push({
      testId: question.testId,
      questionIndex: question.questionIndex,
      question: Question.parse(JSON.parse(question.body)),
    });
  }

  return { title: "Today's review", items };
}

export function getToday(db: DatabaseSync, now = new Date()): Today {
  const today = localDay(now);
  const due: DueTarget[] = dueTargets(db, today).map((row) => ({
    expression: row.expression,
    reading: row.reading,
    skill: row.skill,
    dueDay: row.dueDay,
    hasQuestion: row.hasQuestion === 1,
  }));
  const next = db
    .prepare('SELECT MIN(due_day) AS day FROM review_states WHERE due_day > ?')
    .get(today) as { day: string | null };
  return {
    today,
    due,
    nextDueDay: next.day,
    questionsReady: buildSession(db, now).items.length,
    summary: getSummary(db),
  };
}

export type BriefData = {
  due: DueTarget[];
  mistakes: {
    expression: string;
    skill: string;
    answer: string;
    day: string;
  }[];
};

export function getBriefData(db: DatabaseSync, now = new Date()): BriefData {
  const today = getToday(db, now);
  const since = new Date(now);
  since.setDate(since.getDate() - 14);
  const mistakes = db
    .prepare(
      `SELECT t.expression, t.skill, a.answer, substr(a.answered_at, 1, 10) AS day
       FROM attempts a
       JOIN attempt_targets at ON at.attempt_id = a.id
       JOIN targets t ON t.id = at.target_id
       WHERE a.correct = 0 AND a.dismissed = 0 AND a.answered_at >= ?
       ORDER BY a.answered_at DESC
       LIMIT 30`,
    )
    .all(since.toISOString()) as BriefData['mistakes'];
  return { due: today.due, mistakes };
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

export function getMistakes(db: DatabaseSync, limit = 100): Mistake[] {
  const rows = db
    .prepare(
      `SELECT a.id, a.answer, a.answered_at AS answeredAt, q.body,
              (SELECT group_concat(t.expression, '、')
                 FROM attempt_targets at JOIN targets t ON t.id = at.target_id
                 WHERE at.attempt_id = a.id) AS targets
       FROM attempts a
       LEFT JOIN questions q
         ON q.test_id = a.test_id AND q.question_index = a.question_index
       WHERE a.correct = 0 AND a.dismissed = 0
       ORDER BY a.answered_at DESC, a.id DESC
       LIMIT ?`,
    )
    .all(limit) as {
    id: number;
    answer: string;
    answeredAt: string;
    body: string | null;
    targets: string | null;
  }[];

  return rows.map((row) => {
    const parsed = row.body ? Question.safeParse(JSON.parse(row.body)) : null;
    return {
      id: row.id,
      answeredAt: row.answeredAt,
      answer: row.answer,
      question: parsed?.success ? parsed.data : null,
      targets: row.targets ? row.targets.split('、') : [],
    };
  });
}

/**
 * Takes a wrong answer off the Mistakes page and out of what Claude is told
 * to focus on. The answer stays in your history and review schedule.
 */
export function dismissMistake(db: DatabaseSync, attemptId: number): void {
  db.prepare(
    'UPDATE attempts SET dismissed = 1 WHERE id = ? AND correct = 0',
  ).run(attemptId);
}

export function getTest(
  db: DatabaseSync,
  testId: string,
): { test: LangTest; importedAt: Date } | null {
  const row = db
    .prepare(
      'SELECT title, title_i18n AS titleI18n, imported_at AS importedAt FROM tests WHERE id = ?',
    )
    .get(testId) as
    | { title: string; titleI18n: string | null; importedAt: string }
    | undefined;
  if (!row) return null;
  const questions = (
    db
      .prepare(
        'SELECT body FROM questions WHERE test_id = ? ORDER BY question_index',
      )
      .all(testId) as { body: string }[]
  ).map((question) => Question.parse(JSON.parse(question.body)));
  return {
    test: {
      format: 'langtest',
      format_version: 1,
      test_id: testId,
      language: 'ja',
      title: row.title,
      ...(row.titleI18n ? { title_i18n: JSON.parse(row.titleI18n) } : {}),
      questions,
    },
    importedAt: new Date(row.importedAt),
  };
}

export function getLibrary(db: DatabaseSync): LibraryTest[] {
  const ids = db
    .prepare('SELECT id FROM tests ORDER BY imported_at DESC')
    .all() as { id: string }[];
  return ids.flatMap(({ id }) => {
    const stored = getTest(db, id);
    if (!stored) return [];
    return [
      {
        id,
        title: stored.test.title,
        titleI18n: stored.test.title_i18n ?? {},
        importedAt: stored.importedAt.toISOString(),
        questions: stored.test.questions.length,
        missingLanguages: missingLanguages(
          stored.test,
          LANGUAGES.map((language) => language.code),
        ),
      },
    ];
  });
}

export function deleteTest(db: DatabaseSync, testId: string): void {
  transaction(db, () => {
    const targetIds = (
      db
        .prepare(
          `SELECT DISTINCT qt.target_id AS id
           FROM question_targets qt
           JOIN questions q ON q.id = qt.question_id
           WHERE q.test_id = ?`,
        )
        .all(testId) as { id: number }[]
    ).map((row) => row.id);

    db.prepare('DELETE FROM questions WHERE test_id = ?').run(testId);
    db.prepare('DELETE FROM tests WHERE id = ?').run(testId);

    const removeUnused = db.prepare(
      `DELETE FROM targets
       WHERE id = ?
         AND NOT EXISTS (SELECT 1 FROM question_targets WHERE target_id = targets.id)
         AND NOT EXISTS (SELECT 1 FROM attempt_targets WHERE target_id = targets.id)
         AND NOT EXISTS (SELECT 1 FROM review_states WHERE target_id = targets.id)`,
    );
    for (const id of targetIds) {
      removeUnused.run(id);
    }
  });
}

export function getSettings(db: DatabaseSync): Settings {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'learner'")
    .get() as { value: string } | undefined;
  if (!row) return DEFAULT_SETTINGS;
  const parsed = Settings.safeParse(JSON.parse(row.value));
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export function saveSettings(
  db: DatabaseSync,
  settings: SettingsInput,
): Settings {
  const valid = Settings.parse(settings);
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('learner', ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  ).run(JSON.stringify(valid));
  return valid;
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
