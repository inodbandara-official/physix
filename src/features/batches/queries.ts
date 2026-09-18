import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AccountStatus, BatchRow, StudentRow } from '@/types/database';

export interface BatchWithCounts extends BatchRow {
  member_count: number;
  active_member_count: number;
}

/** All batches with live membership counts, grouped for the A/L-year tree view. */
export async function listBatches(includeArchived = false): Promise<BatchWithCounts[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('batches').select('*');
  if (!includeArchived) query = query.is('archived_at', null);

  const { data: batches, error } = await query.order('al_year', { ascending: false }).order('name');
  if (error) throw error;
  if (!batches || batches.length === 0) return [];

  const { data: members } = await supabase
    .from('batch_members')
    .select('batch_id, student_id, left_at, students(status, archived_at)')
    .in(
      'batch_id',
      batches.map((batch) => batch.id),
    )
    .is('left_at', null);

  type MemberJoin = {
    batch_id: string;
    students: Pick<StudentRow, 'status' | 'archived_at'> | null;
  };

  const counts = new Map<string, { total: number; active: number }>();
  for (const row of (members ?? []) as unknown as MemberJoin[]) {
    if (row.students?.archived_at) continue;
    const entry = counts.get(row.batch_id) ?? { total: 0, active: 0 };
    entry.total += 1;
    if (row.students?.status === 'active') entry.active += 1;
    counts.set(row.batch_id, entry);
  }

  return batches.map((batch) => ({
    ...batch,
    member_count: counts.get(batch.id)?.total ?? 0,
    active_member_count: counts.get(batch.id)?.active ?? 0,
  }));
}

export interface BatchMemberSummary {
  id: string;
  student_code: string;
  full_name: string;
  preferred_name: string | null;
  school: string | null;
  status: AccountStatus;
  has_account: boolean;
  joined_at: string;
}

export interface BatchDetail extends BatchWithCounts {
  members: BatchMemberSummary[];
}

export async function getBatch(id: string): Promise<BatchDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: batch } = await supabase.from('batches').select('*').eq('id', id).maybeSingle();
  if (!batch) return null;

  const { data: memberships } = await supabase
    .from('batch_members')
    .select('joined_at, students(id, student_code, full_name, preferred_name, school, status, profile_id, archived_at)')
    .eq('batch_id', id)
    .is('left_at', null);

  type Join = {
    joined_at: string;
    students: Pick<
      StudentRow,
      'id' | 'student_code' | 'full_name' | 'preferred_name' | 'school' | 'status' | 'profile_id' | 'archived_at'
    > | null;
  };

  const members: BatchMemberSummary[] = ((memberships ?? []) as unknown as Join[])
    .filter((row) => row.students && !row.students.archived_at)
    .map((row) => ({
      id: row.students!.id,
      student_code: row.students!.student_code,
      full_name: row.students!.full_name,
      preferred_name: row.students!.preferred_name,
      school: row.students!.school,
      status: row.students!.status,
      has_account: row.students!.profile_id !== null,
      joined_at: row.joined_at,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return {
    ...batch,
    members,
    member_count: members.length,
    active_member_count: members.filter((member) => member.status === 'active').length,
  };
}

/** Lightweight options list for the batch pickers on the student form. */
export async function listBatchOptions(): Promise<Pick<BatchRow, 'id' | 'name' | 'al_year'>[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('batches')
    .select('id, name, al_year')
    .is('archived_at', null)
    .order('al_year', { ascending: false })
    .order('name');
  return data ?? [];
}

/** Active students who are not yet in the given batch. */
export async function listAssignableStudents(batchId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from('batch_members')
    .select('student_id')
    .eq('batch_id', batchId)
    .is('left_at', null);

  const taken = new Set((existing ?? []).map((row) => row.student_id));

  const { data: students } = await supabase
    .from('students')
    .select('id, student_code, full_name, school')
    .is('archived_at', null)
    .order('full_name');

  return (students ?? []).filter((student) => !taken.has(student.id));
}
