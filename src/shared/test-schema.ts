import { z } from 'zod';

export const Skill = z.enum(['reading', 'meaning', 'usage', 'grammar', 'production']);

export const Target = z.strictObject({
  expression: z.string().min(1),
  reading: z.string().min(1).optional(),
  skill: Skill,
});

export const MultipleChoiceQuestion = z
  .strictObject({
    template: z.literal('multiple_choice'),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    answer_index: z.number().int().min(0),
    targets: z.array(Target).min(1),
  })
  .refine((q) => q.answer_index < q.options.length, {
    error: 'answer_index must point to one of the options',
    path: ['answer_index'],
  })
  .refine((q) => new Set(q.options).size === q.options.length, {
    error: 'options must not contain duplicates',
    path: ['options'],
  });

const KANA = /^[ぁ-ゖァ-ヺー]+$/;

export const ReadingQuestion = z.strictObject({
  template: z.literal('reading'),
  prompt: z.string().min(1),
  context: z.string().min(1).optional(),
  answers: z.array(z.string().regex(KANA, { error: 'answers must be kana only' })).min(1),
  targets: z.array(Target).min(1),
});

export const Question = z.discriminatedUnion('template', [
  MultipleChoiceQuestion,
  ReadingQuestion,
]);

export const LangTest = z.strictObject({
  format: z.literal('langtest'),
  format_version: z.literal(1),
  test_id: z.string().min(1),
  language: z.literal('ja'),
  title: z.string().min(1),
  questions: z.array(Question).min(1),
});

export type Target = z.infer<typeof Target>;
export type MultipleChoiceQuestion = z.infer<typeof MultipleChoiceQuestion>;
export type LangTest = z.infer<typeof LangTest>;
export type ReadingQuestion = z.infer<typeof ReadingQuestion>;
export type Question = z.infer<typeof Question>;