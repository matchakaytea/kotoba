import fs from 'node:fs';
import path from 'node:path';
import { buildWordList, type JlptLevel } from '../src/main/jlpt/clean.ts';

const source = path.resolve('data/jlpt');
const target = path.resolve('src/main/jlpt/words.json');

const files = Object.fromEntries(
  [5, 4, 3, 2, 1].map((level) => [
    level,
    fs.readFileSync(path.join(source, `n${level}.csv`), 'utf8'),
  ]),
) as Record<JlptLevel, string>;

const { words, skipped, duplicates } = buildWordList(files);
fs.writeFileSync(target, JSON.stringify(words) + '\n', 'utf8');

const perLevel = [5, 4, 3, 2, 1]
  .map((level) => `N${level} ${words.filter((w) => w.level === level).length}`)
  .join(' · ');
console.log(
  `${words.length} words (${perLevel}) · skipped ${skipped} affixes or fragments · ${duplicates} duplicates`,
);
