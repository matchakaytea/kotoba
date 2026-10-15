import { describe, expect, it } from 'vitest';
import type { LangTest } from './test-schema';
import { checkTranslation } from './translation-check';

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
      options: [
        'A resignation letter',
        'A handover of duties',
        'An expense report',
      ],
      answer_index: 1,
      targets: [
        { expression: '引き継ぎ', reading: 'ひきつぎ', skill: 'meaning' },
      ],
    },
    {
      template: 'multiple_choice',
      prompt: "Which word means 'bug'?",
      options: ['設定', '不具合', '運用'],
      answer_index: 1,
      targets: [{ expression: '不具合', skill: 'meaning' }],
    },
    {
      template: 'reading',
      prompt: '復旧',
      context: 'システムが復旧した。',
      answers: ['ふっきゅう'],
      targets: [{ expression: '復旧', skill: 'reading' }],
    },
  ],
};

function translated(change: (test: LangTest) => void = () => {}): LangTest {
  const test = structuredClone(original);
  test.title = 'IT 交接';
  const [first, second] = test.questions;
  if (first.template === 'multiple_choice') {
    first.prompt = '同事准备了一份引き継ぎ文件。引き継ぎ是什么意思？';
    first.options = ['辞职信', '工作交接', '报销单'];
  }
  if (second.template === 'multiple_choice') {
    second.prompt = '哪个词的意思是"bug"？';
  }
  change(test);
  return test;
}

describe('checkTranslation', () => {
  it('accepts a proper translation', () => {
    expect(checkTranslation(original, translated())).toEqual([]);
  });

  it('rejects a changed answer', () => {
    const problems = checkTranslation(
      original,
      translated((t) => {
        if (t.questions[0].template === 'multiple_choice')
          t.questions[0].answer_index = 0;
      }),
    );
    expect(problems).toEqual(['Question 1: answer_index changed']);
  });

  it('rejects a changed Japanese option', () => {
    const problems = checkTranslation(
      original,
      translated((t) => {
        if (t.questions[1].template === 'multiple_choice')
          t.questions[1].options[0] = '设定';
      }),
    );
    expect(problems).toEqual(['Question 2: Japanese option 1 changed']);
  });

  it('rejects a prompt that lost the Japanese word', () => {
    const problems = checkTranslation(
      original,
      translated((t) => {
        if (t.questions[0].template === 'multiple_choice')
          t.questions[0].prompt = '交接是什么意思？';
      }),
    );
    expect(problems).toEqual([
      'Question 1: Japanese text “引き継ぎ” missing from the prompt',
    ]);
  });

  it('rejects any change to a reading question', () => {
    const problems = checkTranslation(
      original,
      translated((t) => {
        if (t.questions[2].template === 'reading')
          t.questions[2].answers = ['ふくきゅう'];
      }),
    );
    expect(problems).toEqual(['Question 3: reading question changed']);
  });

  it('rejects changed targets, ids and question counts', () => {
    expect(
      checkTranslation(
        original,
        translated((t) => (t.questions[0].targets[0].expression = '交接')),
      ),
    ).toEqual(['Question 1: targets changed']);
    expect(
      checkTranslation(
        original,
        translated((t) => (t.test_id = 'other')),
      ),
    ).toEqual(['test_id changed']);
    expect(
      checkTranslation(
        original,
        translated((t) => t.questions.pop()),
      ),
    ).toEqual(['question count changed from 3 to 2']);
  });
});
