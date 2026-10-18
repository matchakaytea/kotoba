import { describe, expect, it } from 'vitest';
import { gradeRecall } from './grading';
import {
  describeMistake,
  localizeQuestion,
  missingLanguages,
} from './localize';
import { LangTest, type RecallQuestion } from './test-schema';
import { checkAddedTranslations } from './translation-check';

const question: RecallQuestion = {
  template: 'recall',
  prompt: '交货期限',
  context: '＿＿に間に合わせる',
  answers: ['納期', 'のうき'],
  targets: [{ expression: '納期', reading: 'のうき', skill: 'production' }],
  i18n: { en: { prompt: 'delivery deadline' } },
};

const test = (questions: unknown[]) => ({
  format: 'langtest',
  format_version: 1,
  test_id: 'r',
  language: 'ja',
  title: 'Recall',
  questions,
});

describe('recall questions', () => {
  it('are valid tests, and need a kana reading among the answers', () => {
    expect(LangTest.safeParse(test([question])).success).toBe(true);
    const noKana = { ...question, answers: ['納期'] };
    expect(LangTest.safeParse(test([noKana])).success).toBe(false);
  });

  it('accept the reading in hiragana or katakana, or the word itself', () => {
    expect(gradeRecall(question, 'のうき').correct).toBe(true);
    expect(gradeRecall(question, 'ノウキ').correct).toBe(true);
    expect(gradeRecall(question, '納期').correct).toBe(true);
    expect(gradeRecall(question, 'のき')).toMatchObject({
      correct: false,
      expected: '納期 / のうき',
      hint: 'vowel-length',
    });
  });

  it('show the prompt in the app language', () => {
    expect(localizeQuestion(question, 'en').prompt).toBe('delivery deadline');
    expect(localizeQuestion(question, 'zh-Hans').prompt).toBe('交货期限');
    expect(describeMistake(question, 'のき', 'en')).toEqual({
      prompt: 'delivery deadline',
      answer: 'のき',
      expected: '納期 / のうき',
    });
  });

  it('count as missing a language until they have its prompt', () => {
    const parsed = LangTest.parse({
      ...test([question]),
      title_i18n: { en: 'Recall', ko: '회상' },
    });
    expect(missingLanguages(parsed, ['en', 'ko'])).toEqual(['ko']);
    const translated = LangTest.parse({
      ...test([
        { ...question, i18n: { ...question.i18n, ko: { prompt: '납기' } } },
      ]),
      title_i18n: { en: 'Recall', ko: '회상' },
    });
    expect(checkAddedTranslations(parsed, translated, ['ko'])).toEqual([]);
    expect(
      checkAddedTranslations(
        parsed,
        { ...parsed, title_i18n: { en: 'Recall', ko: '회상' } },
        ['ko'],
      ),
    ).toEqual(['Question 1: ko missing']);
  });
});
