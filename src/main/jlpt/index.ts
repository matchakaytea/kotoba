import type { DatabaseSync } from 'node:sqlite';
import type {
  JlptLevelSummary,
  WordPage,
  WordQuery,
  WordStatus,
} from '../../shared/api';
import type { JlptLevel, JlptWord } from './clean';
import words from './words.json';

export const JLPT_WORDS = words as JlptWord[];

const KNOWN_AFTER_DAYS = 21;

export function jlptLevelOf(level: string): JlptLevel | null {
  const match = /^around JLPT N([1-5])$/.exec(level);
  return match ? (Number(match[1]) as JlptLevel) : null;
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
    .all() as {
    expression: string;
    dueDay: string;
    lastDay: string;
  }[];

  const rank: Record<WordStatus, number> = { new: 0, learning: 1, known: 2 };
  const statuses = new Map<string, WordStatus>();
  for (const row of rows) {
    const status: WordStatus =
      daysBetween(row.lastDay, row.dueDay) >= KNOWN_AFTER_DAYS
        ? 'known'
        : 'learning';
    const current = statuses.get(row.expression);
    if (!current || rank[status] > rank[current]) {
      statuses.set(row.expression, status);
    }
  }
  return statuses;
}

export function jlptSummary(
  db: DatabaseSync,
  list = JLPT_WORDS,
): JlptLevelSummary[] {
  const statuses = wordStatuses(db);
  return ([5, 4, 3, 2, 1] as JlptLevel[]).map((level) => {
    const inLevel = list.filter((word) => word.level === level);
    const count = (status: WordStatus) =>
      inLevel.filter(
        (word) => (statuses.get(word.expression) ?? 'new') === status,
      ).length;
    return {
      level,
      total: inLevel.length,
      learning: count('learning'),
      known: count('known'),
    };
  });
}

export function jlptWords(
  db: DatabaseSync,
  query: WordQuery,
  list = JLPT_WORDS,
): WordPage {
  const statuses = wordStatuses(db);
  const search = query.search?.trim().toLowerCase() ?? '';
  const matching = list
    .filter((word) => word.level === query.level)
    .map((word) => ({
      ...word,
      status: statuses.get(word.expression) ?? 'new',
    }))
    .filter((word) => !query.status || word.status === query.status)
    .filter(
      (word) =>
        !search ||
        word.expression.includes(search) ||
        word.readings.some((reading) => reading.includes(search)) ||
        word.meaning.toLowerCase().includes(search),
    );
  return {
    total: matching.length,
    words: matching.slice(query.offset, query.offset + query.limit),
  };
}

/** Picks words from the level that are in none of your tests yet, in a random order. */
export function pickNewWords(
  db: DatabaseSync,
  level: JlptLevel,
  count: number,
  random = Math.random,
  list = JLPT_WORDS,
): JlptWord[] {
  const known = new Set(
    (
      db.prepare('SELECT DISTINCT expression FROM targets').all() as {
        expression: string;
      }[]
    ).map((row) => row.expression),
  );
  const fresh = list.filter(
    (word) => word.level === level && !known.has(word.expression),
  );
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }
  return fresh.slice(0, count);
}
