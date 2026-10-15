import { describe, it, expect } from 'vitest';
import { gradeMultipleChoice, gradeReading, normalizeKana } from './grading';
import type { MultipleChoiceQuestion, ReadingQuestion } from './test-schema';

const mc: MultipleChoiceQuestion = {
  template: 'multiple_choice',
  prompt: "Which word means 'bug / defect'?",
  options: ['設定', '不具合', '運用'],
  answer_index: 1,
  targets: [{ expression: '不具合', skill: 'meaning' }],
};

function reading(...answers: string[]): ReadingQuestion {
  return {
    template: 'reading',
    prompt: '漢字',
    answers,
    targets: [{ expression: '漢字', skill: 'reading' }],
  };
}

describe('gradeMultipleChoice', () => {
  it('marks the right option correct', () => {
    expect(gradeMultipleChoice(mc, 1)).toEqual({
      correct: true,
      expected: '不具合',
    });
  });

  it('marks another option wrong and shows the right one', () => {
    expect(gradeMultipleChoice(mc, 0)).toEqual({
      correct: false,
      expected: '不具合',
    });
  });
});

describe('normalizeKana', () => {
  it.each([
    ['フッキュウ', 'ふっきゅう'],
    ['  ふっきゅう　', 'ふっきゅう'],
    ['サーバー', 'さーばー'],
    ['が', 'が'],
  ])('%s → %s', (input, output) => {
    expect(normalizeKana(input)).toBe(output);
  });
});

describe('gradeReading', () => {
  it.each([
    ['the exact reading', 'ふっきゅう'],
    ['katakana', 'フッキュウ'],
    ['surrounding spaces', ' ふっきゅう '],
  ])('accepts %s', (_name, answer) => {
    expect(gradeReading(reading('ふっきゅう'), answer).correct).toBe(true);
  });

  it('accepts any listed reading', () => {
    const question = reading('きょう', 'こんにち');
    expect(gradeReading(question, 'こんにち').correct).toBe(true);
  });

  it('shows the first reading as the expected answer', () => {
    expect(gradeReading(reading('きょう', 'こんにち'), 'あした').expected).toBe(
      'きょう',
    );
  });

  it.each([
    ['a missing small っ', 'ふっきゅう', 'ふきゅう', 'small-tsu'],
    ['a large よ instead of ょ', 'しょうがい', 'しようがい', 'small-ya'],
    ['a missing dakuten', 'しょうがい', 'しょうかい', 'voiced-marks'],
    ['a short vowel', 'ふっきゅう', 'ふっきゅ', 'vowel-length'],
  ])('rejects %s with a hint', (_name, expected, answer, hint) => {
    const result = gradeReading(reading(expected), answer);
    expect(result.correct).toBe(false);
    expect(result.hint).toBe(hint);
  });

  it('gives no hint for an unrelated answer', () => {
    const result = gradeReading(reading('ふっきゅう'), 'かんきょう');
    expect(result.correct).toBe(false);
    expect(result.hint).toBeUndefined();
  });
});
