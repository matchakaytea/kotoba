import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseNotes } from './eggrolls';
import { parseFurigana } from '../../shared/furigana';

const notes = fs.readFileSync('data/eggrolls/notes.csv', 'utf8');
const all = parseNotes(notes);

describe('real deck', () => {
  it('parses every row', () => {
    expect(all.length).toBe(10641);
  });
  it('has Chinese meanings everywhere and no HTML', () => {
    expect(all.every((e) => e.meaningSc && e.meaningTc)).toBe(true);
    expect(all.some((e) => /<[a-z]/i.test(e.meaningSc))).toBe(false);
  });
  it('shows a sample', () => {
    console.log(
      JSON.stringify(
        all.find((e) => e.expression === '高校'),
        null,
        1,
      ).slice(0, 900),
    );
    console.log(
      JSON.stringify(
        parseFurigana(
          all.find((e) => e.expression === '高校')!.examples[0].furigana,
        ),
      ),
    );
  });
});

describe('parseFurigana', () => {
  it('reads ruby and marks the target word', () => {
    expect(
      parseFurigana(
        '妹[いもうと]は<b> 高校[こうこう]</b>に 通[かよ]っています',
      ),
    ).toEqual([
      { text: '妹', ruby: 'いもうと' },
      { text: 'は' },
      { text: '高校', ruby: 'こうこう', target: true },
      { text: 'に' },
      { text: '通', ruby: 'かよ' },
      { text: 'っています' },
    ]);
  });
});
