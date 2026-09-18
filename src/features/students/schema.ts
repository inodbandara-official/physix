import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

const phone = optionalText(32).refine(
  (value) => value === undefined || /^[+0-9()\s-]{6,32}$/.test(value),
  'Enter a valid phone number.',
);

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export const accountStatusSchema = z.enum(['active', 'inactive', 'suspended']);

export const studentSchema = z.object({
  student_code: z
    .string()
    .trim()
    .min(2, 'Student ID must be at least 2 characters.')
    .max(32, 'Student ID must be 32 characters or fewer.')
    .regex(/^[A-Za-z0-9/-]+$/, 'Use letters, numbers, hyphens and slashes only.'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_PATTERN, 'Username must be 3–32 characters: lowercase letters, numbers, . _ -'),
  full_name: z.string().trim().min(2, 'Enter the student’s full name.').max(120),
  preferred_name: optionalText(60),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone,
  guardian_name: optionalText(120),
  guardian_phone: phone,
  school: optionalText(120),
  district: optionalText(60),
  al_year: z.coerce
    .number()
    .int()
    .min(2000, 'Enter a four-digit A/L year.')
    .max(2100, 'Enter a four-digit A/L year.')
    .optional(),
  status: accountStatusSchema.default('active'),
  joined_on: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker.')
    .optional(),
  notes: optionalText(2000),
  batch_ids: z.array(z.string().uuid()).default([]),
});

export const createStudentSchema = studentSchema;
export const updateStudentSchema = studentSchema.extend({ id: z.string().uuid() });

export const studentFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  batch: z.string().uuid().optional(),
  status: accountStatusSchema.optional(),
  archived: z.enum(['active', 'archived', 'all']).default('active'),
  /** Who can be emailed — the roll you can actually send a notification to. */
  contact: z.enum(['any', 'with-email', 'without-email']).default('any'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(100).default(25),
});

export const setPasswordSchema = z.object({
  student_id: z.string().uuid(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be 72 characters or fewer.')
    .optional(),
});

export const studentNoteSchema = z.object({
  student_id: z.string().uuid(),
  body: z.string().trim().min(1, 'Write a note before saving.').max(4000),
  published: z.coerce.boolean().default(false),
});

export type StudentInput = z.infer<typeof studentSchema>;
export type StudentFilters = z.infer<typeof studentFiltersSchema>;
export type StudentNoteInput = z.infer<typeof studentNoteSchema>;
