import type { VocabEntry, VocabTier } from '../../shared/api';

const FIELDS = [
  'Notetype',
  'Deck',
  'NoteID',
  'VocabKanji',
  'VocabPitch',
  'VocabPoS',
  'VocabFurigana',
  'VocabDefSC',
  'VocabDefTC',
  'VocabPlus',
  'VocabAudio',
  ...[1, 2, 3, 4].flatMap((n) => [
    `SentType${n}`,
    `SentKanji${n}`,
    `SentFurigana${n}`,
    `SentDefSC${n}`,
    `SentDefTC${n}`,
    `SentAudio${n}`,
  ]),
  'Sort',
] as const;

const KANA = /^[ぁ-ゖァ-ヺー・]+$/;
const TIERS: Record<string, VocabTier> = {
  高频: 'high',
  中频: 'mid',
  低频: 'low',
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').trim();
}

export function parseRow(line: string): VocabEntry | null {
  const cells = line.split('\t');
  const field = (name: (typeof FIELDS)[number]) =>
    (cells[FIELDS.indexOf(name)] ?? '').trim();

  const deck = /::(\d)-N([1-5])(?:::\d-(高频|中频|低频))?/.exec(field('Deck'));
  const expression = field('VocabKanji');
  if (!deck || !expression) return null;

  const furigana = field('VocabFurigana');
  const isKana = KANA.test(expression.replace(/[〜～]/g, ''));
  const reading = KANA.test(furigana.replace(/[〜～]/g, ''))
    ? furigana
    : expression;
  const origin =
    isKana && furigana && furigana !== reading ? furigana : undefined;

  const examples = [1, 2, 3, 4]
    .map((n) => ({
      kind: field(`SentType${n}` as (typeof FIELDS)[number]),
      text: field(`SentKanji${n}` as (typeof FIELDS)[number]),
      furigana: field(`SentFurigana${n}` as (typeof FIELDS)[number]),
      sc: stripHtml(field(`SentDefSC${n}` as (typeof FIELDS)[number])),
      tc: stripHtml(field(`SentDefTC${n}` as (typeof FIELDS)[number])),
    }))
    .filter((example) => example.text)
    .map(({ kind, ...example }) => ({
      ...example,
      kind:
        kind === '関'
          ? ('related' as const)
          : kind === '対'
            ? ('opposite' as const)
            : ('sentence' as const),
    }));

  const note = field('VocabPlus');
  return {
    id: field('NoteID'),
    expression,
    reading,
    pitch: field('VocabPitch'),
    partOfSpeech: field('VocabPoS'),
    meaningSc: stripHtml(field('VocabDefSC')),
    meaningTc: stripHtml(field('VocabDefTC')),
    level: Number(deck[2]) as VocabEntry['level'],
    tier: deck[3] ? TIERS[deck[3]] : undefined,
    sort: Number(field('Sort')) || 0,
    ...(note ? { note } : {}),
    ...(origin ? { origin } : {}),
    examples,
  };
}

export function parseNotes(text: string): VocabEntry[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map(parseRow)
    .filter((entry): entry is VocabEntry => entry !== null)
    .sort((a, b) => b.level - a.level || a.sort - b.sort);
}
