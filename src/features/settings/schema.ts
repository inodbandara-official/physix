import { z } from 'zod';

/**
 * Branding validation.
 *
 * Kept out of `actions.ts` because a `'use server'` module may only export
 * async functions — anything else becomes a runtime error when Next builds
 * the action manifest.
 */

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour, e.g. #2f6bff.');

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const brandSchema = z.object({
  lms_name: z.string().trim().min(2, 'Give the LMS a name.').max(40),
  tagline: z.string().trim().min(2, 'Add a short tagline.').max(80),
  teacher_name: optional(120),
  logo_url: z
    .string()
    .trim()
    .url('Enter a valid image URL.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  primary_color: hexColor,
  secondary_color: hexColor,
  contact_email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  contact_phone: optional(32),
});

export type BrandInput = z.infer<typeof brandSchema>;
