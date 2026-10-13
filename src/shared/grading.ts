import type { MultipleChoiceQuestion, ReadingQuestion } from './test-schema';

export type GradeResult = {
  correct: boolean;
  expected: string;
  hint?: string;
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

const NEAR_MISSES: [hint: string, simplify: (s: string) => string][] = [
  ['Check the small っ (double consonant).', (s) => s.replace(/っ/g, '')],
  [
    'Check small ゃ / ゅ / ょ.',
    (s) => s.replace(/[ゃゅょ]/g, (c) => SMALL_TO_LARGE[c]),
  ],
  [
    'Check the voiced marks ゛ and ゜.',
    (s) => s.normalize('NFD').replace(/[゙゚]/g, ''),
  ],
  ['Check the vowel length.', (s) => s.replace(/[うー]/g, '')],
];

function nearMissHint(given: string, accepted: string[]): string | undefined {
  for (const [hint, simplify] of NEAR_MISSES) {
    if (accepted.some((answer) => simplify(answer) === simplify(given))) {
      return hint;
    }
  }
  return undefined;
}
