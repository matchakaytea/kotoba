import { z } from 'zod';

// What a question practices: a word (or grammar point) + which skill.
export const Skill = z.enum(['reading', 'meaning', 'usage', 'grammar', 'production']);

export const Target = z.strictObject({
  expression: z.string().min(1),
  reading: z.string().min(1).optional(),
  skill: Skill,
});

// Template: multiple_choice
export const MultipleChoiceQuestion = z.strictObject({
  template: z.literal('multiple_choice'),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(6),
  answer_index: z.number().int().min(0),
  targets: z.array(Target).min(1),
});

// The whole test file
export const LangTest = z.strictObject({
  format: z.literal('langtest'),
  format_version: z.literal(1),
  test_id: z.string().min(1),
  language: z.literal('ja'),
  title: z.string().min(1),
  questions: z.array(MultipleChoiceQuestion).min(1),
});

// TypeScript types, generated from the schemas above
export type Target = z.infer<typeof Target>;
export type MultipleChoiceQuestion = z.infer<typeof MultipleChoiceQuestion>;
export type LangTest = z.infer<typeof LangTest>;