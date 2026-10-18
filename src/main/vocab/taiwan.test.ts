import { describe, expect, it } from 'vitest';
import { taiwanEntry, taiwanese } from './taiwan';
import { parseNotes } from './eggrolls';
import fs from 'node:fs';

describe('taiwanese', () => {
  it('swaps mainland words for Taiwanese ones', () => {
    expect(taiwanese('騎自行車去郊遊')).toBe('騎腳踏車去郊遊');
    expect(taiwanese('安裝空調')).toBe('安裝冷氣');
    expect(taiwanese('支付工資')).toBe('支付薪資');
  });
  it('rewrites texts where a swap would repeat a word', () => {
    expect(taiwanese('默認，預設；基本狀態')).toBe('預設；基本狀態');
    expect(taiwanese('站台，月台')).toBe('月台');
  });
  it('keeps the physics sense of 質量 and leaves other text alone', () => {
    expect(taiwanese('（物理）質量；質和量')).toBe('（物理）質量；質和量');
    expect(taiwanese('計程車')).toBe('計程車');
  });
  it('does not double up words that are already Taiwanese', () => {
    expect(taiwanese('小黃瓜')).toBe('小黃瓜');
    expect(taiwanese('黃瓜')).toBe('小黃瓜');
  });
});

describe('taiwanEntry on the real deck', () => {
  const MAINLAND = ['自行車', '塑料', '網絡', '空調', '摩托車', '工資', '默認'];
  it('leaves no mainland words in Traditional Chinese', () => {
    const entries = parseNotes(
      fs.readFileSync('data/eggrolls/notes.csv', 'utf8'),
    ).map(taiwanEntry);
    const texts = entries.flatMap((e) => [
      e.meaningTc,
      ...e.examples.map((x) => x.tc),
    ]);
    for (const word of MAINLAND) {
      expect(texts.filter((t) => t.includes(word))).toEqual([]);
    }
  });
});
