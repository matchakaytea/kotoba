import fs from 'node:fs';
import path from 'node:path';
import { parseNotes } from '../src/main/vocab/eggrolls.ts';
import { taiwanEntry } from '../src/main/vocab/taiwan.ts';
import { addEnglish, parseMeanings } from '../src/main/vocab/english.ts';

const source = path.resolve('data/eggrolls/notes.csv');
const english = path.resolve('data/english/meanings.tsv');
const jlpt = path.resolve('src/main/jlpt/words.json');
const target = path.resolve('src/main/vocab/entries.json');

const { entries, missing } = addEnglish(
  parseNotes(fs.readFileSync(source, 'utf8')).map(taiwanEntry),
  parseMeanings(fs.readFileSync(english, 'utf8')),
  JSON.parse(fs.readFileSync(jlpt, 'utf8')),
);
if (missing.length > 0) {
  console.error(`${missing.length} entries have no English meaning:`);
  console.error(missing.slice(0, 20).join('\n'));
  process.exit(1);
}
fs.writeFileSync(target, JSON.stringify(entries) + '\n', 'utf8');
const byLevel = [5, 4, 3, 2, 1]
  .map((n) => `N${n} ${entries.filter((e) => e.level === n).length}`)
  .join(' · ');
console.log(`${entries.length} entries (${byLevel})`);
