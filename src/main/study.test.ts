import { describe, expect, it } from 'vitest';
import type { LangTest } from '../shared/test-schema';
import {
  deleteTest,
  madeTestOn,
  openDatabase,
  recordAttempt,
  saveTest,
} from './database';
import { getStudyPlan } from './study';

const now = new Date(2026, 9, 24, 9, 0);

const test: LangTest = {
  format: 'langtest',
  format_version: 1,
  test_id: 'claude-2026-10-24-abcd',
  language: 'ja',
  title: 'Today',
  questions: [
    {
      template: 'reading',
      prompt: '高校',
      answers: ['こうこう'],
      targets: [{ expression: '高校', reading: 'こうこう', skill: 'reading' }],
    },
    {
      template: 'reading',
      prompt: '復旧',
      answers: ['ふっきゅう'],
      targets: [
        { expression: '復旧', reading: 'ふっきゅう', skill: 'reading' },
      ],
    },
  ],
};

function miss(questionIndex: number, expression: string, when: Date) {
  return {
    testId: test.test_id,
    questionIndex,
    template: 'reading' as const,
    answer: 'まちがい',
    correct: false,
    targets: [{ expression, skill: 'reading' as const }],
    when,
  };
}

describe('getStudyPlan', () => {
  it("shows the review's new words with their meaning and an example", () => {
    const db = openDatabase(':memory:');
    saveTest(db, test, now);
    const plan = getStudyPlan(db, now);
    expect(plan.words.map((w) => w.expression).sort()).toEqual([
      '復旧',
      '高校',
    ]);
    const school = plan.words.find((w) => w.expression === '高校')!;
    expect(school).toMatchObject({ reading: 'こうこう', level: 5 });
    expect(school.meaningSc).toContain('高中');
    expect(school.example?.kind).toBe('sentence');
    expect(plan.mistakes).toEqual([]);
  });

  it('asks each missed question once, and leaves reviewed words out', () => {
    const db = openDatabase(':memory:');
    saveTest(db, test, now);
    const { when, ...first } = miss(0, '高校', new Date(2026, 9, 22, 9, 0));
    recordAttempt(db, first, when);
    recordAttempt(db, first, new Date(2026, 9, 23, 9, 0));
    const plan = getStudyPlan(db, now);
    expect(plan.mistakes).toHaveLength(1);
    expect(plan.mistakes[0].question?.prompt).toBe('高校');
    expect(plan.words.map((w) => w.expression)).toEqual(['復旧']);
  });
});

describe('madeTestOn', () => {
  it("knows today's generated test, even after it was deleted", () => {
    const db = openDatabase(':memory:');
    expect(madeTestOn(db, '2026-10-24')).toBe(false);
    saveTest(db, test, now);
    expect(madeTestOn(db, '2026-10-24')).toBe(true);
    expect(madeTestOn(db, '2026-10-25')).toBe(false);
    deleteTest(db, test.test_id);
    expect(madeTestOn(db, '2026-10-24')).toBe(true);
  });
});
