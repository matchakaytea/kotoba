import type { DatabaseSync } from 'node:sqlite';
import type { StudyPlan, StudyWord } from '../shared/api';
import { buildSession, getMistakes, getToday } from './database';
import { entryOf, withReadings } from './vocab';

const MAX_MISTAKES = 10;

/**
 * What to look at before today's review: the words the review brings in for
 * the first time, and recent wrong answers to try again.
 */
export function getStudyPlan(db: DatabaseSync, now = new Date()): StudyPlan {
  const fresh = new Set(
    getToday(db, now)
      .due.filter((target) => target.dueDay === null)
      .map((target) => target.expression),
  );

  const words: StudyWord[] = [];
  const seen = new Set<string>();
  for (const item of buildSession(db, now).items) {
    for (const target of item.question.targets) {
      if (!fresh.has(target.expression) || seen.has(target.expression)) {
        continue;
      }
      seen.add(target.expression);
      const entry = entryOf(target.expression);
      words.push({
        expression: target.expression,
        reading: target.reading ?? entry?.reading ?? null,
        meaningEn: entry?.meaningEn ?? null,
        meaningSc: entry?.meaningSc ?? null,
        meaningTc: entry?.meaningTc ?? null,
        example:
          entry?.examples.find((example) => example.kind === 'sentence') ??
          null,
        level: entry?.level ?? null,
      });
    }
  }

  // Only mistakes that still have their question can be asked again, and a
  // question missed twice is asked once.
  const asked = new Set<string>();
  const mistakes = withReadings(getMistakes(db))
    .filter((mistake) => {
      if (!mistake.question) return false;
      const key = JSON.stringify(mistake.question);
      if (asked.has(key)) return false;
      asked.add(key);
      return true;
    })
    .slice(0, MAX_MISTAKES);

  return { words, mistakes };
}
