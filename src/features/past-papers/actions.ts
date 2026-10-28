'use server';

import { revalidatePath } from 'next/cache';

import { finalizeAttemptPrivileged } from '@/features/attempts/privileged';
import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { requireStudent, requireTeacher } from '@/lib/auth/session';
import { humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import {
  addPaperQuestionsSchema,
  pastPaperSchema,
  paperQuestionSchema,
  practiceFilterSchema,
  updatePastPaperSchema,
} from './schema';

function revalidatePapers(id?: string) {
  revalidatePath('/t/past-papers');
  revalidatePath('/s/past-papers');
  if (id) revalidatePath(`/t/past-papers/${id}`);
}

// ---------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------

export async function createPastPaperAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  const session = await requireTeacher();

  const parsed = pastPaperSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('past_papers')
    .insert({ ...parsed.data, description: parsed.data.description ?? null })
    .select('id')
    .single();

  if (error || !data) {
    return actionError(
      error?.code === '23505'
        ? 'A paper with this title already exists for that year.'
        : humanizeDatabaseError(error, 'The paper could not be created.'),
    );
  }

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'past_paper.create',
    entityType: 'past_paper',
    entityId: data.id,
    summary: `Created past paper ${parsed.data.year} ${parsed.data.title}.`,
  });

  revalidatePapers(data.id);
  return actionSuccess('Paper created. Now add its questions.', { id: data.id });
}

export async function updatePastPaperAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  await requireTeacher();

  const parsed = updatePastPaperSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { id, ...fields } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('past_papers')
    .update({ ...fields, description: fields.description ?? null })
    .eq('id', id);

  if (error) {
    return actionError(
      error.code === '23505'
        ? 'A paper with this title already exists for that year.'
        : humanizeDatabaseError(error, 'The paper could not be saved.'),
    );
  }

  revalidatePapers(id);
  return actionSuccess('Paper saved.', { id });
}

export async function setPastPaperPublishedAction(id: string, published: boolean): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  if (published) {
    const { data: links } = await supabase.from('past_paper_questions').select('question_id').eq('paper_id', id);
    if (!links || links.length === 0) return actionError('Add at least one question before publishing.');

    const { data: questions } = await supabase
      .from('questions')
      .select('question_code, status, archived_at')
      .in(
        'id',
        links.map((link) => link.question_id),
      );
    const unready = (questions ?? []).filter((question) => question.status !== 'published' || question.archived_at);
    if (unready.length > 0) {
      return actionError(
        `${unready.map((question) => question.question_code).join(', ')} ${unready.length === 1 ? 'is' : 'are'} not published. Students would not be given ${unready.length === 1 ? 'it' : 'them'}.`,
      );
    }
  }

  const { error } = await supabase.from('past_papers').update({ published }).eq('id', id);
  if (error) return actionError(humanizeDatabaseError(error, 'The paper could not be updated.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: published ? 'past_paper.publish' : 'past_paper.unpublish',
    entityType: 'past_paper',
    entityId: id,
    summary: published ? 'Published a past paper.' : 'Hid a past paper from students.',
  });

  revalidatePapers(id);
  return actionSuccess(published ? 'Published. Students can practise it now.' : 'Hidden from students.');
}

/** Removing a paper never touches its questions, nor any practice already done. */
export async function deletePastPaperAction(id: string): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from('past_papers').delete().eq('id', id);
  if (error) return actionError(humanizeDatabaseError(error, 'The paper could not be deleted.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'past_paper.delete',
    entityType: 'past_paper',
    entityId: id,
    summary: 'Deleted a past paper. Its questions stay in the bank.',
  });

  revalidatePapers();
  return actionSuccess('Paper deleted. Its questions remain in your bank.');
}

export async function addPaperQuestionsAction(
  _prev: ActionState<{ added: number }>,
  formData: FormData,
): Promise<ActionState<{ added: number }>> {
  await requireTeacher();

  const parsed = addPaperQuestionsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { paper_id: paperId, question_ids: questionIds } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from('past_paper_questions')
    .select('question_id, position')
    .eq('paper_id', paperId);
  const taken = new Set((existing ?? []).map((row) => row.question_id));
  const fresh = [...new Set(questionIds)].filter((id) => !taken.has(id));
  if (fresh.length === 0) return actionSuccess('Those questions are already on this paper.', { added: 0 });

  const start = Math.max(0, ...(existing ?? []).map((row) => row.position));
  const count = existing?.length ?? 0;

  const { error } = await supabase.from('past_paper_questions').insert(
    fresh.map((questionId, index) => ({
      paper_id: paperId,
      question_id: questionId,
      // Numbered on from the last; the teacher corrects any that differ from the real paper.
      question_number: String(count + index + 1).padStart(2, '0'),
      position: start + (index + 1) * 10,
    })),
  );

  if (error) return actionError(humanizeDatabaseError(error, 'The questions could not be added.'));

  revalidatePapers(paperId);
  return actionSuccess(`Added ${fresh.length} question${fresh.length === 1 ? '' : 's'}.`, { added: fresh.length });
}

export async function updatePaperQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireTeacher();

  const parsed = paperQuestionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { paper_id: paperId, question_id: questionId, question_number, section } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('past_paper_questions')
    .update({ question_number, section: section ?? null })
    .eq('paper_id', paperId)
    .eq('question_id', questionId);

  if (error) return actionError(humanizeDatabaseError(error, 'The question could not be saved.'));

  revalidatePapers(paperId);
  return actionSuccess('Saved.');
}

export async function removePaperQuestionAction(paperId: string, questionId: string): Promise<ActionState> {
  await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('past_paper_questions')
    .delete()
    .eq('paper_id', paperId)
    .eq('question_id', questionId);
  if (error) return actionError(humanizeDatabaseError(error, 'The question could not be removed.'));

  revalidatePapers(paperId);
  return actionSuccess('Removed from the paper. It stays in your bank.');
}

export async function movePaperQuestionAction(
  paperId: string,
  questionId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from('past_paper_questions')
    .select('question_id, position')
    .eq('paper_id', paperId)
    .order('position')
    .order('created_at');

  const list = rows ?? [];
  const index = list.findIndex((row) => row.question_id === questionId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= list.length) return actionSuccess('Already there.');

  const reordered = [...list];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  for (const [order, row] of reordered.entries()) {
    const position = (order + 1) * 10;
    if (row.position === position) continue;
    const { error } = await supabase
      .from('past_paper_questions')
      .update({ position })
      .eq('paper_id', paperId)
      .eq('question_id', row.question_id);
    if (error) return actionError(humanizeDatabaseError(error, 'The order could not be changed.'));
  }

  revalidatePapers(paperId);
  return actionSuccess('Moved.');
}

// ---------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------

/**
 * Starts past-paper practice. It runs through the same engine as a class
 * test — so marking, review and the answer-key protections are the same —
 * against the single past-paper bank assessment.
 *
 * One practice can be open at a time. Starting another hands in the open
 * one first: for practice that is the least surprising thing, and the
 * student still gets its marks and review.
 */
export async function startPracticeAction(filter: unknown): Promise<ActionState<{ attemptId: string; closedPrevious: boolean }>> {
  const session = await requireStudent();

  const parsed = practiceFilterSchema.safeParse(filter);
  if (!parsed.success) return actionError('That practice choice could not be read.');

  const supabase = await createSupabaseServerClient();
  const { data: bank } = await supabase.from('assessments').select('id').eq('past_paper_bank', true).maybeSingle();
  if (!bank) return actionError('Past-paper practice is not set up yet.');

  const { data: open } = await supabase
    .from('attempts')
    .select('id')
    .eq('assessment_id', bank.id)
    .eq('student_id', session.student.id)
    .eq('status', 'in_progress')
    .maybeSingle();

  if (open) await finalizeAttemptPrivileged(open.id);

  const { data: attemptId, error } = await supabase.rpc('start_attempt', {
    p_assessment_id: bank.id,
    p_filter: parsed.data as unknown as Json,
  });

  if (error || !attemptId) {
    return actionError(humanizeDatabaseError(error, 'Practice could not be started. Try again.'));
  }

  revalidatePath('/s/past-papers');
  revalidatePath('/s/progress');
  return actionSuccess('Started.', { attemptId, closedPrevious: Boolean(open) });
}
