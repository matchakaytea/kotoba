import { describe, expect, it } from 'vitest';
import type { LangTest } from './test-schema';
import { checkAddedTranslations } from './translation-check';

const original: LangTest = {
  format: 'langtest',
  format_version: 1,
  test_id: 't',
  language: 'ja',
  title: 'IT handovers',
  questions: [
    {
      template: 'multiple_choice',
      prompt: 'A colleague prepares an 引き継ぎ document. What is 引き継ぎ?',
      options: ['A resignation letter', 'A handover of duties'],
      answer_index: 1,
      targets: [
        { expression: '引き継ぎ', reading: 'ひきつぎ', skill: 'meaning' },
      ],
    },
    {
      template: 'multiple_choice',
      prompt: "Which word means 'bug'?",
      options: ['設定', '不具合'],
      answer_index: 1,
      targets: [{ expression: '不具合', skill: 'meaning' }],
    },
    {
      template: 'reading',
      prompt: '復旧',
      answers: ['ふっきゅう'],
      targets: [{ expression: '復旧', skill: 'reading' }],
    },
  ],
};

function withTranslations(
  change: (test: LangTest) => void = () => {},
): LangTest {
  const test = structuredClone(original);
  test.title_i18n = { 'zh-Hans': 'IT 交接' };
  const [first, second] = test.questions;
  if (first.template === 'multiple_choice') {
    first.i18n = {
      'zh-Hans': {
        prompt: '同事准备了一份引き継ぎ文件。引き継ぎ是什么意思？',
        options: ['辞职信', '工作交接'],
      },
    };
  }
  if (second.template === 'multiple_choice') {
    second.i18n = { 'zh-Hans': { prompt: '哪个词的意思是"bug"？' } };
  }
  change(test);
  return test;
}

const check = (updated: LangTest) =>
  checkAddedTranslations(original, updated, ['zh-Hans']);

describe('checkAddedTranslations', () => {
  it('accepts added translations', () => {
    expect(check(withTranslations())).toEqual([]);
  });

  it('rejects any change outside the new translations', () => {
    expect(
      check(
        withTranslations((t) => {
          if (t.questions[0].template === 'multiple_choice')
            t.questions[0].answer_index = 0;
        }),
      ),
    ).toEqual(['the test itself changed, not just the translations']);
    expect(check(withTranslations((t) => (t.title = 'Other')))).toEqual([
      'the test itself changed, not just the translations',
    ]);
    expect(
      check(
        withTranslations((t) => {
          if (t.questions[2].template === 'reading')
            t.questions[2].answers = ['ふくきゅう'];
        }),
      ),
    ).toEqual(['the test itself changed, not just the translations']);
  });

  it('rejects changes to translations that already existed', () => {
    const base = withTranslations();
    const updated = structuredClone(base);
    updated.title_i18n = {
      ...updated.title_i18n,
      ko: 'IT 인계',
      'zh-Hans': '改了',
    };
    const [first, second] = updated.questions;
    if (
      first.template === 'multiple_choice' &&
      second.template === 'multiple_choice'
    ) {
      first.i18n = {
        ...first.i18n,
        ko: {
          prompt: '引き継ぎ는 무엇인가요?',
          options: ['사직서', '업무 인계'],
        },
      };
      second.i18n = {
        ...second.i18n,
        ko: { prompt: '"bug"를 뜻하는 단어는?' },
      };
    }
    expect(checkAddedTranslations(base, updated, ['ko'])).toEqual([
      'the test itself changed, not just the translations',
    ]);
  });

  it('reports missing languages', () => {
    expect(
      check(
        withTranslations((t) => {
          t.title_i18n = undefined;
          if (t.questions[1].template === 'multiple_choice')
            t.questions[1].i18n = undefined;
        }),
      ),
    ).toEqual(['title: zh-Hans missing', 'Question 2: zh-Hans missing']);
  });

  it('rejects a translated prompt that lost the Japanese word', () => {
    expect(
      check(
        withTranslations((t) => {
          if (t.questions[0].template === 'multiple_choice')
            t.questions[0].i18n!['zh-Hans']!.prompt = '交接是什么意思？';
        }),
      ),
    ).toEqual(['Question 1: zh-Hans prompt lost “引き継ぎ”']);
  });

  it('rejects translated Japanese options', () => {
    expect(
      check(
        withTranslations((t) => {
          if (t.questions[1].template === 'multiple_choice')
            t.questions[1].i18n!['zh-Hans']!.options = ['设定', '不具合'];
        }),
      ),
    ).toEqual(['Question 2: zh-Hans changed Japanese option 1']);
  });
});

describe('checkAddedTranslations and field order', () => {
  it('does not care in which order Claude writes the fields', () => {
    const reordered = JSON.parse(
      JSON.stringify(original, [
        'questions',
        'title',
        'test_id',
        'language',
        'format_version',
        'format',
        'targets',
        'skill',
        'reading',
        'expression',
        'answer_index',
        'options',
        'prompt',
        'template',
        'answers',
      ]),
    ) as LangTest;
    reordered.title_i18n = { ko: 'IT 인계' };
    const [first, second] = reordered.questions;
    if (
      first.template === 'multiple_choice' &&
      second.template === 'multiple_choice'
    ) {
      first.i18n = {
        ko: {
          options: ['사직서', '업무 인계'],
          prompt: '引き継ぎ는 무엇인가요?',
        },
      };
      second.i18n = { ko: { prompt: '"bug"를 뜻하는 단어는?' } };
    }
    expect(checkAddedTranslations(original, reordered, ['ko'])).toEqual([]);
  });
});
