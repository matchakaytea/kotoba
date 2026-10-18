import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '../../shared/api';
import type { JlptWord } from '../jlpt/clean';
import { mergeJlptList, parseChinese, plainExpression } from './merge';

const deckEntry = (
  expression: string,
  reading: string,
  meaningEn: string,
  partOfSpeech = '名',
): VocabEntry => ({
  id: expression,
  expression,
  reading,
  pitch: '',
  partOfSpeech,
  meaningSc: '中',
  meaningTc: '中',
  meaningEn,
  level: 3,
  sort: 1,
  examples: [],
});

const word = (
  expression: string,
  reading: string,
  meaning: string,
  level: JlptWord['level'] = 4,
): JlptWord => ({ expression, readings: [reading], meaning, level });

const deck = [
  deckEntry('おいしい', 'おいしい', 'delicious, tasty', 'イ形'),
  deckEntry('入り口', 'いりぐち', 'entrance'),
  deckEntry('コピー', 'コピー', 'copy; to photocopy', '他動3・名'),
  deckEntry('過程', 'かてい', 'process, course'),
  deckEntry('飴[あめ]', 'あめ', 'candy'),
  deckEntry('する', 'する', 'to do', '他動3'),
];

describe('mergeJlptList', () => {
  const { entries, untranslated } = mergeJlptList(
    deck,
    [
      word('美味しい', 'おいしい', 'delicious, tasty'),
      word('入口', 'いりぐち', 'entrance, gate'),
      word('コピーする', 'コピーする', 'to copy'),
      word('飴', 'あめ', '(hard) candy'),
      word('課程', 'かてい', 'course, curriculum'),
      word('刷る', 'する', 'to print'),
      word('お金', 'おかね', 'money', 5),
    ],
    parseChinese('お金\tおかね\t钱\t錢\n課程\tかてい\t课程\t課程\n'),
  );
  const find = (expression: string) =>
    entries.find((e) => e.expression === expression);

  it('adds other spellings to the matching deck word', () => {
    expect(find('おいしい')?.spellings).toEqual(['美味しい']);
    expect(find('入り口')?.spellings).toEqual(['入口']);
    expect(find('コピー')?.spellings).toEqual(['コピーする']);
  });

  it('treats a word written the same way as the same word', () => {
    expect(find('飴[あめ]')?.spellings).toBeUndefined();
    expect(
      entries.filter((e) => plainExpression(e.expression) === '飴'),
    ).toHaveLength(1);
  });

  it('keeps homophones apart and adds them as new words', () => {
    expect(find('課程')).toMatchObject({
      source: 'jlpt',
      meaningEn: 'course, curriculum',
      meaningSc: '课程',
      level: 4,
    });
    expect(find('する')?.spellings).toBeUndefined();
    expect(find('刷る')?.source).toBe('jlpt');
  });

  it('reports added words that have no Chinese meaning yet', () => {
    expect(untranslated.map((w) => w.expression)).toEqual(['刷る']);
  });

  it('sorts the list by level, N5 first', () => {
    expect(entries[0].expression).toBe('お金');
    const levels = entries.map((e) => e.level);
    expect(levels).toEqual([...levels].sort((a, b) => b - a));
  });
});
