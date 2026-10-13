import { describe, it, expect } from 'vitest';
import { LangTest } from './test-schema';

const validTest = {
  format: 'langtest',
  format_version: 1,
  test_id: 'sample-1',
  language: 'ja',
  title: 'Sample',
  questions: [
    {
      template: 'multiple_choice',
      prompt: "Which word means 'deploy'?",
      options: ['導入', 'デプロイ', '復旧'],
      answer_index: 1,
      targets: [{ expression: 'デプロイ', skill: 'meaning' }],
    },
  ],
};

function parseWith(change: (test: any) => void) {
  const test = structuredClone(validTest);
  change(test);
  return LangTest.safeParse(test);
}

describe('LangTest schema', () => {
  it('accepts a valid test', () => {
    expect(LangTest.safeParse(validTest).success).toBe(true);
  });

  it.each([
    ['exactly 2 options', (t: any) => (t.questions[0].options = ['導入', 'デプロイ'])],
    ['exactly 6 options', (t: any) => (t.questions[0].options = ['a', 'b', 'c', 'd', 'e', 'f'])],
    ['answer_index 0', (t: any) => (t.questions[0].answer_index = 0)],
    ['answer_index on the last option', (t: any) => (t.questions[0].answer_index = 2)],
    ['a target with a reading', (t: any) => (t.questions[0].targets[0].reading = 'でぷろい')],
  ])('accepts %s', (_name, change) => {
    expect(parseWith(change).success).toBe(true);
  });

  it.each([
    // options
    ['1 option', (t: any) => (t.questions[0].options = ['デプロイ']), ['questions', 0, 'options']],
    ['7 options', (t: any) => (t.questions[0].options = ['a', 'b', 'c', 'd', 'e', 'f', 'g']), ['questions', 0, 'options']],
    ['an empty option', (t: any) => (t.questions[0].options[0] = ''), ['questions', 0, 'options', 0]],
    ['duplicate options', (t: any) => (t.questions[0].options = ['復旧', '復旧', 'デプロイ']), ['questions', 0, 'options']],
    // answer_index
    ['answer_index equal to options.length', (t: any) => (t.questions[0].answer_index = 3), ['questions', 0, 'answer_index']],
    ['answer_index far out of range', (t: any) => (t.questions[0].answer_index = 7), ['questions', 0, 'answer_index']],
    ['a negative answer_index', (t: any) => (t.questions[0].answer_index = -1), ['questions', 0, 'answer_index']],
    ['a fractional answer_index', (t: any) => (t.questions[0].answer_index = 1.5), ['questions', 0, 'answer_index']],
    // targets
    ['no targets', (t: any) => (t.questions[0].targets = []), ['questions', 0, 'targets']],
    ['an unknown skill', (t: any) => (t.questions[0].targets[0].skill = 'listening'), ['questions', 0, 'targets', 0, 'skill']],
    ['an empty reading', (t: any) => (t.questions[0].targets[0].reading = ''), ['questions', 0, 'targets', 0, 'reading']],
    // the test file itself
    ['a wrong format', (t: any) => (t.format = 'something-else'), ['format']],
    ['an unsupported format_version', (t: any) => (t.format_version = 2), ['format_version']],
    ['an unsupported language', (t: any) => (t.language = 'es'), ['language']],
    ['no questions', (t: any) => (t.questions = []), ['questions']],
  ])('rejects %s', (_name, change, path) => {
    const result = parseWith(change);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(path);
  });

  it('rejects an unknown key (typo)', () => {
    const result = parseWith((t) => (t.questions[0].answr_index = 1));
    const issue = result.error?.issues[0];
    expect(issue?.code).toBe('unrecognized_keys');
    expect(issue?.path).toEqual(['questions', 0]);
  });

  it('explains an out-of-range answer_index', () => {
    const result = parseWith((t) => (t.questions[0].answer_index = 3));
    expect(result.error?.issues[0].message).toBe('answer_index must point to one of the options');
  });
});
