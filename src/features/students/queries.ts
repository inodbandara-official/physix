import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { BatchRow, StudentNoteRow, StudentRow } from '@/types/database';

import type { StudentFilters } from './schema';

export interface StudentListItem extends StudentRow {
  batches: Pick<BatchRow, 'id' | 'name'>[];
  has_account: boolean;
}

export interface StudentPage {
  rows: StudentListItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

type MembershipRow = { batch_id: string; batches: Pick<BatchRow, 'id' | 'name'> | null };

/**
 * Paginated, server-filtered student list (§56 — never load the whole table).
 * Batch names are fetched in one follow-up query rather than a join, so the
 * count query stays cheap and the filter stays index-friendly.
 */
export async function listStudents(filters: StudentFilters): Promise<StudentPage> {
  const supabase = await createSupabaseServerClient();
  const from = (filters.page - 1) * filters.perPage;
  const to = from + filters.perPage - 1;

  let studentIdsInBatch: string[] | null = null;
  if (filters.batch) {
    const { data } = await supabase
      .from('batch_members')
      .select('student_id')
      .eq('batch_id', filters.batch)
      .is('left_at', null);
    studentIdsInBatch = (data ?? []).map((row) => row.student_id);
    if (studentIdsInBatch.length === 0) {
      return { rows: [], total: 0, page: filters.page, perPage: filters.perPage, pageCount: 0 };
    }
  }

  let query = supabase.from('students').select('*', { count: 'exact' });

  if (filters.archived === 'active') query = query.is('archived_at', null);
  if (filters.archived === 'archived') query = query.not('archived_at', 'is', null);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.contact === 'with-email') query = query.not('email', 'is', null);
  if (filters.contact === 'without-email') query = query.is('email', null);
  if (studentIdsInBatch) query = query.in('id', studentIdsInBatch);
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_]/g, '')}%`;
    query = query.or(
      `full_name.ilike.${term},student_code.ilike.${term},username.ilike.${term},school.ilike.${term}`,
    );
  }

  const { data, count, error } = await query.order('full_name').range(from, to);
  if (error) throw error;

  const students = data ?? [];
  const batchesByStudent = await loadBatchesFor(students.map((s) => s.id));

  return {
    rows: students.map((student) => ({
      ...student,
      batches: batchesByStudent.get(student.id) ?? [],
      has_account: student.profile_id !== null,
    })),
    total: count ?? 0,
    page: filters.page,
    perPage: filters.perPage,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / filters.perPage)),
  };
}

async function loadBatchesFor(studentIds: string[]) {
  const map = new Map<string, Pick<BatchRow, 'id' | 'name'>[]>();
  if (studentIds.length === 0) return map;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('batch_members')
    .select('student_id, batch_id, batches(id, name)')
    .in('student_id', studentIds)
    .is('left_at', null);

  for (const row of (data ?? []) as unknown as (MembershipRow & { student_id: string })[]) {
    if (!row.batches) continue;
    const list = map.get(row.student_id) ?? [];
    list.push(row.batches);
    map.set(row.student_id, list);
  }
  return map;
}

export interface StudentDetail extends StudentListItem {
  notes_journal: StudentNoteRow[];
}

export async function getStudent(id: string): Promise<StudentDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: student } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
  if (!student) return null;

  const [{ data: memberships }, { data: notes }] = await Promise.all([
    supabase.from('batch_members').select('batch_id, batches(id, name)').eq('student_id', id).is('left_at', null),
    supabase.from('student_notes').select('*').eq('student_id', id).order('created_at', { ascending: false }),
  ]);

  return {
    ...student,
    has_account: student.profile_id !== null,
    batches: ((memberships ?? []) as unknown as MembershipRow[])
      .map((row) => row.batches)
      .filter((batch): batch is Pick<BatchRow, 'id' | 'name'> => batch !== null),
    notes_journal: notes ?? [],
  };
}

export async function countStudents() {
  const supabase = await createSupabaseServerClient();
  const [all, active, withoutAccount, withoutEmail] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).is('archived_at', null),
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .eq('status', 'active'),
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .is('profile_id', null),
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .is('email', null),
  ]);

  return {
    total: all.count ?? 0,
    active: active.count ?? 0,
    withoutAccount: withoutAccount.count ?? 0,
    withoutEmail: withoutEmail.count ?? 0,
  };
}

/** Existing codes, used only to suggest the next free Student ID. */
export async function listStudentCodes(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('students').select('student_code').limit(2000);
  return (data ?? []).map((row) => row.student_code);
}
