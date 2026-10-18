import type { DatabaseSync } from 'node:sqlite';
import type {
  Mistake,
  OtherWord,
  VocabEntry,
  VocabLevelSummary,
  VocabPage,
  VocabQuery,
  WordStatus,
} from '../../shared/api';
import entries from './entries.json';
import { plainExpression } from './merge';

export const VOCAB = entries as VocabEntry[];

type Level = VocabEntry['level'];
const LEVELS: Level[] = [5, 4, 3, 2, 1];
const KNOWN_AFTER_DAYS = 21;

export function levelOf(setting: string): Level | null {
  const match = /^around JLPT N([1-5])$/.exec(setting);
  return match ? (Number(match[1]) as Level) : null;
}

/** Every way an entry is written, as targets in tests write it. */
function writings(entry: VocabEntry): string[] {
  return [plainExpression(entry.expression), ...(entry.spellings ?? [])];
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** The status of every word you've practised, keyed by how it's written. */
export function wordStatuses(db: DatabaseSync): Map<string, WordStatus> {
  const rows = db
    .prepare(
      `SELECT t.expression, r.due_day AS dueDay, r.last_review_day AS lastDay
       FROM targets t
       JOIN review_states r ON r.target_id = t.id`,
    )
    .all() as { expression: string; dueDay: string; lastDay: string }[];

  const statuses = new Map<string, WordStatus>();
  for (const row of rows) {
    const status: WordStatus =
      daysBetween(row.lastDay, row.dueDay) >= KNOWN_AFTER_DAYS
        ? 'known'
        : 'learning';
    statuses.set(row.expression, best(statuses.get(row.expression), status));
  }
  return statuses;
}

const RANK: Record<WordStatus, number> = { new: 0, learning: 1, known: 2 };

function best(a: WordStatus | undefined, b: WordStatus): WordStatus {
  return a && RANK[a] >= RANK[b] ? a : b;
}

function statusOf(
  entry: VocabEntry,
  statuses: Map<string, WordStatus>,
): WordStatus {
  return writings(entry).reduce<WordStatus>(
    (status, writing) => best(statuses.get(writing), status),
    'new',
  );
}

function matches(entry: VocabEntry, search: string): boolean {
  const needle = search.trim().toLowerCase();
  return (
    writings(entry).some((writing) => writing.includes(needle)) ||
    entry.expression.includes(needle) ||
    entry.reading.includes(needle) ||
    entry.meaningSc.includes(needle) ||
    entry.meaningTc.includes(needle) ||
    entry.meaningEn.toLowerCase().includes(needle)
  );
}

export function searchVocab(
  query: VocabQuery,
  statuses: Map<string, WordStatus> = new Map(),
  list: VocabEntry[] = VOCAB,
): VocabPage {
  const found = list
    .filter((entry) => !query.level || entry.level === query.level)
    .filter((entry) => !query.tier || entry.tier === query.tier)
    .filter((entry) => !query.search || matches(entry, query.search))
    .map((entry) => ({ ...entry, status: statusOf(entry, statuses) }))
    .filter((entry) => !query.status || entry.status === query.status);
  return {
    total: found.length,
    entries: found.slice(query.offset, query.offset + query.limit),
  };
}

/** How many words of each level you are learning or know. */
export function vocabSummary(
  statuses: Map<string, WordStatus>,
  list: VocabEntry[] = VOCAB,
): VocabLevelSummary[] {
  return LEVELS.map((level) => {
    const inLevel = list.filter((entry) => entry.level === level);
    const count = (status: WordStatus) =>
      inLevel.filter((entry) => statusOf(entry, statuses) === status).length;
    return {
      level,
      total: inLevel.length,
      learning: count('learning'),
      known: count('known'),
    };
  });
}

// Common words come first. Words from the JLPT list have no frequency tier;
// they rank with the medium ones.
const TIER_RANK: Record<string, number> = { high: 0, mid: 1, low: 2 };

function tierRank(entry: VocabEntry): number {
  return entry.tier ? TIER_RANK[entry.tier] : 1;
}

/**
 * Picks words from the level that are in none of your tests yet: common words
 * first, in a random order within each frequency tier.
 */
export function pickNewWords(
  db: DatabaseSync,
  level: Level,
  count: number,
  random = Math.random,
  list: VocabEntry[] = VOCAB,
): VocabEntry[] {
  const used = new Set(
    (
      db.prepare('SELECT DISTINCT expression FROM targets').all() as {
        expression: string;
      }[]
    ).map((row) => row.expression),
  );
  const fresh = list.filter(
    (entry) =>
      entry.level === level &&
      !writings(entry).some((writing) => used.has(writing)),
  );
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }
  return fresh.sort((a, b) => tierRank(a) - tierRank(b)).slice(0, count);
}

/** The reading of a word as Vocabulary has it, by any of its spellings. */
export function readingOf(
  expression: string,
  list: VocabEntry[] = VOCAB,
): string | undefined {
  return list.find((entry) => writings(entry).includes(expression))?.reading;
}

/** Words you have practised that are not in Vocabulary, with their status. */
export function otherWords(
  db: DatabaseSync,
  list: VocabEntry[] = VOCAB,
): OtherWord[] {
  const known = new Set(list.flatMap(writings));
  const statuses = wordStatuses(db);
  const rows = db
    .prepare(
      `SELECT t.expression, MAX(t.reading) AS reading
       FROM targets t
       JOIN review_states r ON r.target_id = t.id
       GROUP BY t.expression
       ORDER BY MIN(t.created_at), t.expression`,
    )
    .all() as { expression: string; reading: string | null }[];
  return rows
    .filter((row) => !known.has(row.expression))
    .map((row) => ({
      expression: row.expression,
      reading: row.reading ?? undefined,
      status: statuses.get(row.expression) ?? 'new',
    }));
}

// A mistake whose test was deleted has no answer key; show the reading from
// Vocabulary instead.
export function withReadings(mistakes: Mistake[]): Mistake[] {
  return mistakes.map((mistake) => {
    if (mistake.question) return mistake;
    const readings = mistake.targets
      .map((target) => readingOf(target))
      .filter((reading): reading is string => Boolean(reading));
    return readings.length > 0 ? { ...mistake, readings } : mistake;
  });
}
