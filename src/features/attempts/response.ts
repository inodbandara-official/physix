import { z } from 'zod';

import type { QuestionResponse, SimpleResponse } from '@/features/questions/marking/mark-question';

/**
 * What a student may send as an answer.
 *
 * Validated on every save: the shape must be one the marking engine
 * understands, and nothing in it can be large enough to matter. Whether
 * the *kind* matches the question is left to the engine, which treats a
 * mismatched response as unanswered rather than trusting it.
 */

const id = z.string().min(1).max(64);

export const simpleResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mcq'), optionId: id.nullable() }),
  z.object({ kind: z.literal('multi'), optionIds: z.array(id).max(12) }),
  z.object({ kind: z.literal('true_false'), value: z.boolean().nullable() }),
  z.object({ kind: z.literal('numerical'), text: z.string().max(120) }),
  z.object({ kind: z.literal('short_answer'), text: z.string().max(500) }),
  z.object({ kind: z.literal('essay'), text: z.string().max(20000) }),
]);

export const questionResponseSchema: z.ZodType<QuestionResponse> = z.union([
  simpleResponseSchema,
  z.object({
    kind: z.literal('structured'),
    parts: z.record(id, simpleResponseSchema.optional()),
  }),
]);

export const answerEntrySchema = z.object({
  attemptQuestionId: z.string().uuid(),
  response: questionResponseSchema.nullable(),
  flagged: z.boolean(),
});

export const saveAnswersSchema = z.object({
  attemptId: z.string().uuid(),
  // A full paper saved at once, as happens on submit or after reconnecting.
  entries: z.array(answerEntrySchema).max(200),
});

export type AnswerEntry = z.infer<typeof answerEntrySchema>;

/** Whether a response contains anything the student actually chose or wrote. */
export function isAnswered(response: QuestionResponse | null | undefined): boolean {
  if (!response) return false;
  if (response.kind === 'structured') {
    return Object.values(response.parts).some((part) => isSimpleAnswered(part));
  }
  return isSimpleAnswered(response);
}

export function isSimpleAnswered(response: SimpleResponse | null | undefined): boolean {
  if (!response) return false;
  switch (response.kind) {
    case 'mcq':
      return response.optionId !== null;
    case 'multi':
      return response.optionIds.length > 0;
    case 'true_false':
      return response.value !== null;
    case 'numerical':
    case 'short_answer':
    case 'essay':
      return response.text.trim() !== '';
  }
}

/** Reads a stored JSONB response defensively: anything malformed counts as no answer. */
export function parseStoredResponse(value: unknown): QuestionResponse | null {
  const parsed = questionResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
