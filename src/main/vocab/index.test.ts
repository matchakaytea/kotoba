import { describe, expect, it } from 'vitest';
import { VOCAB, searchVocab } from './index';

describe('searchVocab on the real deck', () => {
  it('has all the entries', () => {
    expect(VOCAB.length).toBe(10641);
  });
  it('filters by level', () => {
    const page = searchVocab({ level: 1, offset: 0, limit: 5 });
    expect(page.total).toBe(4045);
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
  it('finds a word by its reading and pages the results', () => {
    expect(
      searchVocab({ search: 'こうこう', offset: 0, limit: 50 }).entries[0]
        .expression,
    ).toBe('高校');
    const first = searchVocab({ offset: 0, limit: 10 });
    const second = searchVocab({ offset: 10, limit: 10 });
    expect(second.entries[0].id).not.toBe(first.entries[0].id);
    expect(first.total).toBe(10641);
  });
});
