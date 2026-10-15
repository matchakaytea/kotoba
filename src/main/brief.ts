import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { LangTest } from '../shared/test-schema';
import { getBriefData } from './database';
import { localDay } from './scheduler';

export const LEARNER = {
  level: 'around JLPT N2',
  topics: ['IT', 'software engineering', 'workplace'],
  prompt_language: 'en',
};

const QUESTION_COUNT = 15;
const MAX_DUE_TARGETS = 40;

export function buildBrief(db: DatabaseSync, now = new Date()) {
  const today = localDay(now);
  const { due, mistakes } = getBriefData(db, now);
  return {
    format: 'kotoba-brief',
    format_version: 1,
    date: today,
    language: 'ja',
    learner: LEARNER,
    question_count: QUESTION_COUNT,
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
- multiple_choice: 4 options, exactly one correct, no duplicates, plausible distractors. Write prompts in English.
- Use "test_id": "claude-${brief.date}-" followed by 4 random letters, and a short descriptive "title".
- Double-check every reading. A wrong answer key teaches the wrong thing.

JSON Schema:
${schema}

Brief:
${JSON.stringify(brief, null, 2)}
`;
}
