'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { requireTeacher } from '@/lib/auth/session';
import { humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import { saveTranslationSchema } from './schema';
import type { QuestionTranslations } from './translation';

/**
 * Saving a translation does **not** create a new question version.
 *
 * A version exists to make a completed attempt reproducible — what the
 * student saw, and how it was marked. A translation changes neither the
 * marking nor the English original, so forking a version for every
 * corrected typo in the Sinhala text would bloat the history without
 * protecting anything.
 */
export async function saveTranslationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireTeacher();

  const raw = formDataToObject(formData);
  const payload = formData.get('translation');
  if (typeof payload === 'string' && payload !== '') {
    try {
      raw.translation = JSON.parse(payload);
    } catch {
      return actionError('The translation could not be read. Try again.');
    }
  }

  const parsed = saveTranslationSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { question_id: questionId, language, translation } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: question } = await supabase
    .from('questions')
    .select('current_version_id, question_code')
    .eq('id', questionId)
    .maybeSingle();

  if (!question?.current_version_id) return actionError('That question could not be found.');

  const { data: version } = await supabase
    .from('question_versions')
    .select('translations')
    .eq('id', question.current_version_id)
    .maybeSingle();

  if (!version) return actionError('That question has no content to translate.');

  const existing = (version.translations ?? {}) as QuestionTranslations;
  const next: QuestionTranslations = { ...existing, [language]: translation };

  const { error } = await supabase
    .from('question_versions')
    .update({ translations: next as unknown as Json })
    .eq('id', question.current_version_id);

  if (error) return actionError(humanizeDatabaseError(error, 'The translation could not be saved.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: translation.reviewed ? 'question.translation_publish' : 'question.translation_draft',
    entityType: 'question',
    entityId: questionId,
    summary: translation.reviewed
      ? `Published the Sinhala translation of ${question.question_code}.`
      : `Saved a draft Sinhala translation of ${question.question_code}.`,
    metadata: { language },
  });

  revalidatePath('/t/questions');
  revalidatePath(`/t/questions/${questionId}`);
  revalidatePath(`/t/questions/${questionId}/translate`);

  return actionSuccess(
    translation.reviewed
      ? 'Translation published. Students reading Sinhala will see it now.'
      : 'Draft saved. Students still see English until you mark it reviewed.',
  );
}

/** Removes a translation entirely, returning the question to English only. */
export async function removeTranslationAction(questionId: string): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { data: question } = await supabase
    .from('questions')
    .select('current_version_id, question_code')
    .eq('id', questionId)
    .maybeSingle();

  if (!question?.current_version_id) return actionError('That question could not be found.');

  const { error } = await supabase
    .from('question_versions')
    .update({ translations: {} as unknown as Json })
    .eq('id', question.current_version_id);

  if (error) return actionError(humanizeDatabaseError(error, 'The translation could not be removed.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'question.translation_remove',
    entityType: 'question',
    entityId: questionId,
    summary: `Removed the Sinhala translation of ${question.question_code}.`,
  });

  revalidatePath('/t/questions');
  revalidatePath(`/t/questions/${questionId}`);
  return actionSuccess('Translation removed.');
}
