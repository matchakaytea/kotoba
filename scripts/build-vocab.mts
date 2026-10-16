import fs from 'node:fs';
import path from 'node:path';
import { parseNotes } from '../src/main/vocab/eggrolls.ts';

const source = path.resolve('data/eggrolls/notes.csv');
const target = path.resolve('src/main/vocab/entries.json');
const entries = parseNotes(fs.readFileSync(source, 'utf8'));
fs.writeFileSync(target, JSON.stringify(entries) + '\n', 'utf8');
const byLevel = [5, 4, 3, 2, 1]
  .map((n) => `N${n} ${entries.filter((e) => e.level === n).length}`)
  .join(' · ');
console.log(`${entries.length} entries (${byLevel})`);
