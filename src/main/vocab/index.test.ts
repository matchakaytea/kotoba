import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import type { VocabEntry } from '../../shared/api';
import { briefPrompt, buildBrief } from '../brief';
import {
  getSettings,
  openDatabase,
  recordAttempt,
  saveSettings,
  saveTest,
} from '../database';
import {
  VOCAB,
  levelOf,
  pickNewWords,
  searchVocab,
  vocabSummary,
  wordStatuses,
} from './index';

describe('searchVocab on the real list', () => {
  it('has the deck and the JLPT list in it', () => {
    expect(VOCAB.length).toBe(12610);
    expect(VOCAB.filter((e) => e.source === 'jlpt').length).toBe(1969);
  });
  it('has all three meanings for every entry', () => {
    expect(
      VOCAB.filter((e) => !e.meaningEn || !e.meaningSc || !e.meaningTc),
    ).toEqual([]);
  });
  it('filters by level', () => {
    const page = searchVocab({ level: 1, offset: 0, limit: 5 });
    expect(page.total).toBe(5078);
    expect(page.entries.every((e) => e.level === 1)).toBe(true);
  });
  it('filters by frequency tier within a level', () => {
    const page = searchVocab({ level: 3, tier: 'high', offset: 0, limit: 200 });
    expect(page.total).toBe(380);
    expect(page.entries.every((e) => e.tier === 'high')).toBe(true);
  });
  it('finds a word by its Chinese meaning', () => {
    const page = searchVocab({ search: '高中', offset: 0, limit: 50 });
    expect(page.entries.map((e) => e.expression)).toContain('高校');
  });
  it('finds a word by its English meaning, ignoring case', () => {
    const page = searchVocab({ search: 'High School', offset: 0, limit: 50 });
    expect(page.entries.map((e) => e.expression)).toContain('高校');
  });
  it('finds a word by another spelling', () => {
    const page = searchVocab({ search: '美味しい', offset: 0, limit: 50 });
    expect(page.entries.map((e) => e.expression)).toContain('おいしい');
  });
  it('has words that only the JLPT list had', () => {
    const page = searchVocab({ search: 'お金', offset: 0, limit: 50 });
    expect(page.entries[0]).toMatchObject({
      expression: 'お金',
      meaningEn: 'money',
      level: 5,
    });
  });
  it('finds a word by its reading and pages the results', () => {
    expect(
      searchVocab({ search: 'こうこう', offset: 0, limit: 50 }).entries[0]
        .expression,
    ).toBe('高校');
    const first = searchVocab({ offset: 0, limit: 10 });
    const second = searchVocab({ offset: 10, limit: 10 });
    expect(second.entries[0].id).not.toBe(first.entries[0].id);
    expect(first.total).toBe(12610);
  });
});

const entry = (
  expression: string,
  level: VocabEntry['level'],
  spellings?: string[],
): VocabEntry => ({
  id: expression,
  expression,
  reading: '',
  pitch: '',
  partOfSpeech: '',
  meaningSc: '',
  meaningTc: '',
  meaningEn: expression === '現像' ? 'developing (film)' : '',
  level,
  sort: 0,
  examples: [],
  ...(spellings ? { spellings } : {}),
});

const list: VocabEntry[] = [
  entry('会う', 5),
  entry('おいしい', 5, ['美味しい']),
  entry('原則', 1),
  entry('見地', 1),
  entry('現像', 1),
];

let db: DatabaseSync;
beforeEach(() => {
  db = openDatabase(':memory:');
});

function practise(expression: string, correct: boolean, when: Date) {
  recordAttempt(
    db,
    {
      testId: 't',
      questionIndex: 0,
      template: 'reading',
      answer: 'x',
      correct,
      targets: [{ expression, skill: 'reading' }],
    },
    when,
  );
}

describe('levelOf', () => {
  it('reads the level setting', () => {
    expect(levelOf('around JLPT N2')).toBe(2);
    expect(levelOf('B1, strong reading')).toBeNull();
  });
});

describe('wordStatuses', () => {
  it('marks practised words as learning, and long intervals as known', () => {
    practise('会う', false, new Date(2026, 9, 1));
    practise('原則', true, new Date(2026, 9, 1));
    db.prepare(
      "UPDATE review_states SET due_day = '2026-11-01' WHERE target_id = (SELECT id FROM targets WHERE expression = '原則')",
    ).run();
    const statuses = wordStatuses(db);
    expect(statuses.get('会う')).toBe('learning');
    expect(statuses.get('原則')).toBe('known');
    expect(statuses.get('見地')).toBeUndefined();
  });
});

describe('progress in Vocabulary', () => {
  it('counts progress per level, including other spellings', () => {
    practise('原則', true, new Date(2026, 9, 1));
    practise('美味しい', true, new Date(2026, 9, 1));
    const summary = vocabSummary(wordStatuses(db), list);
    expect(summary.find((s) => s.level === 1)).toEqual({
      level: 1,
      total: 3,
      learning: 1,
      known: 0,
    });
    expect(summary.find((s) => s.level === 5)).toMatchObject({
      total: 2,
      learning: 1,
    });
  });

  it('shows each word’s status and filters by it', () => {
    practise('原則', true, new Date(2026, 9, 1));
    const statuses = wordStatuses(db);
    const query = { level: 1 as const, offset: 0, limit: 10 };
    expect(searchVocab({ ...query, status: 'new' }, statuses, list).total).toBe(
      2,
    );
    const page = searchVocab({ ...query, search: 'film' }, statuses, list);
    expect(page.entries).toMatchObject([{ expression: '現像', status: 'new' }]);
    expect(
      searchVocab({ ...query, status: 'learning' }, statuses, list).entries,
    ).toMatchObject([{ expression: '原則', status: 'learning' }]);
  });
});

describe('pickNewWords', () => {
  it('only picks unpractised words from the level', () => {
    practise('原則', true, new Date(2026, 9, 1));
    const picked = pickNewWords(db, 1, 10, () => 0.5, list).map(
      (w) => w.expression,
    );
    expect(picked.sort()).toEqual(['現像', '見地']);
  });

  it('skips words practised under another spelling', () => {
    practise('美味しい', true, new Date(2026, 9, 1));
    const picked = pickNewWords(db, 5, 10, () => 0.5, list).map(
      (w) => w.expression,
    );
    expect(picked).toEqual(['会う']);
  });

  it('returns at most the number asked for', () => {
    expect(pickNewWords(db, 1, 2, () => 0, list)).toHaveLength(2);
  });
});

describe('brief with the vocabulary list', () => {
  it('hands Claude new words from the chosen level', () => {
    const brief = buildBrief(db, new Date(2026, 9, 1), () => 0.3);
    expect(brief.word_list).toBe('JLPT N2');
    expect(brief.new_words).toHaveLength(15);
    expect(
      brief.new_words.every((w) =>
        VOCAB.some(
          (v) =>
            v.level === 2 &&
            v.expression.replace(/\[[^\]]*\]/g, '') === w.expression,
        ),
      ),
    ).toBe(true);
    expect(brief.new_words.every((w) => w.meaning && w.readings[0])).toBe(true);
    expect(briefPrompt(brief)).toContain('from the JLPT N2 vocabulary list');
  });

  it("lets Claude choose when the source is 'free' or the level is custom", () => {
    saveSettings(db, { ...getSettings(db), wordSource: 'free' });
    expect(buildBrief(db).new_words).toEqual([]);
    saveSettings(db, {
      ...getSettings(db),
      wordSource: 'jlpt',
      level: 'B1, strong reading',
    });
    const brief = buildBrief(db);
    expect(brief.new_words).toEqual([]);
    expect(briefPrompt(brief)).toContain(
      'new, useful words for a learner B1, strong reading',
    );
  });
});

describe('words that are in a test but not answered yet', () => {
  function queue(expression: string) {
    saveTest(db, {
      format: 'langtest',
      format_version: 1,
      test_id: `queued-${expression}`,
      language: 'ja',
      title: 'Queued',
      questions: [
        {
          template: 'reading',
          prompt: expression,
          answers: ['げんそく'],
          targets: [{ expression, skill: 'reading' }],
        },
      ],
    });
  }

  it('still count as new', () => {
    queue('原則');
    expect(wordStatuses(db).has('原則')).toBe(false);
    expect(
      vocabSummary(wordStatuses(db), list).find((s) => s.level === 1)?.learning,
    ).toBe(0);
  });

  it('are not picked again for the next test', () => {
    queue('原則');
    const picked = pickNewWords(db, 1, 10, () => 0.5, list).map(
      (w) => w.expression,
    );
    expect(picked).not.toContain('原則');
  });
});
