import { describe, expect, it } from 'vitest';
import { buildWordList, cleanRow, parseCsv } from './clean';

describe('parseCsv', () => {
  it('handles quoted fields with commas and quotes', () => {
    expect(parseCsv('a,b\n会う,"to meet, to ""see"""\r\n')).toEqual([
      ['a', 'b'],
      ['会う', 'to meet, to "see"'],
    ]);
  });
});

describe('cleanRow', () => {
  it('keeps a normal word', () => {
    expect(cleanRow(['会う', 'あう', 'to meet, to see'], 5)).toEqual({
      expression: '会う',
      readings: ['あう'],
      meaning: 'to meet, to see',
      level: 5,
    });
  });

  it('splits several readings', () => {
    expect(cleanRow(['行く', 'いく; ゆく', 'to go'], 5)?.readings).toEqual([
      'いく',
      'ゆく',
    ]);
  });

  it('uses the first spelling when there are several', () => {
    expect(
      cleanRow(['やはり; やっぱり', 'やはり; やっぱり', 'as expected'], 4),
    ).toMatchObject({
      expression: 'やはり',
      readings: ['やはり', 'やっぱり'],
    });
  });

  it('drops the interjection marker but keeps real notes', () => {
    expect(cleanRow(['しまった (かん)', 'しまった (かん)', 'oops'], 3)).toEqual(
      {
        expression: 'しまった',
        readings: ['しまった'],
        meaning: 'oops',
        level: 3,
      },
    );
    expect(
      cleanRow(['こつ (をつかむ)', 'こつ (をつかむ)', 'knack'], 1),
    ).toMatchObject({
      expression: 'こつ',
      note: 'をつかむ',
    });
  });

  it('skips affixes and fragments', () => {
    expect(cleanRow(['～円', '～えん', 'yen'], 5)).toBeNull();
    expect(cleanRow(['お～', 'お～', 'honorific prefix'], 5)).toBeNull();
    expect(
      cleanRow(['(かさを～) さす', '(かさを～) さす', 'to raise'], 2),
    ).toBeNull();
  });
});

describe('buildWordList', () => {
  const header = 'expression,reading,meaning,tags,guid\n';
  it('keeps each word at its easiest level', () => {
    const { words, duplicates } = buildWordList({
      5: header + '会う,あう,to meet,,x\n',
      4: '',
      3: '',
      2: header + '会う,あう,to meet,,y\n原則,げんそく,principle,,z\n',
      1: '',
    });
    expect(words.map((w) => [w.expression, w.level])).toEqual([
      ['会う', 5],
      ['原則', 2],
    ]);
    expect(duplicates).toBe(1);
  });
});
