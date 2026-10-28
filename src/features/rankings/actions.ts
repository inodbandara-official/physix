'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { requireTeacher } from '@/lib/auth/session';
import { humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { rankingSettingsSchema } from './schema';

export async function saveRankingSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireTeacher();

  const parsed = rankingSettingsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const weights = {
    practice: input.weight_practice,
    class_test: input.weight_class_test,
    unit_test: input.weight_unit_test,
    term_test: input.weight_term_test,
    mock_exam: input.weight_mock_exam,
    revision: input.weight_revision,
    custom: input.weight_custom,
  };
  if (Object.values(weights).every((value) => value === 0)) {
    return actionError('At least one test type needs a weight above 0, or nothing would count.');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('ranking_settings')
    .update({
      basis: input.basis,
      recent_count: input.recent_count,
      missed_counts_zero: input.missed_counts_zero,
      student_visibility: input.student_visibility,
      weights,
    })
    .eq('id', true);

  if (error) return actionError(humanizeDatabaseError(error, 'The ranking settings could not be saved.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'ranking.settings',
    entityType: 'ranking_settings',
    summary: `Ranking set to ${input.basis}, visible to students as ${input.student_visibility}.`,
  });

  revalidatePath('/t/rankings');
  revalidatePath('/s/rankings');
  revalidatePath('/s/progress');
  return actionSuccess('Ranking settings saved.');
}
