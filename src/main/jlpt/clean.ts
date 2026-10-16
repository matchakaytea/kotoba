export type JlptLevel = 5 | 4 | 3 | 2 | 1;

export type JlptWord = {
  expression: string;
  readings: string[];
  meaning: string;
  level: JlptLevel;
  note?: string;
};

const KANA = /^[ぁ-ゖァ-ヺー]+$/;
const AFFIX = /[～〜]/;
const NOTE = /\s*[(（]([^)）]*)[)）]\s*/g;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1);
}

function stripNotes(text: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  const cleaned = text
    .replace(NOTE, (_match, note: string) => {
      notes.push(note.trim());
      return ' ';
    })
    .trim();
  return { text: cleaned, notes };
}

/** Turns one CSV row into a usable word, or null when it can't be practised on its own. */
export function cleanRow(
  [expressionField, readingField, meaning]: string[],
  level: JlptLevel,
): JlptWord | null {
  if (AFFIX.test(expressionField) || AFFIX.test(readingField)) return null;

  const expression = stripNotes(expressionField);
  const reading = stripNotes(readingField);
  if (!expression.text) return null;

  const readings = reading.text
    .split(/[;；]/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (readings.length === 0 || !readings.every((r) => KANA.test(r)))
    return null;

  const expressions = expression.text.split(/[;；]/).map((e) => e.trim());
  if (expressions.some((e) => !e || /\s/.test(e))) return null;
  const notes = [...new Set([...expression.notes, ...reading.notes])].filter(
    (note) => note !== 'かん',
  );

  return {
    expression: expressions[0],
    readings,
    meaning: meaning.trim(),
    level,
    ...(notes.length > 0 ? { note: notes.join('; ') } : {}),
  };
}

export function buildWordList(files: Record<JlptLevel, string>): {
  words: JlptWord[];
  skipped: number;
  duplicates: number;
} {
  const words: JlptWord[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let duplicates = 0;
  for (const level of [5, 4, 3, 2, 1] as JlptLevel[]) {
    const [, ...rows] = parseCsv(files[level]);
    for (const row of rows) {
      const word = cleanRow(row, level);
      if (!word) {
        skipped++;
        continue;
      }
      const key = `${word.expression}|${word.readings[0]}`;
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      words.push(word);
    }
  }
  return { words, skipped, duplicates };
}
