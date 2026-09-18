import 'server-only';

import { countQuestions } from '@/features/questions/queries';
import { countStudents } from '@/features/students/queries';
import { countSyllabus } from '@/features/syllabus/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuditLogRow, BatchRow } from '@/types/database';

export interface TeacherOverview {
  students: { total: number; active: number; withoutAccount: number };
  batches: { total: number; active: number };
  syllabus: { units: number; topics: number; subtopics: number };
  questions: { total: number; published: number; drafts: number };
  batchSizes: { name: string; students: number }[];
  recentActivity: AuditLogRow[];
  newestStudents: { id: string; full_name: string; student_code: string; joined_on: string }[];
}

/**
 * Phase 1 dashboard. Assessment-derived figures (averages, pending grading,
 * at-risk students) are intentionally absent rather than faked — they arrive
 * with the assessment engine in Phase 3.
 */
export async function getTeacherOverview(): Promise<TeacherOverview> {
  const supabase = await createSupabaseServerClient();

  const [students, syllabus, questions, batchesResult, membersResult, activityResult, newestResult] =
    await Promise.all([
    countStudents(),
    countSyllabus(),
    countQuestions(),
    supabase.from('batches').select('id, name, archived_at'),
    supabase.from('batch_members').select('batch_id').is('left_at', null),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(8),
    supabase
      .from('students')
      .select('id, full_name, student_code, joined_on')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const batches = (batchesResult.data ?? []) as Pick<BatchRow, 'id' | 'name' | 'archived_at'>[];
  const activeBatches = batches.filter((batch) => batch.archived_at === null);

  const countByBatch = new Map<string, number>();
  for (const row of membersResult.data ?? []) {
    countByBatch.set(row.batch_id, (countByBatch.get(row.batch_id) ?? 0) + 1);
  }

  return {
    students,
    questions,
    batches: { total: batches.length, active: activeBatches.length },
    syllabus,
    batchSizes: activeBatches
      .map((batch) => ({ name: batch.name, students: countByBatch.get(batch.id) ?? 0 }))
      .sort((a, b) => b.students - a.students)
      .slice(0, 8),
    recentActivity: activityResult.data ?? [],
    newestStudents: newestResult.data ?? [],
  };
}

export interface StudentOverview {
  batches: Pick<BatchRow, 'id' | 'name' | 'schedule_note'>[];
  publishedNotes: { id: string; body: string; created_at: string }[];
  syllabusUnits: { id: string; name: string }[];
}

export async function getStudentOverview(studentId: string): Promise<StudentOverview> {
  const supabase = await createSupabaseServerClient();

  const [membershipResult, notesResult, unitsResult] = await Promise.all([
    supabase
      .from('batch_members')
      .select('batches(id, name, schedule_note)')
      .eq('student_id', studentId)
      .is('left_at', null),
    supabase
      .from('student_notes')
      .select('id, body, created_at')
      .eq('student_id', studentId)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('syllabus_nodes')
      .select('id, name')
      .eq('kind', 'unit')
      .is('archived_at', null)
      .order('sort_order'),
  ]);

  type Join = { batches: Pick<BatchRow, 'id' | 'name' | 'schedule_note'> | null };

  return {
    batches: ((membershipResult.data ?? []) as unknown as Join[])
      .map((row) => row.batches)
      .filter((batch): batch is Pick<BatchRow, 'id' | 'name' | 'schedule_note'> => batch !== null),
    publishedNotes: notesResult.data ?? [],
    syllabusUnits: unitsResult.data ?? [],
  };
}
