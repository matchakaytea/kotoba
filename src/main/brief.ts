import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { LANGUAGES, type Language } from '../shared/api';
import { LangTest } from '../shared/test-schema';
import { getBriefData, getSettings } from './database';
import { levelOf, pickNewWords } from './vocab';
import { localDay } from './scheduler';
import { plainExpression } from './vocab/merge';

const MAX_DUE_TARGETS = 40;
const MIN_NEW_WORDS = 5;

export function buildBrief(
  db: DatabaseSync,
  now = new Date(),
  random = Math.random,
) {
  const today = localDay(now);
  const { due, mistakes } = getBriefData(db, now);
  const settings = getSettings(db);
  const jlptLevel =
    settings.wordSource === 'jlpt' ? levelOf(settings.level) : null;
  const dueCount = Math.min(due.length, MAX_DUE_TARGETS);
  const newWords = jlptLevel
    ? pickNewWords(
        db,
        jlptLevel,
        Math.max(MIN_NEW_WORDS, settings.questionCount - dueCount),
        random,
      )
    : [];
  return {
    format: 'kotoba-brief',
    format_version: 1,
    date: today,
    language: 'ja',
    learner: {
      level: settings.level,
      topics: settings.topics,
      prompt_language:
        LANGUAGES.find((language) => language.code === settings.language)
          ?.english ?? 'English',
    },
    question_count: settings.questionCount,
    supported_templates: ['reading', 'multiple_choice', 'recall'],
    due_targets: due.slice(0, MAX_DUE_TARGETS).map((target) => ({
      expression: target.expression,
      reading: target.reading,
      skill: target.skill,
      status:
        target.dueDay === null
          ? 'new'
          : target.dueDay < today
            ? 'overdue'
            : 'due',
    })),
    recent_mistakes: mistakes,
    word_list: jlptLevel ? `JLPT N${jlptLevel}` : null,
    new_words: newWords.map((word) => {
      const example = word.examples.find((e) => e.kind === 'sentence');
      return {
        expression: plainExpression(word.expression),
        readings: word.reading.split('、'),
        meaning: word.meaningEn,
        meaning_zh_hans: word.meaningSc,
        meaning_zh_hant: word.meaningTc,
        ...(word.note ? { note: word.note } : {}),
        ...(example ? { example: example.text } : {}),
      };
    }),
  };
}

function newWordsRule(brief: ReturnType<typeof buildBrief>): string {
  const topics = brief.learner.topics.join(', ');
  if (brief.new_words.length === 0) {
    return `- Fill the remaining questions with new, useful words for a learner ${brief.learner.level}, on these topics: ${topics}.`;
  }
  const reviews = brief.due_targets.length;
  const total = Math.max(
    brief.question_count,
    reviews + brief.new_words.length,
  );
  return `- Write exactly ${total} questions: ${reviews} for the due targets and ${brief.new_words.length} for the new words, one question per new word. Every word in "new_words" must appear in the "targets" of a question; do not skip any.
- Fill the remaining questions with the words in "new_words" (from the ${brief.word_list} vocabulary list), one question per word, in the order given. Use the topics (${topics}) as the theme of the prompts and example sentences. In "targets", use each word's "expression" exactly as written.
- Each new word comes with its meaning in English ("meaning") and Chinese ("meaning_zh_hans", "meaning_zh_hant"). Test the sense these describe. When a question's options are meanings, base them on these, so they agree with the learner's word list.
- "example", when given, shows the word in use. Write your own sentence; do not copy it.`;
}

export function briefPrompt(brief: ReturnType<typeof buildBrief>): string {
  const schema = JSON.stringify(z.toJSONSchema(LangTest), null, 2);
  return `You are writing a Japanese practice test for the Kotoba app.

Return ONLY one JSON object that matches the JSON Schema below. No explanation, no Markdown code fences.

Rules:
- Write about ${brief.question_count} questions using only these templates: ${brief.supported_templates.join(', ')}.
- Cover every target in "due_targets" first, starting with overdue ones and recent mistakes. Test each one in a fresh way or a new context sentence, not word for word as before.
${newWordsRule(brief)}
- Every question lists its targets: { expression, reading, skill }. Use skill "reading" for reading questions, "meaning" for multiple-choice meaning questions and "production" for recall questions.
- Mix the templates. Make about a third of the questions recall, preferring words the learner has already seen (due targets) over brand-new ones.
- reading: "prompt" is the word in kanji, "answers" lists every valid reading in hiragana only. Add a "context" sentence when the reading depends on it.
- multiple_choice: 4 options, exactly one correct, no duplicates, plausible distractors.
- recall: the learner sees the meaning and types the Japanese word. "prompt" is the meaning (or a short definition) and must not contain the word or its reading. Add a "context" sentence in Japanese with the word replaced by ＿＿ when the meaning alone is ambiguous. "answers" lists the word as written and every valid reading in hiragana (at least one hiragana reading).
- Language: write every question prompt, every option that is a meaning or explanation, and the "title" in ${brief.learner.prompt_language}. Japanese words, readings, example sentences and "context" stay in Japanese. Never write prompts or meanings in English unless the language above is English.
- Translations: the learner can switch the app language, so also fill in ${TRANSLATION_KEYS}:
  - "title_i18n": the title in each language.
  - "i18n" on every multiple_choice question: { "prompt": ..., "options": [...] } per language. Include "options" only when the options are meanings or explanations, in the same order as "options". Leave it out when the options are Japanese words.
  - "i18n" on every recall question: { "prompt": ... } per language.
  - Japanese words, readings and sentences stay in Japanese in every language.
- Use "test_id": "claude-${brief.date}-" followed by 4 random letters, and a short descriptive "title".
- Double-check every reading. A wrong answer key teaches the wrong thing.

JSON Schema:
${schema}

Brief:
${JSON.stringify(brief, null, 2)}
`;
}

const TRANSLATION_KEYS = LANGUAGES.map(
  (language) => `"${language.code}" (${language.english})`,
).join(', ');

export function translatePrompt(test: LangTest, languages: Language[]): string {
  const wanted = LANGUAGES.filter((language) =>
    languages.includes(language.code),
  )
    .map((language) => `"${language.code}" (${language.english})`)
    .join(', ');
  return `Add translations to this Kotoba practice test so the learner can read it in other app languages.

Return ONLY the complete test as one JSON object. No explanation, no Markdown code fences.

Add these languages: ${wanted}.
- "title_i18n": add the title in each of these languages.
- "i18n" on every multiple_choice question: add { "prompt": ..., "options": [...] } for each of these languages. Include "options" only when the options are meanings or explanations, in the same order as "options". Leave it out when the options are Japanese words.
- "i18n" on every recall question: add { "prompt": ... } for each of these languages.
- Japanese words, readings and sentences stay in Japanese in every language.

Do not change anything else, character for character: every other field, existing translations, the order and number of questions, "answer_index", "targets", and reading questions.

Test:
${JSON.stringify(test, null, 2)}
`;
}

type Brief = ReturnType<typeof buildBrief>;

// Returns the brief's new words that the reply has no question for. A reply
// that isn't valid JSON counts as having none, so every new word is missing.
export function missingNewWords(
  brief: Pick<Brief, 'new_words'>,
  reply: string,
): Brief['new_words'] {
  const used = new Set(targetsIn(reply));
  return brief.new_words.filter((word) => !used.has(word.expression));
}

function targetsIn(reply: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(reply);
  } catch {
    return [];
  }
  const questions = (data as { questions?: unknown })?.questions;
  if (!Array.isArray(questions)) return [];
  return questions.flatMap((question) => {
    const targets = (question as { targets?: unknown })?.targets;
    if (!Array.isArray(targets)) return [];
    return targets.flatMap((target) => {
      const expression = (target as { expression?: unknown })?.expression;
      return typeof expression === 'string'
        ? [plainExpression(expression)]
        : [];
    });
  });
}

export function missingWordsPrompt(
  test: string,
  missing: Brief['new_words'],
): string {
  return `The practice test below leaves out some new words. Add one question for each of these words, in the same format as the rest of the test.

Return ONLY the complete test as one JSON object. No explanation, no Markdown code fences.

Rules:
- Keep every existing question exactly as it is, character for character. Only add new questions, at the end.
- Each new question's "targets" uses the word's "expression" exactly as given below, with the reading from "readings".
- Write each question's prompt in the same language as the test's existing prompts. Use the meanings below so the question agrees with the learner's word list.
- Do not change "test_id" or "title".

Words to add:
${JSON.stringify(missing, null, 2)}

Test:
${test}
`;
}
