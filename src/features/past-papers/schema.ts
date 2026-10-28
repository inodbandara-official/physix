import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const pastPaperSchema = z.object({
  year: z.coerce.number().int().min(1950, 'Enter a four-digit year.').max(2100, 'Enter a four-digit year.'),
  title: z.string().trim().min(2, 'Name the paper, e.g. Physics Paper II.').max(80),
  description: optionalText(1000),
});

export const updatePastPaperSchema = pastPaperSchema.extend({ id: z.string().uuid() });

export const addPaperQuestionsSchema = z.object({
  paper_id: z.string().uuid(),
  question_ids: z.array(z.string().uuid()).min(1, 'Select at least one question.').max(100),
});

export const paperQuestionSchema = z.object({
  paper_id: z.string().uuid(),
  question_id: z.string().uuid(),
  question_number: z.string().trim().min(1, 'Give it a number, e.g. 04.').max(12),
  section: optionalText(40),
});

/** What a student asks to practise. Every field narrows; none is required. */
export const practiceFilterSchema = z.object({
  paper_id: z.string().uuid().optional(),
  section: z.string().trim().min(1).max(40).optional(),
  years: z.array(z.coerce.number().int().min(1950).max(2100)).max(30).optional(),
  node_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  label: z.string().trim().max(160).optional(),
});

export type PracticeFilter = z.infer<typeof practiceFilterSchema>;
