import type { Language } from './languages';
import type { LangTest, Question } from './test-schema';

const JAPANESE = /[぀-ヿ㐀-鿿々〆ー]+/g;

function hasJapanese(text: string): boolean {
  JAPANESE.lastIndex = 0;
  const found = JAPANESE.test(text);
  JAPANESE.lastIndex = 0;
  return found;
}

function withoutNewTranslations(test: LangTest, languages: Language[]) {
  const strip = <T extends Partial<Record<Language, unknown>> | undefined>(
    map: T,
  ) => {
    if (!map) return undefined;
    const kept = Object.fromEntries(
      Object.entries(map).filter(
        ([code]) => !languages.includes(code as Language),
      ),
    );
    return Object.keys(kept).length > 0 ? kept : undefined;
  };
  return stableStringify({
    ...test,
    title_i18n: strip(test.title_i18n),
    questions: test.questions.map((question: Question) =>
      question.template === 'multiple_choice'
        ? { ...question, i18n: strip(question.i18n) }
        : question,
    ),
  });
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : inner,
  );
}

export function checkAddedTranslations(
  original: LangTest,
  updated: LangTest,
  languages: Language[],
): string[] {
  if (
    withoutNewTranslations(updated, languages) !==
    withoutNewTranslations(original, languages)
  ) {
    return ['the test itself changed, not just the translations'];
  }

  const problems: string[] = [];
  for (const language of languages) {
    if (!updated.title_i18n?.[language]) {
      problems.push(`title: ${language} missing`);
    }
  }

  original.questions.forEach((before, i) => {
    const after = updated.questions[i];
    if (
      before.template !== 'multiple_choice' ||
      after.template !== 'multiple_choice'
    ) {
      return;
    }
    const where = `Question ${i + 1}`;
    const japaneseOptions = before.options.some(hasJapanese);
    const japaneseInPrompt = new Set(before.prompt.match(JAPANESE) ?? []);

    for (const language of languages) {
      const text = after.i18n?.[language];
      if (!text) {
        problems.push(`${where}: ${language} missing`);
        continue;
      }
      for (const word of japaneseInPrompt) {
        if (!text.prompt.includes(word)) {
          problems.push(`${where}: ${language} prompt lost “${word}”`);
        }
      }
      if (japaneseOptions && text.options) {
        before.options.forEach((option, j) => {
          if (hasJapanese(option) && text.options?.[j] !== option) {
            problems.push(
              `${where}: ${language} changed Japanese option ${j + 1}`,
            );
          }
        });
      }
    }
  });

  return problems;
}
