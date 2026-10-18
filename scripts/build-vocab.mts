import fs from 'node:fs';
import path from 'node:path';
import { buildWordList, type JlptLevel } from '../src/main/jlpt/clean.ts';
import { parseNotes } from '../src/main/vocab/eggrolls.ts';
import { addEnglish, parseMeanings } from '../src/main/vocab/english.ts';
import { mergeJlptList, parseChinese } from '../src/main/vocab/merge.ts';
import { taiwanEntry } from '../src/main/vocab/taiwan.ts';

const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');
const target = path.resolve('src/main/vocab/entries.json');

const { words } = buildWordList(
  Object.fromEntries(
    [5, 4, 3, 2, 1].map((level) => [level, read(`data/jlpt/n${level}.csv`)]),
  ) as Record<JlptLevel, string>,
);

const { entries: deck, missing } = addEnglish(
  parseNotes(read('data/eggrolls/notes.csv')).map(taiwanEntry),
  parseMeanings(read('data/english/meanings.tsv')),
  words,
);
if (missing.length > 0) {
  console.error(`${missing.length} entries have no English meaning:`);
  console.error(missing.slice(0, 20).join('\n'));
  process.exit(1);
}

const { entries, untranslated } = mergeJlptList(
  deck,
  words,
  parseChinese(read('data/jlpt/chinese.tsv')),
);
if (untranslated.length > 0) {
  // `npm run build:vocab -- --todo file.tsv` lists them for translating.
  const todo = process.argv[process.argv.indexOf('--todo') + 1];
  if (process.argv.includes('--todo') && todo) {
    fs.writeFileSync(
      todo,
      untranslated
        .map((w) => [w.expression, w.readings.join('、'), w.meaning].join('\t'))
        .join('\n') + '\n',
      'utf8',
    );
  }
  console.error(
    `${untranslated.length} words from the JLPT list have no Chinese meaning in data/jlpt/chinese.tsv.`,
  );
  process.exit(1);
}

fs.writeFileSync(target, JSON.stringify(entries) + '\n', 'utf8');
const byLevel = [5, 4, 3, 2, 1]
  .map((n) => `N${n} ${entries.filter((e) => e.level === n).length}`)
  .join(' · ');
const added = entries.filter((e) => e.source === 'jlpt').length;
console.log(
  `${entries.length} entries (${byLevel}), ${added} from the JLPT list only`,
);
