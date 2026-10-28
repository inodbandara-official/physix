'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { requireTeacher } from '@/lib/auth/session';
import { humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { assessmentPublishIssues, getAssessmentDetail } from './queries';
import {
  addQuestionsSchema,
  createAssessmentSchema,
  randomRuleSchema,
  updateAssessmentSchema,
  type AssessmentSettingsInput,
} from './schema';

function revalidateAssessment(id?: string) {
  revalidatePath('/t/assessments');
  revalidatePath('/t/dashboard');
  revalidatePath('/s/assessments');
  revalidatePath('/s/dashboard');
  if (id) {
    revalidatePath(`/t/assessments/${id}`);
    revalidatePath(`/t/assessments/${id}/results`);
    revalidatePath(`/s/assessments/${id}`);
  }
}

function settingsRow(input: AssessmentSettingsInput) {
  return {
    title: input.title,
    description: input.description ?? null,
    kind: input.kind,
    opens_at: input.opens_at,
    closes_at: input.closes_at,
    time_limit_minutes: input.time_limit_minutes ?? null,
    max_attempts: input.max_attempts,
    pass_percentage: input.pass_percentage === undefined ? null : String(input.pass_percentage),
    negative_marking: String(input.negative_marking),
    shuffle_questions: input.shuffle_questions,
    shuffle_options: input.shuffle_options,
    show_results_immediately: input.show_results_immediately,
    show_correct_answers: input.show_correct_answers,
    show_explanations: input.show_explanations,
    allow_review: input.allow_review,
  };
}

async function syncBatches(assessmentId: string, batchIds: string[]) {
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from('assessment_batches')
    .select('batch_id')
    .eq('assessment_id', assessmentId);

  const current = new Set((existing ?? []).map((row) => row.batch_id));
  const next = new Set(batchIds);

  const toRemove = [...current].filter((id) => !next.has(id));
  const toAdd = [...next].filter((id) => !current.has(id));

  if (toRemove.length > 0) {
    await supabase.from('assessment_batches').delete().eq('assessment_id', assessmentId).in('batch_id', toRemove);
  }
  if (toAdd.length > 0) {
    await supabase
      .from('assessment_batches')
      .insert(toAdd.map((batchId) => ({ assessment_id: assessmentId, batch_id: batchId })));
  }
}

export async function createAssessmentAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  const session = await requireTeacher();

  const parsed = createAssessmentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('assessments')
    .insert({ ...settingsRow(parsed.data), created_by: session.userId })
    .select('id, title')
    .single();

  if (error || !data) return actionError(humanizeDatabaseError(error, 'The assessment could not be created.'));

  await syncBatches(data.id, parsed.data.batch_ids);

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'assessment.create',
    entityType: 'assessment',
    entityId: data.id,
    summary: `Created assessment ${data.title}.`,
  });

  revalidateAssessment(data.id);
  return actionSuccess('Assessment created. Now add its questions.', { id: data.id });
}

export async function updateAssessmentAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  const session = await requireTeacher();

  const parsed = updateAssessmentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { id } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('assessments').update(settingsRow(parsed.data)).eq('id', id);

  if (error) return actionError(humanizeDatabaseError(error, 'The assessment could not be saved.'));

  await syncBatches(id, parsed.data.batch_ids);

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'assessment.update',
    entityType: 'assessment',
    entityId: id,
    summary: `Updated the settings of ${parsed.data.title}.`,
  });

  revalidateAssessment(id);
  return actionSuccess('Settings saved.', { id });
}

// ---------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------

async function nextPosition(assessmentId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('assessment_items')
    .select('position')
    .eq('assessment_id', assessmentId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 10;
}

export async function addQuestionsAction(
  _prev: ActionState<{ added: number }>,
  formData: FormData,
): Promise<ActionState<{ added: number }>> {
  await requireTeacher();

  const parsed = addQuestionsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { assessment_id: assessmentId, question_ids: questionIds } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: already } = await supabase
    .from('assessment_items')
    .select('question_id')
    .eq('assessment_id', assessmentId)
    .eq('kind', 'question');
  const taken = new Set((already ?? []).map((row) => row.question_id));
  const fresh = [...new Set(questionIds)].filter((id) => !taken.has(id));
  if (fresh.length === 0) return actionSuccess('Those questions are already in the assessment.', { added: 0 });

  const start = await nextPosition(assessmentId);
  const { error } = await supabase.from('assessment_items').insert(
    fresh.map((questionId, index) => ({
      assessment_id: assessmentId,
      position: start + index * 10,
      kind: 'question' as const,
      question_id: questionId,
    })),
  );

  if (error) return actionError(humanizeDatabaseError(error, 'The questions could not be added.'));

  revalidateAssessment(assessmentId);
  return actionSuccess(`Added ${fresh.length} question${fresh.length === 1 ? '' : 's'}.`, { added: fresh.length });
}

export async function saveRandomRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireTeacher();

  const parsed = randomRuleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const fields = {
    pick_count: input.pick_count,
    syllabus_node_id: input.syllabus_node_id ?? null,
    difficulties: input.difficulties,
    question_types: input.question_types,
    marks: input.marks === undefined ? null : String(input.marks),
  };

  const { error } = input.item_id
    ? await supabase
        .from('assessment_items')
        .update(fields)
        .eq('id', input.item_id)
        .eq('assessment_id', input.assessment_id)
    : await supabase.from('assessment_items').insert({
        ...fields,
        assessment_id: input.assessment_id,
        position: await nextPosition(input.assessment_id),
        kind: 'random',
      });

  if (error) return actionError(humanizeDatabaseError(error, 'The rule could not be saved.'));

  revalidateAssessment(input.assessment_id);
  return actionSuccess(input.item_id ? 'Rule updated.' : 'Random rule added.');
}

export async function removeItemAction(itemId: string): Promise<ActionState> {
  await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { data: item } = await supabase.from('assessment_items').select('assessment_id').eq('id', itemId).maybeSingle();
  if (!item) return actionError('That item could not be found.');

  const { error } = await supabase.from('assessment_items').delete().eq('id', itemId);
  if (error) return actionError(humanizeDatabaseError(error, 'The item could not be removed.'));

  revalidateAssessment(item.assessment_id);
  return actionSuccess('Removed.');
}

/** Swaps an item with its neighbour. Positions are spaced by ten, so a swap is two writes. */
export async function moveItemAction(itemId: string, direction: 'up' | 'down'): Promise<ActionState> {
  await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { data: item } = await supabase
    .from('assessment_items')
    .select('id, assessment_id, position')
    .eq('id', itemId)
    .maybeSingle();
  if (!item) return actionError('That item could not be found.');

  const { data: siblings } = await supabase
    .from('assessment_items')
    .select('id, position')
    .eq('assessment_id', item.assessment_id)
    .order('position')
    .order('created_at');

  const list = siblings ?? [];
  const index = list.findIndex((row) => row.id === itemId);
  const swapWith = list[direction === 'up' ? index - 1 : index + 1];
  if (!swapWith) return actionSuccess('Already there.');

  // Renumber the whole list so ties from equal positions cannot persist.
  const reordered = [...list];
  [reordered[index], reordered[direction === 'up' ? index - 1 : index + 1]] = [swapWith, reordered[index]];

  for (const [order, row] of reordered.entries()) {
    const position = (order + 1) * 10;
    if (row.position === position) continue;
    const { error } = await supabase.from('assessment_items').update({ position }).eq('id', row.id);
    if (error) return actionError(humanizeDatabaseError(error, 'The order could not be changed.'));
  }

  revalidateAssessment(item.assessment_id);
  return actionSuccess('Moved.');
}

// ---------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------

export async function publishAssessmentAction(id: string): Promise<ActionState> {
  const session = await requireTeacher();

  const detail = await getAssessmentDetail(id);
  if (!detail) return actionError('That assessment could not be found.');

  const issues = assessmentPublishIssues(detail);
  if (issues.length > 0) return actionError(issues[0], { _form: issues });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('assessments')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return actionError(humanizeDatabaseError(error, 'The assessment could not be published.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'assessment.publish',
    entityType: 'assessment',
    entityId: id,
    summary: `Published ${detail.assessment.title}.`,
  });

  revalidateAssessment(id);
  return actionSuccess('Published. Students in the chosen batches can now see it.');
}

export async function unpublishAssessmentAction(id: string): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { count } = await supabase.from('attempts').select('id', { count: 'exact', head: true }).eq('assessment_id', id);
  if ((count ?? 0) > 0) {
    return actionError('Students have already started this assessment. Close it by setting a closing time, or archive it.');
  }

  const { error } = await supabase.from('assessments').update({ status: 'draft', published_at: null }).eq('id', id);
  if (error) return actionError(humanizeDatabaseError(error, 'The assessment could not be moved back to draft.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'assessment.unpublish',
    entityType: 'assessment',
    entityId: id,
    summary: 'Moved an assessment back to draft.',
  });

  revalidateAssessment(id);
  return actionSuccess('Moved back to draft.');
}

export async function archiveAssessmentAction(id: string, archive: boolean): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('assessments')
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return actionError(humanizeDatabaseError(error, 'The assessment could not be updated.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: archive ? 'assessment.archive' : 'assessment.restore',
    entityType: 'assessment',
    entityId: id,
    summary: archive ? 'Archived an assessment.' : 'Restored an assessment.',
  });

  revalidateAssessment(id);
  return actionSuccess(archive ? 'Archived. Students keep their results.' : 'Restored.');
}

export async function deleteAssessmentAction(id: string): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { count } = await supabase.from('attempts').select('id', { count: 'exact', head: true }).eq('assessment_id', id);
  if ((count ?? 0) > 0) return actionError('This assessment has attempts, so it is part of the record. Archive it instead.');

  const { error } = await supabase.from('assessments').delete().eq('id', id);
  if (error) return actionError(humanizeDatabaseError(error, 'The assessment could not be deleted.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'assessment.delete',
    entityType: 'assessment',
    entityId: id,
    summary: 'Deleted a draft assessment.',
  });

  revalidateAssessment();
  return actionSuccess('Deleted.');
}

/** Copies settings, batches and questions into a new draft — the way to change a paper once it has been sat. */
export async function duplicateAssessmentAction(id: string): Promise<ActionState<{ id: string }>> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { data: source } = await supabase.from('assessments').select('*').eq('id', id).maybeSingle();
  if (!source) return actionError('That assessment could not be found.');

  const { data: copy, error } = await supabase
    .from('assessments')
    .insert({
      title: `${source.title} (copy)`,
      description: source.description,
      kind: source.kind,
      status: 'draft',
      opens_at: source.opens_at,
      closes_at: source.closes_at,
      time_limit_minutes: source.time_limit_minutes,
      max_attempts: source.max_attempts,
      shuffle_questions: source.shuffle_questions,
      shuffle_options: source.shuffle_options,
      pass_percentage: source.pass_percentage,
      negative_marking: source.negative_marking,
      show_results_immediately: source.show_results_immediately,
      show_correct_answers: source.show_correct_answers,
      show_explanations: source.show_explanations,
      allow_review: source.allow_review,
      created_by: session.userId,
    })
    .select('id')
    .single();
  if (error || !copy) return actionError(humanizeDatabaseError(error, 'The assessment could not be duplicated.'));

  const [{ data: items }, { data: batches }] = await Promise.all([
    supabase.from('assessment_items').select('*').eq('assessment_id', id),
    supabase.from('assessment_batches').select('batch_id').eq('assessment_id', id),
  ]);

  if (items && items.length > 0) {
    await supabase.from('assessment_items').insert(
      items.map((item) => ({
        assessment_id: copy.id,
        position: item.position,
        kind: item.kind,
        question_id: item.question_id,
        pick_count: item.pick_count,
        syllabus_node_id: item.syllabus_node_id,
        difficulties: item.difficulties,
        question_types: item.question_types,
        marks: item.marks,
      })),
    );
  }
  if (batches && batches.length > 0) {
    await supabase
      .from('assessment_batches')
      .insert(batches.map((row) => ({ assessment_id: copy.id, batch_id: row.batch_id })));
  }

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'assessment.duplicate',
    entityType: 'assessment',
    entityId: copy.id,
    summary: `Duplicated ${source.title}.`,
  });

  revalidateAssessment(copy.id);
  return actionSuccess('Duplicated as a new draft.', { id: copy.id });
}

export async function releaseResultsAction(id: string): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('assessments')
    .update({ results_released_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return actionError(humanizeDatabaseError(error, 'The results could not be released.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'assessment.release_results',
    entityType: 'assessment',
    entityId: id,
    summary: 'Released results to students.',
  });

  revalidateAssessment(id);
  return actionSuccess('Results released. Students can see them now.');
}
