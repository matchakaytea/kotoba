import { z } from 'zod';
import { Language, LANGUAGES } from './languages';
import { Target, type Question } from './test-schema';

export { Language, LANGUAGES };

export const AttemptInput = z.strictObject({
  testId: z.string().min(1).max(200),
  questionIndex: z.number().int().min(0),
  template: z.enum(['multiple_choice', 'reading']),
  answer: z.string().max(500),
  correct: z.boolean(),
  targets: z.array(Target).min(1).max(20),
});

export type AttemptInput = z.infer<typeof AttemptInput>;

export type Summary = {
  attempts: number;
  correct: number;
  targets: number;
};

export type DueTarget = {
  expression: string;
  reading: string | null;
  skill: string;
  dueDay: string | null;
  hasQuestion: boolean;
};

export type Today = {
  today: string;
  due: DueTarget[];
  nextDueDay: string | null;
  questionsReady: number;
  summary: Summary;
};

export type SessionItem = {
  testId: string;
  questionIndex: number;
  question: Question;
};

export type Session = {
  title: string;
  items: SessionItem[];
};

export type ImportReport = {
  imported: { file: string; title: string; questions: number }[];
  rejected: { file: string; errors: string[] }[];
};

export const TARGET_LANGUAGES = [
  { code: 'ja', available: true },
  { code: 'ko', available: false },
  { code: 'zh', available: false },
  { code: 'en', available: false },
] as const;

export type TargetLanguageCode = (typeof TARGET_LANGUAGES)[number]['code'];

export const TargetLanguage = z.enum(['ja']);

const HexColor = z.string().regex(/^#[0-9a-f]{6}$/);

export const CustomColors = z.strictObject({
  base: HexColor,
  accent: HexColor,
  mode: z.enum(['light', 'dark']),
});

export const Theme = z.enum([
  'default',
  'washi',
  'sakura',
  'matcha',
  'tokyo-night',
  'mochi',
  'custom',
]);

export type Theme = z.infer<typeof Theme>;

export const THEMES: { code: Theme; name: string }[] = [
  { code: 'default', name: '' },
  { code: 'washi', name: 'Washi · 和紙' },
  { code: 'sakura', name: 'Sakura · 桜' },
  { code: 'matcha', name: 'Matcha · 抹茶' },
  { code: 'tokyo-night', name: 'Tokyo night · 東京の夜' },
  { code: 'mochi', name: 'Mochi · もち' },
  { code: 'custom', name: '' },
];

export const Settings = z.strictObject({
  language: Language.default('en'),
  theme: Theme.default('default'),
  customColors: CustomColors.optional(),
  targetLanguage: TargetLanguage.default('ja'),
  level: z.string().trim().min(1).max(100),
  topics: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
  questionCount: z.number().int().min(5).max(40),
  wordSource: z.enum(['jlpt', 'free']).default('jlpt'),
});

export type Settings = z.infer<typeof Settings>;
export type SettingsInput = z.input<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  theme: 'default',
  targetLanguage: 'ja',
  level: 'around JLPT N2',
  topics: ['IT', 'software engineering', 'workplace'],
  questionCount: 15,
  wordSource: 'jlpt',
};

export type Mistake = {
  answeredAt: string;
  answer: string;
  question: Question | null;
  targets: string[];
};

export type WordStatus = 'new' | 'learning' | 'known';

export type JlptLevelSummary = {
  level: 1 | 2 | 3 | 4 | 5;
  total: number;
  learning: number;
  known: number;
};

export const WordQuery = z.strictObject({
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  status: z.enum(['new', 'learning', 'known']).optional(),
  search: z.string().max(100).optional(),
  offset: z.number().int().min(0),
  limit: z.number().int().min(1).max(500),
});

export type WordQuery = z.infer<typeof WordQuery>;

export type WordPage = {
  total: number;
  words: {
    expression: string;
    readings: string[];
    meaning: string;
    level: number;
    note?: string;
    status: WordStatus;
  }[];
};

export type LibraryTest = {
  id: string;
  title: string;
  titleI18n: Partial<Record<Language, string>>;
  importedAt: string;
  questions: number;
  missingLanguages: Language[];
};

export interface KotobaApi {
  saveAttempt(input: AttemptInput): Promise<void>;
  getSummary(): Promise<Summary>;
  getToday(): Promise<Today>;
  getSession(): Promise<Session>;
  importInbox(): Promise<ImportReport>;
  dismissImportReport(): Promise<void>;
  openInbox(): Promise<void>;
  copyBrief(): Promise<void>;
  claudeStatus(): Promise<{ found: boolean }>;
  generateTest(): Promise<ImportReport>;
  getMistakes(): Promise<Mistake[]>;
  getLibrary(): Promise<LibraryTest[]>;
  deleteTest(testId: string): Promise<LibraryTest[]>;
  translateTest(testId: string): Promise<LibraryTest[]>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<Settings>;
  pickPicture(): Promise<string | null>;
  getJlptSummary(): Promise<JlptLevelSummary[]>;
  getJlptWords(query: WordQuery): Promise<WordPage>;
}
