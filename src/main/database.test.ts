import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AttemptInput } from '../shared/api';
import type { LangTest, Question } from '../shared/test-schema';
import {
  buildSession,
  getSummary,
  getToday,
  migrate,
  MIGRATIONS,
  openDatabase,
  recordAttempt,
  saveTest,
  schemaVersion,
} from './database';

const attempt: AttemptInput = {
  testId: 'sample-it-n2',
  questionIndex: 1,
  template: 'reading',
  answer: 'ふっきゅう',
  correct: true,
  targets: [{ expression: '復旧', reading: 'ふっきゅう', skill: 'reading' }],
};

let db: DatabaseSync;

beforeEach(() => {
  db = openDatabase(':memory:');
});

function count(table: string): number {
  return (
    db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  ).n;
}

describe('migrations', () => {
  it('brings a new database to the latest version', () => {
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
  });

  it('can run again without changing anything', () => {
    migrate(db);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
  });

  it('upgrades a version 1 database and keeps its data', () => {
    const old = new DatabaseSync(':memory:');
    old.exec(MIGRATIONS[0]);
    old.exec('PRAGMA user_version = 1');
    old
      .prepare(
        "INSERT INTO targets (expression, skill, created_at) VALUES ('復旧', 'reading', 'x')",
      )
      .run();

    migrate(old);

    expect(schemaVersion(old)).toBe(MIGRATIONS.length);
    const row = old.prepare('SELECT COUNT(*) AS n FROM targets').get() as {
      n: number;
    };
    expect(row.n).toBe(1);
  });
});

describe('recordAttempt', () => {
  it('saves the attempt and links its targets', () => {
    recordAttempt(db, attempt);
    expect(count('attempts')).toBe(1);
    expect(count('targets')).toBe(1);
    expect(count('attempt_targets')).toBe(1);
  });

  it('stores the answer details', () => {
    const id = recordAttempt(db, attempt, new Date('2026-10-14T09:00:00Z'));
    const row = db.prepare('SELECT * FROM attempts WHERE id = ?').get(id);
    expect(row).toMatchObject({
      test_id: 'sample-it-n2',
      question_index: 1,
      template: 'reading',
      answer: 'ふっきゅう',
      correct: 1,
      answered_at: '2026-10-14T09:00:00.000Z',
    });
  });

  it('reuses a target that already exists', () => {
    recordAttempt(db, attempt);
    recordAttempt(db, { ...attempt, correct: false, answer: 'ふきゅう' });
    expect(count('targets')).toBe(1);
    expect(count('attempt_targets')).toBe(2);
  });

  it('keeps the same word with different skills apart', () => {
    recordAttempt(db, attempt);
    recordAttempt(db, {
      ...attempt,
      template: 'multiple_choice',
      targets: [{ expression: '復旧', skill: 'meaning' }],
    });
    expect(count('targets')).toBe(2);
  });

  it('fills in a reading learned later without erasing it', () => {
    const withoutReading = {
      ...attempt,
      targets: [{ expression: '復旧', skill: 'reading' as const }],
    };
    recordAttempt(db, withoutReading);
    recordAttempt(db, attempt);
    recordAttempt(db, withoutReading);
    const row = db.prepare('SELECT reading FROM targets').get() as {
      reading: string;
    };
    expect(row.reading).toBe('ふっきゅう');
  });

  it('saves nothing when part of the write fails', () => {
    const broken = {
      ...attempt,
      targets: [{ expression: null, skill: 'reading' }],
    };
    expect(() =>
      recordAttempt(db, broken as unknown as AttemptInput),
    ).toThrow();
    expect(count('attempts')).toBe(0);
    expect(count('targets')).toBe(0);
  });
});

describe('scheduling', () => {
  const monday = new Date(2026, 9, 12, 9, 0);
  const tuesday = new Date(2026, 9, 13, 9, 0);

  function dueDay(): string {
    const row = db.prepare('SELECT due_day FROM review_states').get() as {
      due_day: string;
    };
    return row.due_day;
  }

  it('creates a review state for each answered target', () => {
    recordAttempt(db, attempt, monday);
    expect(count('review_states')).toBe(1);
  });

  it('brings a wrong answer back the next day', () => {
    recordAttempt(db, { ...attempt, correct: false }, monday);
    expect(dueDay()).toBe('2026-10-13');
  });

  it('only counts the first answer of the day', () => {
    recordAttempt(db, { ...attempt, correct: false }, monday);
    recordAttempt(db, attempt, new Date(2026, 9, 12, 20, 0));
    expect(dueDay()).toBe('2026-10-13');
    expect(count('attempts')).toBe(2);
  });

  it('updates the schedule on a later day', () => {
    recordAttempt(db, { ...attempt, correct: false }, monday);
    recordAttempt(db, attempt, tuesday);
    expect(dueDay() > '2026-10-14').toBe(true);
  });
});

describe('getToday', () => {
  const monday = new Date(2026, 9, 12, 9, 0);

  it('is empty for a new database', () => {
    expect(getToday(db, monday)).toMatchObject({
      today: '2026-10-12',
      due: [],
      nextDueDay: null,
    });
  });

  it('lists targets that are due, and not ones scheduled later', () => {
    recordAttempt(db, { ...attempt, correct: false }, monday);
    recordAttempt(
      db,
      {
        ...attempt,
        targets: [
          { expression: '障害', reading: 'しょうがい', skill: 'reading' },
        ],
      },
      monday,
    );

    const tuesday = getToday(db, new Date(2026, 9, 13, 9, 0));
    expect(tuesday.due).toEqual([
      {
        expression: '復旧',
        reading: 'ふっきゅう',
        skill: 'reading',
        dueDay: '2026-10-13',
        hasQuestion: false,
      },
    ]);
    expect(tuesday.nextDueDay! > '2026-10-13').toBe(true);
  });

  it('treats targets without a review state as due', () => {
    db.prepare(
      "INSERT INTO targets (expression, skill, created_at) VALUES ('導入', 'reading', 'x')",
    ).run();
    expect(getToday(db, monday).due).toEqual([
      {
        expression: '導入',
        reading: null,
        skill: 'reading',
        dueDay: null,
        hasQuestion: false,
      },
    ]);
  });
});

describe('saveTest and buildSession', () => {
  const monday = new Date(2026, 9, 12, 9, 0);

  function readingQuestion(expression: string, reading: string): Question {
    return {
      template: 'reading',
      prompt: expression,
      answers: [reading],
      targets: [{ expression, reading, skill: 'reading' }],
    };
  }

  function makeTest(id: string, questions: Question[]): LangTest {
    return {
      format: 'langtest',
      format_version: 1,
      test_id: id,
      language: 'ja',
      title: `Test ${id}`,
      questions,
    };
  }

  it('stores questions and their targets', () => {
    saveTest(
      db,
      makeTest('a', [readingQuestion('復旧', 'ふっきゅう')]),
      monday,
    );
    expect(count('tests')).toBe(1);
    expect(count('questions')).toBe(1);
    expect(count('question_targets')).toBe(1);
    expect(getToday(db, monday).due[0].hasQuestion).toBe(true);
  });

  it('replaces the questions when the same test is imported again', () => {
    saveTest(
      db,
      makeTest('a', [readingQuestion('復旧', 'ふっきゅう')]),
      monday,
    );
    saveTest(
      db,
      makeTest('a', [
        readingQuestion('障害', 'しょうがい'),
        readingQuestion('導入', 'どうにゅう'),
      ]),
      monday,
    );
    expect(count('tests')).toBe(1);
    expect(count('questions')).toBe(2);
    expect(count('question_targets')).toBe(2);
  });

  it('builds a session from questions whose targets are due', () => {
    saveTest(
      db,
      makeTest('a', [
        readingQuestion('復旧', 'ふっきゅう'),
        readingQuestion('障害', 'しょうがい'),
      ]),
      monday,
    );
    const session = buildSession(db, monday);
    expect(session.items.map((item) => item.question.prompt)).toEqual([
      '復旧',
      '障害',
    ]);
    expect(session.items[1]).toMatchObject({ testId: 'a', questionIndex: 1 });
  });

  it('leaves out targets that are not due yet', () => {
    saveTest(
      db,
      makeTest('a', [readingQuestion('復旧', 'ふっきゅう')]),
      monday,
    );
    recordAttempt(db, attempt, monday);
    expect(buildSession(db, monday).items).toHaveLength(0);
  });

  it('asks about each target only once per session', () => {
    saveTest(
      db,
      makeTest('a', [readingQuestion('復旧', 'ふっきゅう')]),
      monday,
    );
    saveTest(
      db,
      makeTest('b', [readingQuestion('復旧', 'ふっきゅう')]),
      monday,
    );
    const session = buildSession(db, monday);
    expect(session.items).toHaveLength(1);
    expect(session.items[0].testId).toBe('b');
  });

  it('respects the question and new-target limits', () => {
    const words = ['一', '二', '三', '四', '五'].map((kanji, i) =>
      readingQuestion(kanji, 'いちにさんしご'.slice(i, i + 1)),
    );
    saveTest(db, makeTest('a', words), monday);
    expect(
      buildSession(db, monday, { maxQuestions: 10, maxNewTargets: 2 }).items,
    ).toHaveLength(2);
    expect(
      buildSession(db, monday, { maxQuestions: 3, maxNewTargets: 10 }).items,
    ).toHaveLength(3);
  });

  it('puts reviews that are due before new targets', () => {
    saveTest(
      db,
      makeTest('a', [
        readingQuestion('障害', 'しょうがい'),
        readingQuestion('復旧', 'ふっきゅう'),
      ]),
      monday,
    );
    recordAttempt(db, { ...attempt, correct: false }, monday);
    const tuesday = new Date(2026, 9, 13, 9, 0);
    const prompts = buildSession(db, tuesday).items.map(
      (item) => item.question.prompt,
    );
    expect(prompts).toEqual(['復旧', '障害']);
  });
});

describe('getSummary', () => {
  it('is all zeros for a new database', () => {
    expect(getSummary(db)).toEqual({ attempts: 0, correct: 0, targets: 0 });
  });

  it('counts attempts, correct answers and targets', () => {
    recordAttempt(db, attempt);
    recordAttempt(db, { ...attempt, correct: false });
    expect(getSummary(db)).toEqual({ attempts: 2, correct: 1, targets: 1 });
  });
});
