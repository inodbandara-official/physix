'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { requireTeacher } from '@/lib/auth/session';
import { humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

export async function updateBrandAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireTeacher();

  const parsed = brandSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('app_settings')
    .update({
      lms_name: parsed.data.lms_name,
      tagline: parsed.data.tagline,
      teacher_name: parsed.data.teacher_name ?? null,
      logo_url: parsed.data.logo_url ?? null,
      primary_color: parsed.data.primary_color,
      secondary_color: parsed.data.secondary_color,
      contact_email: parsed.data.contact_email ?? null,
      contact_phone: parsed.data.contact_phone ?? null,
    })
    .eq('id', true);

  if (error) return actionError(humanizeDatabaseError(error, 'The settings could not be saved.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'settings.brand_update',
    entityType: 'app_settings',
    summary: `Updated branding for ${parsed.data.lms_name}.`,
  });

  revalidatePath('/', 'layout');
  return actionSuccess('Settings saved.');
}
