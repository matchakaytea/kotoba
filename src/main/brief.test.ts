import { describe, expect, it } from 'vitest';
import { briefPrompt, buildBrief } from './brief';
import { openDatabase, recordAttempt } from './database';

const monday = new Date(2026, 9, 12, 9, 0);
const tuesday = new Date(2026, 9, 13, 9, 0);

function databaseWithMistake() {
  const db = openDatabase(':memory:');
  recordAttempt(
    db,
    {
      testId: 'sample',
      questionIndex: 0,
      template: 'reading',
      answer: 'ふきゅう',
      correct: false,
      targets: [
        { expression: '復旧', reading: 'ふっきゅう', skill: 'reading' },
      ],
    },
    monday,
  );
  return db;
}

describe('buildBrief', () => {
  it('lists due targets with their status', () => {
    const brief = buildBrief(databaseWithMistake(), tuesday);
    expect(brief.date).toBe('2026-10-13');
    expect(brief.due_targets).toEqual([
      {
        expression: '復旧',
        reading: 'ふっきゅう',
        skill: 'reading',
        status: 'due',
      },
    ]);
  });

  it('includes recent mistakes with the wrong answer', () => {
    const brief = buildBrief(databaseWithMistake(), tuesday);
    expect(brief.recent_mistakes).toEqual([
      expect.objectContaining({
        expression: '復旧',
        skill: 'reading',
        answer: 'ふきゅう',
      }),
    ]);
  });
});

describe('briefPrompt', () => {
  it('contains the rules, the JSON schema and the brief', () => {
    const prompt = briefPrompt(buildBrief(databaseWithMistake(), tuesday));
    expect(prompt).toContain('Return ONLY one JSON object');
    expect(prompt).toContain('"additionalProperties": false');
    expect(prompt).toContain('"due_targets"');
    expect(prompt).toContain('claude-2026-10-13-');
  });
});
