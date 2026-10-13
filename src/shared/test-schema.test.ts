import { describe, it, expect } from 'vitest';
import { LangTest } from './test-schema';

// A known-good test. Each test copies it and breaks one thing.
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

describe('LangTest schema', () => {
  it('accepts a valid test', () => {
    const result = LangTest.safeParse(validTest);
    expect(result.success).toBe(true);
  });

  it('rejects a question with only one option', () => {
    const broken = structuredClone(validTest);
    broken.questions[0].options = ['デプロイ'];
    expect(LangTest.safeParse(broken).success).toBe(false);
  });

  it('rejects a question with no targets', () =>{
    const broken = structuredClone(validTest);
    broken.questions[0].targets = [];
    expect(LangTest.safeParse(broken).success).toBe(false);
  });

  it('rejects a question with an typo in key', () =>{
    const broken = structuredClone(validTest);
    (broken.questions[0] as any).answr_index = 1;
    expect(LangTest.safeParse(broken).success).toBe(false);
  });
});