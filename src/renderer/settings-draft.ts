import {
  Settings,
  type Backdrop,
  type Language,
  type Theme,
} from '../shared/api';
import type { CustomColors } from '../shared/palette';

/** What the Settings tabs show, including text that is still being typed. */
export type SettingsDraft = {
  language: Language;
  theme: Theme;
  colors: CustomColors | undefined;
  backdrop: Backdrop;
  level: string;
  topics: string;
  questionCount: number;
  wordSource: 'jlpt' | 'free';
};

export function draftOf(settings: Settings, backdrop: Backdrop): SettingsDraft {
  return {
    language: settings.language,
    theme: settings.theme,
    colors: settings.customColors,
    backdrop: settings.backdrop ?? backdrop,
    level: settings.level,
    topics: settings.topics.join(', '),
    questionCount: settings.questionCount,
    wordSource: settings.wordSource,
  };
}

export function splitTopics(topics: string): string[] {
  return topics
    .split(/[,、，]/)
    .map((topic) => topic.trim())
    .filter(Boolean);
}

/**
 * The settings to save, or null while the draft can't be saved yet: an empty
 * level or topic list, a question count out of range, or the custom skin
 * without a picture.
 */
export function settingsOf(draft: SettingsDraft): Settings | null {
  if (draft.theme === 'custom' && !draft.colors) return null;
  const parsed = Settings.safeParse({
    language: draft.language,
    theme: draft.theme,
    ...(draft.colors ? { customColors: draft.colors } : {}),
    backdrop: draft.backdrop,
    targetLanguage: 'ja',
    level: draft.level,
    topics: splitTopics(draft.topics),
    questionCount: draft.questionCount,
    wordSource: draft.wordSource,
  });
  return parsed.success ? parsed.data : null;
}

/** JSON with object keys sorted, so key order doesn't count as a change. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
}

/** Whether saving `next` would change what is saved. */
export function differs(next: Settings, saved: Settings | null): boolean {
  return canonical(next) !== canonical(saved);
}
