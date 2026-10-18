import type { Language } from './languages';
import type {
  MultipleChoiceQuestion,
  Question,
  RecallQuestion,
} from './test-schema';

export function localizeQuestion<Q extends Question>(
  question: Q,
  language: Language,
): Q {
  if (question.template === 'recall') {
    const text = question.i18n?.[language];
    return text
      ? ({ ...question, prompt: text.prompt } satisfies RecallQuestion as Q)
      : question;
  }
  if (question.template !== 'multiple_choice') return question;
  const text = question.i18n?.[language];
  if (!text) return question;
  return {
    ...question,
    prompt: text.prompt,
    options: text.options ?? question.options,
  } satisfies MultipleChoiceQuestion as Q;
}

export function localizeTitle(
  title: string,
  translations: Partial<Record<Language, string>> | undefined,
  language: Language,
): string {
  return translations?.[language] ?? title;
}

export function missingLanguages(
  test: {
    title_i18n?: Partial<Record<Language, string>>;
    questions: Question[];
  },
  languages: Language[],
): Language[] {
  return languages.filter(
    (language) =>
      !test.title_i18n?.[language] ||
      test.questions.some(
        (question) =>
          question.template !== 'reading' && !question.i18n?.[language],
      ),
  );
}

export function describeMistake(
  question: Question | null,
  answer: string,
  language: Language,
): { prompt: string | null; answer: string; expected: string | null } {
  if (!question) return { prompt: null, answer, expected: null };
  const shown = localizeQuestion(question, language);
  if (shown.template === 'reading' || shown.template === 'recall') {
    return {
      prompt: shown.prompt,
      answer,
      expected: shown.answers.join(' / '),
    };
  }
  const chosen =
    question.template === 'multiple_choice'
      ? question.options.indexOf(answer)
      : -1;
  return {
    prompt: shown.prompt,
    answer: chosen >= 0 ? shown.options[chosen] : answer,
    expected: shown.options[shown.answer_index],
  };
}
