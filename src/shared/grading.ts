import type { MultipleChoiceQuestion, ReadingQuestion } from './test-schema';

export type Hint = 'small-tsu' | 'small-ya' | 'voiced-marks' | 'vowel-length';

export type GradeResult = {
  correct: boolean;
  expected: string;
  hint?: Hint;
};

export function gradeMultipleChoice(
  question: MultipleChoiceQuestion,
  choice: number,
): GradeResult {
  return {
    correct: choice === question.answer_index,
    expected: question.options[question.answer_index],
  };
}

export function gradeReading(
  question: ReadingQuestion,
  answer: string,
): GradeResult {
  const given = normalizeKana(answer);
  const accepted = question.answers.map(normalizeKana);
  const expected = question.answers[0];

  if (accepted.includes(given)) {
    return { correct: true, expected };
  }
  return { correct: false, expected, hint: nearMissHint(given, accepted) };
}

export function normalizeKana(text: string): string {
  return text
    .normalize('NFC')
    .trim()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const SMALL_TO_LARGE: Record<string, string> = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' };

const NEAR_MISSES: [hint: Hint, simplify: (s: string) => string][] = [
  ['small-tsu', (s) => s.replace(/っ/g, '')],
  ['small-ya', (s) => s.replace(/[ゃゅょ]/g, (c) => SMALL_TO_LARGE[c])],
  ['voiced-marks', (s) => s.normalize('NFD').replace(/[゙゚]/g, '')],
  ['vowel-length', (s) => s.replace(/[うー]/g, '')],
];

function nearMissHint(given: string, accepted: string[]): Hint | undefined {
  for (const [hint, simplify] of NEAR_MISSES) {
    if (accepted.some((answer) => simplify(answer) === simplify(given))) {
      return hint;
    }
  }
  return undefined;
}
