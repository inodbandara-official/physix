import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const batchSchema = z.object({
  name: z.string().trim().min(2, 'Give the batch a name.').max(80),
  code: optionalText(24),
  al_year: z.coerce
    .number()
    .int()
    .min(2000, 'Enter a four-digit A/L year.')
    .max(2100, 'Enter a four-digit A/L year.')
    .optional(),
  description: optionalText(500),
  schedule_note: optionalText(120),
});

export const createBatchSchema = batchSchema;
export const updateBatchSchema = batchSchema.extend({ id: z.string().uuid() });

export const batchMembershipSchema = z.object({
  batch_id: z.string().uuid(),
  student_ids: z.array(z.string().uuid()).min(1, 'Select at least one student.'),
});

export const moveStudentsSchema = z.object({
  from_batch_id: z.string().uuid(),
  to_batch_id: z.string().uuid(),
  student_ids: z.array(z.string().uuid()).min(1, 'Select at least one student.'),
});

export type BatchInput = z.infer<typeof batchSchema>;
