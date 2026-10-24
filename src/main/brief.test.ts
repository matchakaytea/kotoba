import { describe, expect, it } from 'vitest';
import { briefPrompt, buildBrief, missingNewWords } from './brief';
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

describe('buildBrief with saved settings', () => {
  it('uses the level, topics and question count from Settings', async () => {
    const { saveSettings } = await import('./database');
    const db = databaseWithMistake();
    saveSettings(db, {
      language: 'en',
      targetLanguage: 'ja',
      level: 'JLPT N1',
      topics: ['finance'],
      questionCount: 25,
    });
    const brief = buildBrief(db, tuesday);
    expect(brief.learner).toMatchObject({
      level: 'JLPT N1',
      topics: ['finance'],
    });
    expect(brief.question_count).toBe(25);
    expect(briefPrompt(brief)).toContain(
      'learner JLPT N1, on these topics: finance',
    );
  });
});

describe('briefPrompt language', () => {
  it('asks for prompts in English by default', () => {
    const prompt = briefPrompt(buildBrief(databaseWithMistake(), tuesday));
    expect(prompt).toContain('and the "title" in English');
  });

  it('asks for prompts in the chosen app language', async () => {
    const { saveSettings, getSettings } = await import('./database');
    const db = databaseWithMistake();
    saveSettings(db, { ...getSettings(db), language: 'zh-Hant' });
    const prompt = briefPrompt(buildBrief(db, tuesday));
    expect(prompt).toContain(
      'every option that is a meaning or explanation, and the "title" in Traditional Chinese',
    );
    expect(prompt).toContain('Never write prompts or meanings in English');
  });
});

describe('missingNewWords', () => {
  const word = (expression: string) => ({
    expression,
    readings: ['よみ'],
    jlpt: 'N2',
    meaning: 'meaning',
    meaning_zh_hans: '含义',
    meaning_zh_hant: '含義',
  });
  const brief = { new_words: [word('復旧'), word('抑制')] };

  it('reports new words no question targets', () => {
    const reply = JSON.stringify({
      questions: [
        {
          targets: [
            { expression: '復旧', reading: 'ふっきゅう', skill: 'reading' },
          ],
        },
      ],
    });
    expect(missingNewWords(brief, reply).map((w) => w.expression)).toEqual([
      '抑制',
    ]);
  });

  it('ignores bracket readings when matching', () => {
    const reply = JSON.stringify({
      questions: [
        {
          targets: [
            {
              expression: '復旧[ふっきゅう]',
              reading: 'ふっきゅう',
              skill: 'reading',
            },
          ],
        },
        {
          targets: [
            { expression: '抑制', reading: 'よくせい', skill: 'reading' },
          ],
        },
      ],
    });
    expect(missingNewWords(brief, reply)).toEqual([]);
  });

  it('treats a reply that is not JSON as missing every word', () => {
    expect(missingNewWords(brief, 'not json')).toHaveLength(2);
  });
});
