'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { requireTeacher } from '@/lib/auth/session';
import { humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { createBatchSchema, moveStudentsSchema, batchMembershipSchema, updateBatchSchema } from './schema';

function revalidateBatches(batchId?: string) {
  revalidatePath('/t/batches');
  revalidatePath('/t/students');
  revalidatePath('/t/dashboard');
  if (batchId) revalidatePath(`/t/batches/${batchId}`);
}

export async function createBatchAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  const session = await requireTeacher();

  const parsed = createBatchSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('batches').insert(parsed.data).select('id, name').single();

  if (error || !data) return actionError(humanizeDatabaseError(error, 'The batch could not be created.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'batch.create',
    entityType: 'batch',
    entityId: data.id,
    summary: `Created batch ${data.name}.`,
  });

  revalidateBatches(data.id);
  return actionSuccess('Batch created.', { id: data.id });
}

export async function updateBatchAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  const session = await requireTeacher();

  const parsed = updateBatchSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { id, ...batch } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('batches').update(batch).eq('id', id);

  if (error) return actionError(humanizeDatabaseError(error, 'The batch could not be saved.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'batch.update',
    entityType: 'batch',
    entityId: id,
    summary: `Updated batch ${batch.name}.`,
  });

  revalidateBatches(id);
  return actionSuccess('Batch saved.', { id });
}

export async function archiveBatchAction(batchId: string, archived: boolean): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('batches')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', batchId)
    .select('name')
    .single();

  if (error || !data) return actionError(humanizeDatabaseError(error, 'The batch could not be archived.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: archived ? 'batch.archive' : 'batch.restore',
    entityType: 'batch',
    entityId: batchId,
    summary: `${archived ? 'Archived' : 'Restored'} batch ${data.name}.`,
  });

  revalidateBatches(batchId);
  return actionSuccess(archived ? 'Batch archived.' : 'Batch restored.');
}

export async function addStudentsToBatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireTeacher();

  const parsed = batchMembershipSchema.safeParse({
    batch_id: formData.get('batch_id'),
    student_ids: formData.getAll('student_ids[]').map(String).filter(Boolean),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('batch_members').upsert(
    parsed.data.student_ids.map((studentId) => ({
      batch_id: parsed.data.batch_id,
      student_id: studentId,
      joined_at: new Date().toISOString(),
      left_at: null,
    })),
    { onConflict: 'batch_id,student_id' },
  );

  if (error) return actionError(humanizeDatabaseError(error, 'Those students could not be added.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'batch.members_add',
    entityType: 'batch',
    entityId: parsed.data.batch_id,
    summary: `Added ${parsed.data.student_ids.length} student(s) to a batch.`,
    metadata: { count: parsed.data.student_ids.length },
  });

  revalidateBatches(parsed.data.batch_id);
  return actionSuccess(`Added ${parsed.data.student_ids.length} student(s).`);
}

/** Membership is closed, never deleted, so past batch results stay attributable. */
export async function removeStudentFromBatchAction(batchId: string, studentId: string): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('batch_members')
    .update({ left_at: new Date().toISOString() })
    .eq('batch_id', batchId)
    .eq('student_id', studentId);

  if (error) return actionError(humanizeDatabaseError(error, 'The student could not be removed.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'batch.members_remove',
    entityType: 'batch',
    entityId: batchId,
    summary: 'Removed a student from a batch.',
  });

  revalidateBatches(batchId);
  return actionSuccess('Student removed from batch.');
}

export async function moveStudentsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireTeacher();

  const parsed = moveStudentsSchema.safeParse({
    from_batch_id: formData.get('from_batch_id'),
    to_batch_id: formData.get('to_batch_id'),
    student_ids: formData.getAll('student_ids[]').map(String).filter(Boolean),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  if (parsed.data.from_batch_id === parsed.data.to_batch_id) {
    return actionError('Choose a different batch to move the students into.');
  }

  const supabase = await createSupabaseServerClient();

  const { error: closeError } = await supabase
    .from('batch_members')
    .update({ left_at: new Date().toISOString() })
    .eq('batch_id', parsed.data.from_batch_id)
    .in('student_id', parsed.data.student_ids);

  if (closeError) return actionError(humanizeDatabaseError(closeError, 'The students could not be moved.'));

  const { error: addError } = await supabase.from('batch_members').upsert(
    parsed.data.student_ids.map((studentId) => ({
      batch_id: parsed.data.to_batch_id,
      student_id: studentId,
      joined_at: new Date().toISOString(),
      left_at: null,
    })),
    { onConflict: 'batch_id,student_id' },
  );

  if (addError) return actionError(humanizeDatabaseError(addError, 'The students could not be moved.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'batch.members_move',
    entityType: 'batch',
    entityId: parsed.data.to_batch_id,
    summary: `Moved ${parsed.data.student_ids.length} student(s) between batches.`,
    metadata: { from: parsed.data.from_batch_id, count: parsed.data.student_ids.length },
  });

  revalidateBatches(parsed.data.from_batch_id);
  revalidateBatches(parsed.data.to_batch_id);
  return actionSuccess(`Moved ${parsed.data.student_ids.length} student(s).`);
}
