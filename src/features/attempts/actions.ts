'use server';

import { revalidatePath } from 'next/cache';

import { manualMarkSchema } from '@/features/assessments/schema';
import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { requireStudent, requireTeacher } from '@/lib/auth/session';
import { humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import { finalizeAttemptPrivileged } from './privileged';
import { saveAnswersSchema, type AnswerEntry } from './response';
import { isExpired, type StoredPartResults } from './scoring';

// ---------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------

/**
 * Starts an attempt, or resumes the one already open.
 *
 * All of the rules — assigned, open, attempts left, one at a time — are
 * enforced inside `start_attempt`, atomically. This action only tidies up
 * first: an earlier attempt whose time ran out is finalised, so it cannot
 * be "resumed" with no time on the clock.
 */
export async function startAttemptAction(assessmentId: string): Promise<ActionState<{ attemptId: string }>> {
  const session = await requireStudent();
  const supabase = await createSupabaseServerClient();

  const { data: open } = await supabase
    .from('attempts')
    .select('id, status, deadline_at')
    .eq('assessment_id', assessmentId)
    .eq('student_id', session.student.id)
    .eq('status', 'in_progress')
    .maybeSingle();

  if (open && isExpired(open)) await finalizeAttemptPrivileged(open.id);

  const { data: attemptId, error } = await supabase.rpc('start_attempt', { p_assessment_id: assessmentId });
  if (error || !attemptId) {
    return actionError(humanizeDatabaseError(error, 'The assessment could not be started. Try again.'));
  }

  revalidatePath('/s/assessments');
  revalidatePath(`/s/assessments/${assessmentId}`);
  revalidatePath('/s/dashboard');
  return actionSuccess('Started.', { attemptId });
}

async function writeAnswers(attemptId: string, entries: AnswerEntry[]) {
  if (entries.length === 0) return { error: null };
  const supabase = await createSupabaseServerClient();

  // RLS (`attempt_accepts_answers`) is the gate: the attempt must be the
  // caller's own, still open, and inside its deadline. The composite
  // foreign key guarantees each question belongs to this attempt.
  return supabase.from('attempt_answers').upsert(
    entries.map((entry) => ({
      attempt_question_id: entry.attemptQuestionId,
      attempt_id: attemptId,
      response: (entry.response ?? null) as Json,
      flagged: entry.flagged,
    })),
    { onConflict: 'attempt_question_id' },
  );
}

/** Autosave. Called with whatever changed since the last successful save. */
export async function saveAnswersAction(payload: unknown): Promise<ActionState<{ savedAt: string }>> {
  await requireStudent();

  const parsed = saveAnswersSchema.safeParse(payload);
  if (!parsed.success) return actionError('Your answer could not be read. Try again.');

  const { error } = await writeAnswers(parsed.data.attemptId, parsed.data.entries);
  if (error) {
    // An RLS refusal here almost always means the time is up.
    return actionError(
      error.code === '42501'
        ? 'Time is up — this attempt is no longer accepting answers.'
        : humanizeDatabaseError(error, 'Your answer could not be saved.'),
    );
  }

  return actionSuccess('Saved.', { savedAt: new Date().toISOString() });
}

/**
 * Hands the attempt in. Carries any answers the autosave had not yet
 * delivered, so a submit made while briefly offline loses nothing.
 */
export async function submitAttemptAction(payload: unknown): Promise<ActionState<{ attemptId: string }>> {
  const session = await requireStudent();

  const parsed = saveAnswersSchema.safeParse(payload);
  if (!parsed.success) return actionError('Your answers could not be read. Try again.');

  const { attemptId, entries } = parsed.data;
  const supabase = await createSupabaseServerClient();

  // Ownership check through the student's own policies.
  const { data: attempt } = await supabase
    .from('attempts')
    .select('id, status, assessment_id')
    .eq('id', attemptId)
    .maybeSingle();
  if (!attempt) return actionError('That attempt could not be found.');

  if (attempt.status === 'in_progress') {
    // Past the deadline the write is refused by RLS; the answers already
    // saved are what gets marked, which is the rule for a timed paper.
    await writeAnswers(attemptId, entries);

    try {
      await finalizeAttemptPrivileged(attemptId);
    } catch (cause) {
      console.error('[attempt] finalize failed', cause);
      return actionError('Your answers are saved, but the attempt could not be submitted. Try again.');
    }

    await recordAudit({
      actorId: session.userId,
      actorRole: 'student',
      action: 'attempt.submit',
      entityType: 'attempt',
      entityId: attemptId,
      summary: `Submitted attempt at assessment ${attempt.assessment_id}.`,
    });
  }

  revalidatePath('/s/assessments');
  revalidatePath(`/s/assessments/${attempt.assessment_id}`);
  revalidatePath('/s/dashboard');
  revalidatePath(`/t/assessments/${attempt.assessment_id}/results`);
  return actionSuccess('Submitted.', { attemptId });
}

// ---------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------

/**
 * Awards or overrides the marks on one question.
 *
 * The attempt total is not touched here: a trigger recomputes it from the
 * question marks, and moves the attempt to "marked" once nothing is left
 * waiting.
 */
export async function markAttemptQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireTeacher();

  const raw = formDataToObject(formData);
  const partMarks: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    const match = /^part_marks\[(.+)\]$/.exec(key);
    if (match && typeof value === 'string' && value.trim() !== '') partMarks[match[1]] = value.trim();
  }
  if (Object.keys(partMarks).length > 0) raw.part_marks = partMarks;

  const parsed = manualMarkSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from('attempt_questions')
    .select('id, attempt_id, max_marks, part_results, attempts(status)')
    .eq('id', input.attempt_question_id)
    .maybeSingle();
  if (!row) return actionError('That answer could not be found.');

  const status = (row as unknown as { attempts: { status: string } | null }).attempts?.status;
  if (status === 'in_progress') return actionError('The student is still sitting this attempt.');

  const maxMarks = Number(row.max_marks);
  let marks = input.marks;
  let parts = (row.part_results ?? null) as StoredPartResults | null;

  if (input.part_marks && parts) {
    const next: StoredPartResults = { ...parts };
    for (const [partId, value] of Object.entries(input.part_marks)) {
      const part = next[partId];
      if (!part) continue;
      if (value > part.maxMarks) {
        return actionError(`Part marks cannot exceed ${part.maxMarks}.`, {
          [`part_marks.${partId}`]: [`At most ${part.maxMarks}.`],
        });
      }
      next[partId] = { ...part, marks: value, requiresManual: false };
    }
    parts = next;
    marks = Math.round(Object.values(next).reduce((sum, part) => sum + part.marks, 0) * 100) / 100;
  }

  if (marks === undefined) return actionError('Enter the marks to award.', { marks: ['Enter the marks.'] });
  if (marks > maxMarks) {
    return actionError(`This question is worth ${maxMarks} marks at most.`, { marks: [`At most ${maxMarks}.`] });
  }

  const { error } = await supabase
    .from('attempt_questions')
    .update({
      marks_awarded: String(marks),
      is_correct: marks >= maxMarks ? true : marks <= 0 ? false : null,
      part_results: parts as unknown as Json,
      teacher_comment: input.teacher_comment ?? null,
      marked_by: session.userId,
      marked_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  if (error) return actionError(humanizeDatabaseError(error, 'The marks could not be saved.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'attempt.mark',
    entityType: 'attempt',
    entityId: row.attempt_id,
    summary: `Awarded ${marks} of ${maxMarks} marks on one question.`,
    metadata: { attempt_question_id: row.id, marks },
  });

  revalidatePath(`/t/attempts/${row.attempt_id}`);
  revalidatePath(`/s/results/${row.attempt_id}`);
  return actionSuccess('Marks saved.');
}
