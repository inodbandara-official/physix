import 'server-only';

import { toVersionDetail, type QuestionVersionDetail } from '@/features/questions/queries';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AttemptStatus, Json } from '@/types/database';

import { parseStoredResponse } from './response';
import { markAttemptQuestion, toStoredParts } from './scoring';

/**
 * The only place application code reads answer keys on a student's behalf.
 *
 * Students have no policy on `question_versions` — the answer key lives in
 * `body` — so the server reads versions with the service role, and the
 * caller strips them (see `sheet.ts`) before anything reaches a browser.
 *
 * Every function here trusts its caller to have authorised the request
 * already, through a read made with the caller's own RLS-bound client. Keep
 * that contract: never pass an id here that came straight from a request.
 */

export async function loadVersionsPrivileged(versionIds: string[]): Promise<Map<string, QuestionVersionDetail>> {
  const map = new Map<string, QuestionVersionDetail>();
  const unique = [...new Set(versionIds)];
  if (unique.length === 0) return map;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('question_versions').select('*').in('id', unique);
  if (error) throw error;

  for (const row of data ?? []) map.set(row.id, toVersionDetail(row));
  return map;
}

/** Signed figure URLs for a student, who has no read policy on the bucket. */
export async function signFiguresPrivileged(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return map;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from('question-figures').createSignedUrls(unique, 3600);
  if (error) return map;

  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

/**
 * Marks an attempt against the versions it was served and records the
 * result. Idempotent: an attempt that is already closed is left alone and
 * its status returned.
 *
 * The caller must already have established that the requester owns the
 * attempt (a student) or is the teacher.
 */
export async function finalizeAttemptPrivileged(attemptId: string): Promise<AttemptStatus> {
  const admin = createSupabaseAdminClient();

  const { data: attempt, error } = await admin
    .from('attempts')
    .select('id, status, assessment_id')
    .eq('id', attemptId)
    .maybeSingle();

  if (error) throw error;
  if (!attempt) throw new Error('Attempt not found.');
  if (attempt.status !== 'in_progress') return attempt.status;

  const [{ data: assessment }, { data: questions }, { data: answers }] = await Promise.all([
    admin.from('assessments').select('negative_marking').eq('id', attempt.assessment_id).maybeSingle(),
    admin
      .from('attempt_questions')
      .select('id, question_version_id, max_marks')
      .eq('attempt_id', attemptId),
    admin.from('attempt_answers').select('attempt_question_id, response').eq('attempt_id', attemptId),
  ]);

  const versions = await loadVersionsPrivileged((questions ?? []).map((row) => row.question_version_id));
  const responses = new Map((answers ?? []).map((row) => [row.attempt_question_id, parseStoredResponse(row.response)]));
  const negative = Number(assessment?.negative_marking ?? 0);

  const results = (questions ?? []).map((row) => {
    const version = versions.get(row.question_version_id);
    const maxMarks = Number(row.max_marks);

    if (!version) {
      // Unreachable while the foreign key holds; marked for the teacher
      // rather than silently scored zero if it ever happens.
      return {
        id: row.id,
        marks: 0,
        correct: null,
        requiresManual: true,
        feedback: 'The question could not be loaded for marking.',
        parts: null,
      };
    }

    const result = markAttemptQuestion(version.body, responses.get(row.id) ?? null, maxMarks, negative);
    return {
      id: row.id,
      marks: result.marks,
      correct: result.correct,
      requiresManual: result.requiresManualMarking,
      feedback: result.detail,
      parts: toStoredParts(result),
    };
  });

  const { data: status, error: finalizeError } = await admin.rpc('finalize_attempt', {
    p_attempt_id: attemptId,
    p_results: results as unknown as Json,
  });

  if (finalizeError) throw finalizeError;
  return status as AttemptStatus;
}
