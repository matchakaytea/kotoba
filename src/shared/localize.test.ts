import { describe, expect, it } from 'vitest';
import {
  describeMistake,
  localizeQuestion,
  localizeTitle,
  missingLanguages,
} from './localize';
import type { MultipleChoiceQuestion, ReadingQuestion } from './test-schema';

const meaning: MultipleChoiceQuestion = {
  template: 'multiple_choice',
  prompt: 'What does 引き継ぎ mean?',
  options: ['A handover', 'A resignation'],
  answer_index: 0,
  targets: [{ expression: '引き継ぎ', skill: 'meaning' }],
  i18n: {
    'zh-Hans': {
      prompt: '引き継ぎ是什么意思？',
      options: ['工作交接', '辞职'],
    },
    ko: { prompt: '引き継ぎ는 무슨 뜻인가요?', options: ['업무 인계', '사직'] },
  },
};

const wordChoice: MultipleChoiceQuestion = {
  template: 'multiple_choice',
  prompt: "Which word means 'bug'?",
  options: ['設定', '不具合'],
  answer_index: 1,
  targets: [{ expression: '不具合', skill: 'meaning' }],
  i18n: { 'zh-Hans': { prompt: '哪个词的意思是"bug"？' } },
};

const reading: ReadingQuestion = {
  template: 'reading',
  prompt: '復旧',
  answers: ['ふっきゅう'],
  targets: [{ expression: '復旧', skill: 'reading' }],
};

describe('localizeQuestion', () => {
  it('uses the translated prompt and options', () => {
    expect(localizeQuestion(meaning, 'zh-Hans')).toMatchObject({
      prompt: '引き継ぎ是什么意思？',
      options: ['工作交接', '辞职'],
      answer_index: 0,
    });
  });

  it('keeps the Japanese options when only the prompt is translated', () => {
    expect(localizeQuestion(wordChoice, 'zh-Hans').options).toEqual([
      '設定',
      '不具合',
    ]);
  });

  it('falls back to the original text when a language is missing', () => {
    expect(localizeQuestion(meaning, 'zh-Hant')).toBe(meaning);
  });

  it('leaves reading questions alone', () => {
    expect(localizeQuestion(reading, 'ko')).toBe(reading);
  });
});

describe('localizeTitle', () => {
  it('uses the translation when there is one', () => {
    expect(localizeTitle('IT words', { ko: 'IT 단어' }, 'ko')).toBe('IT 단어');
    expect(localizeTitle('IT words', { ko: 'IT 단어' }, 'en')).toBe('IT words');
  });
});

describe('missingLanguages', () => {
  it('lists languages without a title or with an untranslated question', () => {
    const test = {
      title_i18n: { en: 'IT', 'zh-Hans': 'IT', ko: 'IT' },
      questions: [meaning, wordChoice, reading],
    };
    expect(missingLanguages(test, ['en', 'zh-Hans', 'zh-Hant', 'ko'])).toEqual([
      'en',
      'zh-Hant',
      'ko',
    ]);
  });

  it('ignores reading questions, which have nothing to translate', () => {
    const test = { title_i18n: { en: 'IT' }, questions: [reading] };
    expect(missingLanguages(test, ['en'])).toEqual([]);
  });
});

describe('describeMistake', () => {
  it('shows a multiple-choice mistake in the chosen language', () => {
    expect(describeMistake(meaning, 'A resignation', 'zh-Hans')).toEqual({
      prompt: '引き継ぎ是什么意思？',
      answer: '辞职',
      expected: '工作交接',
    });
  });

  it('falls back to the original text', () => {
    expect(describeMistake(meaning, 'A resignation', 'en')).toEqual({
      prompt: 'What does 引き継ぎ mean?',
      answer: 'A resignation',
      expected: 'A handover',
    });
  });

  it('shows reading mistakes with all accepted readings', () => {
    expect(describeMistake(reading, 'ふきゅう', 'ko')).toEqual({
      prompt: '復旧',
      answer: 'ふきゅう',
      expected: 'ふっきゅう',
    });
  });

  it('copes with a question that no longer exists', () => {
    expect(describeMistake(null, 'ふきゅう', 'en')).toEqual({
      prompt: null,
      answer: 'ふきゅう',
      expected: null,
    });
  });
});
