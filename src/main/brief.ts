import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { LANGUAGES, type Language } from '../shared/api';
import { LangTest } from '../shared/test-schema';
import { getBriefData, getSettings } from './database';
import { jlptLevelOf, pickNewWords } from './jlpt';
import { localDay } from './scheduler';

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
    settings.wordSource === 'jlpt' ? jlptLevelOf(settings.level) : null;
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
    supported_templates: ['reading', 'multiple_choice'],
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
    new_words: newWords.map((word) => ({
      expression: word.expression,
      readings: word.readings,
      meaning: word.meaning,
      ...(word.note ? { note: word.note } : {}),
    })),
  };
}

function newWordsRule(brief: ReturnType<typeof buildBrief>): string {
  const topics = brief.learner.topics.join(', ');
  if (brief.new_words.length === 0) {
    return `- Fill the remaining questions with new, useful words for a learner ${brief.learner.level}, on these topics: ${topics}.`;
  }
  return `- Fill the remaining questions with the words in "new_words" (from the ${brief.word_list} vocabulary list), one question per word, in the order given. Use the topics (${topics}) as the theme of the prompts and example sentences. In "targets", use each word's "expression" exactly as written.`;
}

export function briefPrompt(brief: ReturnType<typeof buildBrief>): string {
  const schema = JSON.stringify(z.toJSONSchema(LangTest), null, 2);
  return `You are writing a Japanese practice test for the Kotoba app.

Return ONLY one JSON object that matches the JSON Schema below. No explanation, no Markdown code fences.

Rules:
- Write about ${brief.question_count} questions using only these templates: ${brief.supported_templates.join(', ')}.
- Cover every target in "due_targets" first, starting with overdue ones and recent mistakes. Test each one in a fresh way or a new context sentence, not word for word as before.
${newWordsRule(brief)}
- Every question lists its targets: { expression, reading, skill }. Use skill "reading" for reading questions and "meaning" for multiple-choice meaning questions.
- reading: "prompt" is the word in kanji, "answers" lists every valid reading in hiragana only. Add a "context" sentence when the reading depends on it.
- multiple_choice: 4 options, exactly one correct, no duplicates, plausible distractors.
- Language: write every question prompt, every option that is a meaning or explanation, and the "title" in ${brief.learner.prompt_language}. Japanese words, readings, example sentences and "context" stay in Japanese. Never write prompts or meanings in English unless the language above is English.
- Translations: the learner can switch the app language, so also fill in ${TRANSLATION_KEYS}:
  - "title_i18n": the title in each language.
  - "i18n" on every multiple_choice question: { "prompt": ..., "options": [...] } per language. Include "options" only when the options are meanings or explanations, in the same order as "options". Leave it out when the options are Japanese words.
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
- Japanese words, readings and sentences stay in Japanese in every language.

Do not change anything else, character for character: every other field, existing translations, the order and number of questions, "answer_index", "targets", and reading questions.

Test:
${JSON.stringify(test, null, 2)}
`;
}
