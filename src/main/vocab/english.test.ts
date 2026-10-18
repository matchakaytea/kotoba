import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { JlptWord } from '../jlpt/clean';
import type { DeckEntry } from './eggrolls';
import { addEnglish, parseMeanings } from './english';

const entry = (id: string, expression: string, reading: string) =>
  ({ id, expression, reading }) as DeckEntry;

describe('parseMeanings', () => {
  it('reads id and English, skipping the header', () => {
    const meanings = parseMeanings(
      '# id\texpression\treading\tenglish\r\nabc\t七\tなな\tseven\r\n',
    );
    expect([...meanings]).toEqual([['abc', 'seven']]);
  });
  it('reads the real file', () => {
    const meanings = parseMeanings(
      fs.readFileSync('data/english/meanings.tsv', 'utf8'),
    );
    expect(meanings.size).toBe(5274);
  });
});

describe('addEnglish', () => {
  const words: JlptWord[] = [
    { expression: '会う', readings: ['あう'], meaning: 'to meet', level: 5 },
  ];
  it('prefers the translation, then the JLPT list, and reports gaps', () => {
    const { entries, missing } = addEnglish(
      [
        entry('1', '会う', 'あう'),
        entry('2', '七', 'なな'),
        entry('3', '会う', 'あいう'),
      ],
      new Map([['2', 'seven']]),
      words,
    );
    expect(entries.map((e) => e.meaningEn)).toEqual(['to meet', 'seven', '']);
    expect(missing).toEqual(['3']);
  });
});
