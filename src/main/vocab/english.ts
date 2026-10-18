import type { VocabEntry } from '../../shared/api';
import type { JlptWord } from '../jlpt/clean';
import type { DeckEntry } from './eggrolls';

/** Reads `data/english/meanings.tsv`: id, expression, reading, English. */
export function parseMeanings(text: string): Map<string, string> {
  const meanings = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const [id, , , english] = line.split('\t');
    if (id && english) meanings.set(id, english.trim());
  }
  return meanings;
}

/**
 * Gives every entry an English meaning: its translation in
 * `meanings.tsv` if there is one, otherwise the JLPT word list's meaning for
 * the same word and reading. Returns the ids that still have none.
 */
export function addEnglish(
  entries: DeckEntry[],
  meanings: Map<string, string>,
  words: JlptWord[],
): { entries: VocabEntry[]; missing: string[] } {
  const byWord = new Map<string, string>();
  for (const word of words) {
    for (const reading of word.readings) {
      byWord.set(`${word.expression}|${reading}`, word.meaning);
    }
  }
  const missing: string[] = [];
  const result = entries.map((entry) => {
    const meaningEn =
      meanings.get(entry.id) ??
      byWord.get(`${entry.expression}|${entry.reading}`) ??
      '';
    if (!meaningEn) missing.push(entry.id);
    return { ...entry, meaningEn };
  });
  return { entries: result, missing };
}
