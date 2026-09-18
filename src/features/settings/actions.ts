'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { requireTeacher } from '@/lib/auth/session';
import { humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { brandSchema } from './schema';

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
