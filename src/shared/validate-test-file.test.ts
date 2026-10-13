import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { validateTestFile } from './validate-test-file';

const sample = readFileSync('samples/it-n2.json', 'utf8');

function errorsFor(change: (test: any) => void): string[] {
  const test = JSON.parse(sample);
  change(test);
  const result = validateTestFile(JSON.stringify(test));
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors;
}

describe('validateTestFile', () => {
  it('accepts the sample file', () => {
    const result = validateTestFile(sample);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.test.questions).toHaveLength(5);
    }
  });

  it('reports broken JSON', () => {
    const result = validateTestFile('{ "format": ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/^Not valid JSON/);
    }
  });

  it('reports question errors in readable form', () => {
    const errors = errorsFor((t) => (t.questions[1].answers = ['fukkyuu']));
    expect(errors).toContain(
      'Question 2 → answers[0]: answers must be kana only',
    );
  });

  it('formats nested paths with brackets and dots', () => {
    const errors = errorsFor(
      (t) => (t.questions[0].targets[0].skill = 'listening'),
    );
    expect(errors[0]).toMatch(/^Question 1 → targets\[0\]\.skill: /);
  });

  it('reports errors outside the questions', () => {
    const errors = errorsFor((t) => (t.format = 'wrong'));
    expect(errors[0]).toMatch(/^format: /);
  });

  it('reports every problem, not just the first', () => {
    const errors = errorsFor((t) => {
      t.format = 'wrong';
      t.questions[1].answers = ['fukkyuu'];
    });
    expect(errors).toHaveLength(2);
  });
});
