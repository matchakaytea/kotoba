import { z } from 'zod';
import { Target } from './test-schema';

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

export interface KotobaApi {
  saveAttempt(input: AttemptInput): Promise<void>;
  getSummary(): Promise<Summary>;
}
