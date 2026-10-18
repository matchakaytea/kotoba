import { toHiragana } from 'wanakana';
import type { VocabEntry } from '../../shared/api';
import type { JlptWord } from '../jlpt/clean';

// Folds the JLPT word list (tanos) into the deck so Vocabulary holds every
// word from both. A list word is the same as a deck word when it is written
// and read the same, or read the same and spelled differently with a matching
// meaning (美味しい/おいしい, 入口/入り口). Everything else is added as a new
// entry. When the two disagree on the level, the deck's level wins.

/** How a word is written, without the deck's ruby (`飴[あめ]` → `飴`). */
export function plainExpression(expression: string): string {
  return expression.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, '');
}

function fold(text: string): string {
  return toHiragana(plainExpression(text), { passRomaji: true });
}

function kanji(text: string): string {
  return [...plainExpression(text)]
    .filter((c) => /\p{Script=Han}/u.test(c))
    .join('');
}

function isSubsequence(short: string, long: string): boolean {
  let i = 0;
  for (const c of long) if (c === short[i]) i++;
  return i === short.length;
}

const STOP_WORDS = new Set(
  'the and for with one oneself someone something not very etc'.split(' '),
);

function meaningWords(meaning: string): Set<string> {
  return new Set(
    meaning
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .split(/[^a-z]+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
      .map((word) => word.slice(0, 5)),
  );
}

function meaningsOverlap(a: string, b: string): boolean {
  const words = meaningWords(b);
  return [...meaningWords(a)].some((word) => words.has(word));
}

/** Reads `data/jlpt/chinese.tsv`: expression, reading, simplified, traditional. */
export function parseChinese(text: string): Map<string, [string, string]> {
  const meanings = new Map<string, [string, string]>();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const [expression, reading, sc, tc] = line.split('\t');
    if (expression && reading && sc && tc) {
      meanings.set(`${expression}|${reading}`, [sc.trim(), tc.trim()]);
    }
  }
  return meanings;
}

export function mergeJlptList(
  deck: VocabEntry[],
  words: JlptWord[],
  chinese: Map<string, [string, string]>,
): { entries: VocabEntry[]; untranslated: JlptWord[] } {
  const byExpression = new Map<string, VocabEntry[]>();
  const byReading = new Map<string, VocabEntry[]>();
  for (const entry of deck) {
    for (const [map, key] of [
      [byExpression, fold(entry.expression)],
      [byReading, fold(entry.reading)],
    ] as const) {
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
  }

  function find(word: JlptWord): VocabEntry | undefined {
    const readings = word.readings.map(fold);
    const sameSpelling = byExpression.get(fold(word.expression)) ?? [];
    const exact = sameSpelling.find((entry) =>
      readings.includes(fold(entry.reading)),
    );
    if (exact) return exact;
    const sameReading = readings.flatMap((r) => byReading.get(r) ?? []);
    const skeleton = kanji(word.expression);
    return (
      // Only the okurigana differ: 落す/落とす, 入口/入り口.
      sameReading.find(
        (entry) => skeleton && kanji(entry.expression) === skeleton,
      ) ??
      // One spelling uses more kana than the other, and the meanings agree.
      sameReading.find((entry) => {
        const other = kanji(entry.expression);
        return (
          (isSubsequence(skeleton, other) || isSubsequence(other, skeleton)) &&
          meaningsOverlap(word.meaning, entry.meaningEn)
        );
      })
    );
  }

  // する verbs listed with する (コピーする) belong to the noun (コピー).
  function findSuruNoun(word: JlptWord): VocabEntry | undefined {
    if (!word.expression.endsWith('する')) return undefined;
    if (!word.readings.every((r) => r.endsWith('する'))) return undefined;
    const noun = find({
      ...word,
      expression: word.expression.slice(0, -2),
      readings: word.readings.map((r) => r.slice(0, -2)),
    });
    return noun && /3/.test(noun.partOfSpeech) ? noun : undefined;
  }

  const spellings = new Map<VocabEntry, Set<string>>();
  const added: VocabEntry[] = [];
  const untranslated: JlptWord[] = [];
  const seen = new Set<string>();

  for (const listed of words) {
    // 計画（けいかくする）: the reading carries する but the word doesn't.
    const word =
      !listed.expression.endsWith('する') &&
      listed.readings.every((r) => r.length > 2 && r.endsWith('する'))
        ? { ...listed, readings: listed.readings.map((r) => r.slice(0, -2)) }
        : listed;
    const match = find(word) ?? findSuruNoun(word);
    if (match) {
      if (fold(word.expression) !== fold(match.expression)) {
        const set = spellings.get(match) ?? new Set();
        set.add(word.expression);
        spellings.set(match, set);
      }
      continue;
    }
    const reading = word.readings.join('、');
    const key = `${word.expression}|${reading}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const meaning = chinese.get(key);
    if (!meaning) untranslated.push(word);
    added.push({
      id: `jlpt:${key}`,
      expression: word.expression,
      reading,
      pitch: '',
      partOfSpeech: '',
      meaningSc: meaning?.[0] ?? '',
      meaningTc: meaning?.[1] ?? '',
      meaningEn: word.meaning,
      level: word.level,
      sort: 100000 + added.length,
      ...(word.note ? { note: word.note } : {}),
      source: 'jlpt',
      examples: [],
    });
  }

  const merged = deck.map((entry) => {
    const extra = spellings.get(entry);
    return extra ? { ...entry, spellings: [...extra] } : entry;
  });
  return {
    entries: [...merged, ...added].sort(
      (a, b) => b.level - a.level || a.sort - b.sort,
    ),
    untranslated,
  };
}
