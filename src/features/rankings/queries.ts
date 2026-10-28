import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { assessmentWindow, resultsVisible } from '@/features/attempts/scoring';
import { chunk, fetchAllPages } from '@/lib/supabase/paginate';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AssessmentKind, Database, RankingSettingsRow } from '@/types/database';

import {
  computeRanking,
  DEFAULT_WEIGHTS,
  type RankAssessment,
  type RankingConfig,
  type RankingRow,
  type RankResult,
} from './engine';

type Client = SupabaseClient<Database>;

export async function getRankingSettings(client?: Client): Promise<RankingSettingsRow & { config: RankingConfig }> {
  const supabase = client ?? (await createSupabaseServerClient());
  const { data } = await supabase.from('ranking_settings').select('*').maybeSingle();

  const row: RankingSettingsRow = data ?? {
    id: true,
    basis: 'average',
    recent_count: 5,
    weights: DEFAULT_WEIGHTS,
    missed_counts_zero: true,
    student_visibility: 'private',
    updated_at: new Date(0).toISOString(),
  };

  return {
    ...row,
    config: {
      basis: row.basis,
      recentCount: row.recent_count,
      weights: { ...DEFAULT_WEIGHTS, ...((row.weights ?? {}) as Partial<Record<AssessmentKind, number>>) },
      missedCountsZero: row.missed_counts_zero,
    },
  };
}

export interface RankedStudent extends RankingRow {
  name: string;
  preferredName: string | null;
  code: string;
}

interface Scope {
  /** One batch, or every active student when null (teacher only). */
  batchId: string | null;
  /** Only assessments dated on or after this. */
  since: string | null;
}

/**
 * Gathers what the engine needs and runs it.
 *
 * Only assessments whose results are visible to students count, for the
 * teacher as well: a rank built from held-back marks would leak them the
 * moment a student saw their position move.
 */
async function rankScope(client: Client, scope: Scope, config: RankingConfig): Promise<RankedStudent[]> {
  // Students in scope, with when they joined each batch (for "missed").
  let members: { student_id: string; batch_id: string; joined_at: string }[];
  if (scope.batchId) {
    const { data } = await client
      .from('batch_members')
      .select('student_id, batch_id, joined_at')
      .eq('batch_id', scope.batchId)
      .is('left_at', null);
    members = data ?? [];
  } else {
    members = await fetchAllPages((from, to) =>
      client.from('batch_members').select('student_id, batch_id, joined_at').is('left_at', null).range(from, to),
    );
  }

  const studentIds = [...new Set(members.map((member) => member.student_id))];
  const students = new Map<string, { full_name: string; preferred_name: string | null; student_code: string }>();
  for (const ids of chunk(studentIds)) {
    const { data } = await client
      .from('students')
      .select('id, full_name, preferred_name, student_code, status, archived_at')
      .in('id', ids);
    for (const row of data ?? []) {
      if (row.status === 'active' && !row.archived_at) students.set(row.id, row);
    }
  }
  const activeIds = studentIds.filter((id) => students.has(id));
  if (activeIds.length === 0) return [];

  // Assessments set for these batches.
  const batchIds = [...new Set(members.map((member) => member.batch_id))];
  const links: { assessment_id: string; batch_id: string }[] = [];
  for (const ids of chunk(batchIds)) {
    const { data } = await client.from('assessment_batches').select('assessment_id, batch_id').in('batch_id', ids);
    links.push(...(data ?? []));
  }

  const assessmentIds = [...new Set(links.map((link) => link.assessment_id))];
  const assessments: RankAssessment[] = [];
  const now = new Date();
  for (const ids of chunk(assessmentIds)) {
    const { data } = await client
      .from('assessments')
      .select('id, kind, status, archived_at, past_paper_bank, opens_at, closes_at, published_at, created_at, show_results_immediately, results_released_at')
      .in('id', ids);
    for (const row of data ?? []) {
      if (row.status !== 'published' || row.past_paper_bank || !resultsVisible(row, now)) continue;
      const date = row.closes_at ?? row.published_at ?? row.created_at;
      if (scope.since && date < scope.since) continue;
      assessments.push({ id: row.id, kind: row.kind, date, closed: assessmentWindow(row, now) === 'closed' });
    }
  }

  const counted = new Set(assessments.map((assessment) => assessment.id));
  const results: RankResult[] = [];
  for (const ids of chunk(activeIds)) {
    const rows = await fetchAllPages((from, to) =>
      client
        .from('attempts')
        .select('student_id, assessment_id, percentage, score')
        .in('student_id', ids)
        .eq('status', 'graded')
        .range(from, to),
    );
    for (const row of rows) {
      if (!counted.has(row.assessment_id) || row.percentage === null) continue;
      results.push({
        studentId: row.student_id,
        assessmentId: row.assessment_id,
        percentage: Number(row.percentage),
        score: Number(row.score),
      });
    }
  }

  // "Set for" = the assessment went to a batch the student was in before it closed.
  const batchesFor = new Map<string, { batch_id: string; joined_at: string }[]>();
  for (const member of members) {
    batchesFor.set(member.student_id, [...(batchesFor.get(member.student_id) ?? []), member]);
  }
  const linkSet = new Set(links.map((link) => `${link.assessment_id}:${link.batch_id}`));
  const closesAt = new Map(assessments.map((assessment) => [assessment.id, assessment.date]));

  const rows = computeRanking(
    {
      studentIds: activeIds,
      assessments,
      results,
      wasSetFor: (studentId, assessmentId) =>
        (batchesFor.get(studentId) ?? []).some(
          (membership) =>
            linkSet.has(`${assessmentId}:${membership.batch_id}`) &&
            membership.joined_at <= (closesAt.get(assessmentId) ?? membership.joined_at),
        ),
    },
    config,
  );

  return rows.map((row) => {
    const student = students.get(row.studentId)!;
    return { ...row, name: student.full_name, preferredName: student.preferred_name, code: student.student_code };
  });
}

/** The teacher's ranking: every student in scope, by name. */
export async function getTeacherRanking(scope: Scope) {
  const client = await createSupabaseServerClient();
  const settings = await getRankingSettings(client);
  return { settings, rows: await rankScope(client, scope, settings.config) };
}

// ---------------------------------------------------------------------
// A student's view
// ---------------------------------------------------------------------

export interface StudentRankingRow {
  rank: number | null;
  score: number | null;
  /** What the student may see of this person: a name, an anonymous label, or nothing. */
  label: string | null;
  isMe: boolean;
}

export interface StudentBatchRanking {
  batchId: string;
  batchName: string;
  me: RankingRow | null;
  rankedCount: number;
  /** Empty in private mode: the student sees only their own position. */
  rows: StudentRankingRow[];
}

/**
 * A student's position in each of their batches.
 *
 * Other students' attempts are not readable to a student, so this reads
 * with the service role — after the student's own client has shown which
 * batches they belong to — and then strips the result down to what the
 * teacher's visibility setting allows (§48). Ranking never crosses
 * batches for a student.
 */
export async function getStudentRankings(studentId: string): Promise<{ settings: RankingSettingsRow; batches: StudentBatchRanking[] }> {
  const client = await createSupabaseServerClient();
  const settings = await getRankingSettings(client);

  const { data: memberships } = await client
    .from('batch_members')
    .select('batch_id, batches(name, archived_at)')
    .eq('student_id', studentId)
    .is('left_at', null);

  type Membership = { batch_id: string; batches: { name: string; archived_at: string | null } | null };
  const batches = ((memberships ?? []) as unknown as Membership[]).filter((row) => row.batches && !row.batches.archived_at);

  const admin = createSupabaseAdminClient();
  const out: StudentBatchRanking[] = [];

  for (const membership of batches) {
    const ranked = await rankScope(admin, { batchId: membership.batch_id, since: null }, settings.config);
    const me = ranked.find((row) => row.studentId === studentId) ?? null;
    const listed = ranked.filter((row) => row.rank !== null);

    let rows: StudentRankingRow[] = [];
    if (settings.student_visibility === 'anonymous') {
      rows = listed.map((row) => ({
        rank: row.rank,
        score: row.score,
        // Anonymous: positions and scores, no identity — the student's own row is marked.
        label: null,
        isMe: row.studentId === studentId,
      }));
    } else if (settings.student_visibility === 'batch') {
      rows = listed.map((row) => ({
        rank: row.rank,
        score: row.score,
        label: shortName(row.preferredName || row.name, row.name),
        isMe: row.studentId === studentId,
      }));
    }

    out.push({
      batchId: membership.batch_id,
      batchName: membership.batches!.name,
      me,
      rankedCount: listed.length,
      rows,
    });
  }

  return { settings, batches: out };
}

/**
 * "Nimal P." — enough for classmates to recognise each other, and no more
 * (§23: avoid exposing unnecessary personal information).
 */
export function shortName(preferred: string, fullName: string): string {
  const first = preferred.trim().split(/\s+/)[0] ?? '';
  const parts = fullName.trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return last && last !== first ? `${first} ${last[0]}.` : first;
}
