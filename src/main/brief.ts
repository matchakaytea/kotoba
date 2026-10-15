import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { LANGUAGES } from '../shared/api';
import { LangTest } from '../shared/test-schema';
import { getBriefData, getSettings } from './database';
import { localDay } from './scheduler';

const MAX_DUE_TARGETS = 40;

export function buildBrief(db: DatabaseSync, now = new Date()) {
  const today = localDay(now);
  const { due, mistakes } = getBriefData(db, now);
  const settings = getSettings(db);
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
  };
}

export function briefPrompt(brief: ReturnType<typeof buildBrief>): string {
  const schema = JSON.stringify(z.toJSONSchema(LangTest), null, 2);
  return `You are writing a Japanese practice test for the Kotoba app.

Return ONLY one JSON object that matches the JSON Schema below. No explanation, no Markdown code fences.

Rules:
- Write about ${brief.question_count} questions using only these templates: ${brief.supported_templates.join(', ')}.
- Cover every target in "due_targets" first, starting with overdue ones and recent mistakes. Test each one in a fresh way or a new context sentence, not word for word as before.
- Fill the remaining questions with new, useful words for a learner ${brief.learner.level}, on these topics: ${brief.learner.topics.join(', ')}.
- Every question lists its targets: { expression, reading, skill }. Use skill "reading" for reading questions and "meaning" for multiple-choice meaning questions.
- reading: "prompt" is the word in kanji, "answers" lists every valid reading in hiragana only. Add a "context" sentence when the reading depends on it.
- multiple_choice: 4 options, exactly one correct, no duplicates, plausible distractors.
- Language: write every question prompt, every option that is a meaning or explanation, and the "title" in ${brief.learner.prompt_language}. Japanese words, readings, example sentences and "context" stay in Japanese. Never write prompts or meanings in English unless the language above is English.
- Use "test_id": "claude-${brief.date}-" followed by 4 random letters, and a short descriptive "title".
- Double-check every reading. A wrong answer key teaches the wrong thing.

JSON Schema:
${schema}

Brief:
${JSON.stringify(brief, null, 2)}
`;
}

export function translatePrompt(test: LangTest, language: string): string {
  return `Translate this Kotoba practice test for a learner whose app language is ${language}.

Return ONLY the translated test as one JSON object with exactly the same structure. No explanation, no Markdown code fences.

Translate into ${language}:
- "title"
- every "prompt" of a multiple_choice question
- every multiple_choice option that is a meaning, definition or explanation (not a Japanese word)

Keep exactly as they are, character for character:
- "format", "format_version", "test_id", "language"
- the order and number of questions, every "template", "answer_index" and "targets"
- reading questions entirely: "prompt", "answers" and "context"
- every Japanese word, reading or sentence, wherever it appears

If something is already in ${language}, leave it unchanged.

Test:
${JSON.stringify(test, null, 2)}
`;
}
