import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { briefPrompt, buildBrief } from '../brief';
import {
  getSettings,
  openDatabase,
  recordAttempt,
  saveSettings,
  saveTest,
} from '../database';
import type { JlptWord } from './clean';
import {
  JLPT_WORDS,
  jlptLevelOf,
  jlptSummary,
  jlptWords,
  pickNewWords,
  wordStatuses,
} from './index';

const list: JlptWord[] = [
  { expression: '会う', readings: ['あう'], meaning: 'to meet', level: 5 },
  { expression: '青', readings: ['あお'], meaning: 'blue', level: 5 },
  {
    expression: '原則',
    readings: ['げんそく'],
    meaning: 'principle',
    level: 1,
  },
  {
    expression: '見地',
    readings: ['けんち'],
    meaning: 'point of view',
    level: 1,
  },
  {
    expression: '現像',
    readings: ['げんぞう'],
    meaning: 'developing (film)',
    level: 1,
  },
];

let db: DatabaseSync;
beforeEach(() => {
  db = openDatabase(':memory:');
});

function practise(expression: string, correct: boolean, when: Date) {
  recordAttempt(
    db,
    {
      testId: 't',
      questionIndex: 0,
      template: 'reading',
      answer: 'x',
      correct,
      targets: [{ expression, skill: 'reading' }],
    },
    when,
  );
}

describe('the bundled list', () => {
  it('has words at every level with clean readings', () => {
    for (const level of [5, 4, 3, 2, 1]) {
      expect(
        JLPT_WORDS.filter((w) => w.level === level).length,
      ).toBeGreaterThan(500);
    }
    expect(
      JLPT_WORDS.every((w) =>
        w.readings.every((r) => /^[ぁ-ゖァ-ヺー]+$/.test(r)),
      ),
    ).toBe(true);
  });
});

describe('jlptLevelOf', () => {
  it('reads the level setting', () => {
    expect(jlptLevelOf('around JLPT N2')).toBe(2);
    expect(jlptLevelOf('B1, strong reading')).toBeNull();
  });
});

describe('wordStatuses', () => {
  it('marks practised words as learning, and long intervals as known', () => {
    practise('会う', false, new Date(2026, 9, 1));
    practise('青', true, new Date(2026, 9, 1));
    db.prepare(
      "UPDATE review_states SET due_day = '2026-11-01' WHERE target_id = (SELECT id FROM targets WHERE expression = '青')",
    ).run();
    const statuses = wordStatuses(db);
    expect(statuses.get('会う')).toBe('learning');
    expect(statuses.get('青')).toBe('known');
    expect(statuses.get('原則')).toBeUndefined();
  });
});

describe('jlptSummary and jlptWords', () => {
  it('counts progress per level', () => {
    practise('原則', true, new Date(2026, 9, 1));
    const summary = jlptSummary(db, list);
    expect(summary.find((s) => s.level === 1)).toEqual({
      level: 1,
      total: 3,
      learning: 1,
      known: 0,
    });
    expect(summary.find((s) => s.level === 5)?.total).toBe(2);
  });

  it('filters by status, searches and pages', () => {
    practise('原則', true, new Date(2026, 9, 1));
    const query = { level: 1 as const, offset: 0, limit: 10 };
    expect(jlptWords(db, { ...query, status: 'new' }, list).total).toBe(2);
    expect(
      jlptWords(db, { ...query, search: 'film' }, list).words.map(
        (w) => w.expression,
      ),
    ).toEqual(['現像']);
    expect(
      jlptWords(db, { ...query, search: 'けんち' }, list).words[0].expression,
    ).toBe('見地');
    const page = jlptWords(db, { ...query, offset: 1, limit: 1 }, list);
    expect(page).toMatchObject({ total: 3, words: [{ expression: '見地' }] });
  });
});

describe('pickNewWords', () => {
  it('only picks unpractised words from the level', () => {
    practise('原則', true, new Date(2026, 9, 1));
    const picked = pickNewWords(db, 1, 10, () => 0.5, list).map(
      (w) => w.expression,
    );
    expect(picked.sort()).toEqual(['現像', '見地']);
  });

  it('returns at most the number asked for', () => {
    expect(pickNewWords(db, 1, 2, () => 0, list)).toHaveLength(2);
  });
});

describe('brief with the JLPT list', () => {
  it('hands Claude new words from the chosen level', () => {
    const brief = buildBrief(db, new Date(2026, 9, 1), () => 0.3);
    expect(brief.word_list).toBe('JLPT N2');
    expect(brief.new_words).toHaveLength(15);
    expect(
      brief.new_words.every((w) =>
        JLPT_WORDS.some((j) => j.expression === w.expression && j.level === 2),
      ),
    ).toBe(true);
    expect(briefPrompt(brief)).toContain('from the JLPT N2 vocabulary list');
  });

  it("lets Claude choose when the source is 'free' or the level is custom", () => {
    saveSettings(db, { ...getSettings(db), wordSource: 'free' });
    expect(buildBrief(db).new_words).toEqual([]);
    saveSettings(db, {
      ...getSettings(db),
      wordSource: 'jlpt',
      level: 'B1, strong reading',
    });
    const brief = buildBrief(db);
    expect(brief.new_words).toEqual([]);
    expect(briefPrompt(brief)).toContain(
      'new, useful words for a learner B1, strong reading',
    );
  });
});

describe('words that are in a test but not answered yet', () => {
  function queue(expression: string) {
    saveTest(db, {
      format: 'langtest',
      format_version: 1,
      test_id: `queued-${expression}`,
      language: 'ja',
      title: 'Queued',
      questions: [
        {
          template: 'reading',
          prompt: expression,
          answers: ['げんそく'],
          targets: [{ expression, skill: 'reading' }],
        },
      ],
    });
  }

  it('still count as new on the Words page', () => {
    queue('原則');
    expect(wordStatuses(db).has('原則')).toBe(false);
    expect(jlptSummary(db, list).find((s) => s.level === 1)?.learning).toBe(0);
  });

  it('are not picked again for the next test', () => {
    queue('原則');
    const picked = pickNewWords(db, 1, 10, () => 0.5, list).map(
      (w) => w.expression,
    );
    expect(picked).not.toContain('原則');
  });
});
