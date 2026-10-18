import type { VocabEntry, VocabPage, VocabQuery } from '../../shared/api';
import entries from './entries.json';

export const VOCAB = entries as VocabEntry[];

function matches(entry: VocabEntry, query: VocabQuery): boolean {
  if (query.level && entry.level !== query.level) return false;
  if (query.tier && entry.tier !== query.tier) return false;
  if (!query.search) return true;
  const needle = query.search.trim().toLowerCase();
  return (
    entry.expression.includes(needle) ||
    entry.reading.includes(needle) ||
    entry.meaningSc.includes(needle) ||
    entry.meaningTc.includes(needle) ||
    entry.meaningEn.toLowerCase().includes(needle)
  );
}

export function searchVocab(
  query: VocabQuery,
  list: VocabEntry[] = VOCAB,
): VocabPage {
  const found = list.filter((entry) => matches(entry, query));
  return {
    total: found.length,
    entries: found.slice(query.offset, query.offset + query.limit),
  };
}
