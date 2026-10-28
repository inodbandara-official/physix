import 'server-only';

import { finalizeAttemptPrivileged } from '@/features/attempts/privileged';
import {
  contentFigurePaths,
  loadReviewItems,
  toResultAssessment,
  type AttemptResult,
} from '@/features/attempts/queries';
import { isExpired } from '@/features/attempts/scoring';
import { signFigureUrls, toVersionDetail, type QuestionVersionDetail } from '@/features/questions/queries';
import { localizeQuestion } from '@/features/questions/translation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  AssessmentItemRow,
  AssessmentRow,
  AttemptRow,
  DifficultyLevel,
  QuestionRow,
  QuestionType,
  SyllabusNodeRow,
} from '@/types/database';

// ---------------------------------------------------------------------
// List
// ---------------------------------------------------------------------

export interface AssessmentListItem extends AssessmentRow {
  batchNames: string[];
  questionCount: number;
  attemptCount: number;
  awaitingMarking: number;
}

export async function listAssessments(view: 'active' | 'archived' = 'active'): Promise<AssessmentListItem[]> {
  const supabase = await createSupabaseServerClient();

  // The past-paper bank is managed from Past papers, not listed as a test.
  let query = supabase.from('assessments').select('*').eq('past_paper_bank', false);
  query = view === 'active' ? query.is('archived_at', null) : query.not('archived_at', 'is', null);

  const { data: assessments, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  if (!assessments || assessments.length === 0) return [];

  const ids = assessments.map((assessment) => assessment.id);
  const [{ data: links }, { data: items }, { data: attempts }] = await Promise.all([
    supabase.from('assessment_batches').select('assessment_id, batches(name)').in('assessment_id', ids),
    supabase.from('assessment_items').select('assessment_id, kind, pick_count').in('assessment_id', ids),
    supabase.from('attempts').select('assessment_id, status').in('assessment_id', ids),
  ]);

  const batchNames = new Map<string, string[]>();
  for (const link of (links ?? []) as unknown as { assessment_id: string; batches: { name: string } | null }[]) {
    if (!link.batches) continue;
    batchNames.set(link.assessment_id, [...(batchNames.get(link.assessment_id) ?? []), link.batches.name]);
  }

  const questionCounts = new Map<string, number>();
  for (const item of items ?? []) {
    const add = item.kind === 'question' ? 1 : (item.pick_count ?? 0);
    questionCounts.set(item.assessment_id, (questionCounts.get(item.assessment_id) ?? 0) + add);
  }

  const attemptCounts = new Map<string, { total: number; awaiting: number }>();
  for (const attempt of attempts ?? []) {
    const entry = attemptCounts.get(attempt.assessment_id) ?? { total: 0, awaiting: 0 };
    entry.total += 1;
    if (attempt.status === 'submitted') entry.awaiting += 1;
    attemptCounts.set(attempt.assessment_id, entry);
  }

  return assessments.map((assessment) => ({
    ...assessment,
    batchNames: (batchNames.get(assessment.id) ?? []).sort(),
    questionCount: questionCounts.get(assessment.id) ?? 0,
    attemptCount: attemptCounts.get(assessment.id)?.total ?? 0,
    awaitingMarking: attemptCounts.get(assessment.id)?.awaiting ?? 0,
  }));
}

// ---------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------

export interface FixedItem {
  kind: 'question';
  id: string;
  position: number;
  question: Pick<
    QuestionRow,
    | 'id'
    | 'question_code'
    | 'status'
    | 'archived_at'
    | 'current_title'
    | 'current_stem'
    | 'current_type'
    | 'current_marks'
    | 'current_difficulty'
    | 'current_node_id'
    | 'current_languages'
  > | null;
}

export interface RandomItem {
  kind: 'random';
  id: string;
  position: number;
  pickCount: number;
  nodeId: string | null;
  difficulties: DifficultyLevel[];
  types: QuestionType[];
  marks: number | null;
  /** Published questions this rule can draw from, excluding hand-picked ones. */
  available: number;
}

export type BuilderItem = FixedItem | RandomItem;

export interface AssessmentDetail {
  assessment: AssessmentRow;
  batchIds: string[];
  items: BuilderItem[];
  attemptCount: number;
  questionCount: number;
  /** Marks of hand-picked questions; random rules only have a total when they fix `marks`. */
  knownMarks: number;
  /** True when every random rule fixes its marks, so the paper total is certain. */
  marksCertain: boolean;
}

/** Every node id in the subtree rooted at `nodeId`, the root included. */
export function subtreeIds(nodes: Pick<SyllabusNodeRow, 'id' | 'parent_id'>[], nodeId: string): string[] {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parent_id) continue;
    children.set(node.parent_id, [...(children.get(node.parent_id) ?? []), node.id]);
  }

  const out: string[] = [];
  const stack = [nodeId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

export async function getAssessmentDetail(id: string): Promise<AssessmentDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: assessment } = await supabase.from('assessments').select('*').eq('id', id).maybeSingle();
  if (!assessment) return null;

  const [{ data: links }, { data: itemRows }, { count: attemptCount }, { data: nodes }] = await Promise.all([
    supabase.from('assessment_batches').select('batch_id').eq('assessment_id', id),
    supabase.from('assessment_items').select('*').eq('assessment_id', id).order('position').order('created_at'),
    supabase.from('attempts').select('id', { count: 'exact', head: true }).eq('assessment_id', id),
    supabase.from('syllabus_nodes').select('id, parent_id'),
  ]);

  const rows = (itemRows ?? []) as AssessmentItemRow[];
  const fixedIds = rows.filter((row) => row.kind === 'question').map((row) => row.question_id!);

  const { data: fixedQuestions } = fixedIds.length
    ? await supabase
        .from('questions')
        .select(
          'id, question_code, status, archived_at, current_title, current_stem, current_type, current_marks, current_difficulty, current_node_id, current_languages',
        )
        .in('id', fixedIds)
    : { data: [] };

  const byId = new Map((fixedQuestions ?? []).map((question) => [question.id, question]));

  const items: BuilderItem[] = [];
  let knownMarks = 0;
  let marksCertain = true;
  let questionCount = 0;

  for (const row of rows) {
    if (row.kind === 'question') {
      const question = byId.get(row.question_id!) ?? null;
      items.push({ kind: 'question', id: row.id, position: row.position, question });
      knownMarks += Number(question?.current_marks ?? 0);
      questionCount += 1;
      continue;
    }

    const available = await countRuleMatches(
      {
        nodeIds: row.syllabus_node_id ? subtreeIds(nodes ?? [], row.syllabus_node_id) : null,
        difficulties: row.difficulties,
        types: row.question_types,
        marks: row.marks === null ? null : Number(row.marks),
      },
      fixedIds,
    );

    items.push({
      kind: 'random',
      id: row.id,
      position: row.position,
      pickCount: row.pick_count ?? 0,
      nodeId: row.syllabus_node_id,
      difficulties: row.difficulties,
      types: row.question_types,
      marks: row.marks === null ? null : Number(row.marks),
      available,
    });
    questionCount += row.pick_count ?? 0;
    if (row.marks === null) marksCertain = false;
    else knownMarks += Number(row.marks) * (row.pick_count ?? 0);
  }

  return {
    assessment,
    batchIds: (links ?? []).map((link) => link.batch_id),
    items,
    attemptCount: attemptCount ?? 0,
    questionCount,
    knownMarks: Math.round(knownMarks * 100) / 100,
    marksCertain,
  };
}

/**
 * How many published questions a random rule could draw. Mirrors the
 * filter in `start_attempt`, so the builder warns about a rule that
 * cannot be filled before a student ever meets it.
 */
export async function countRuleMatches(
  rule: { nodeIds: string[] | null; difficulties: DifficultyLevel[]; types: QuestionType[]; marks: number | null },
  excludeIds: string[],
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .is('archived_at', null)
    .not('current_version_id', 'is', null);

  if (rule.nodeIds) query = query.in('current_node_id', rule.nodeIds);
  if (rule.difficulties.length > 0) query = query.in('current_difficulty', rule.difficulties);
  if (rule.types.length > 0) query = query.in('current_type', rule.types);
  if (rule.marks !== null) query = query.eq('current_marks', String(rule.marks));
  if (excludeIds.length > 0) query = query.not('id', 'in', `(${excludeIds.join(',')})`);

  const { count } = await query;
  return count ?? 0;
}

/**
 * Everything standing between a draft and publication, as sentences the
 * teacher can act on.
 */
export function assessmentPublishIssues(detail: AssessmentDetail): string[] {
  const issues: string[] = [];

  if (detail.items.length === 0) issues.push('Add at least one question or random rule.');
  if (detail.batchIds.length === 0) issues.push('Choose at least one batch to set this for.');

  for (const item of detail.items) {
    if (item.kind === 'question') {
      if (!item.question) issues.push('A hand-picked question no longer exists. Remove it.');
      else if (item.question.status !== 'published' || item.question.archived_at) {
        issues.push(`${item.question.question_code} is not published. Publish it or remove it.`);
      }
    } else if (item.available < item.pickCount) {
      issues.push(
        `A random rule needs ${item.pickCount} question(s) but only ${item.available} published question(s) match it.`,
      );
    }
  }

  const { opens_at, closes_at } = detail.assessment;
  if (closes_at && new Date(closes_at) <= new Date()) issues.push('The closing time is already in the past.');
  if (opens_at && closes_at && new Date(closes_at) <= new Date(opens_at)) {
    issues.push('The closing time must be after the opening time.');
  }

  return issues;
}

// ---------------------------------------------------------------------
// Question picker
// ---------------------------------------------------------------------

export interface PickerFilters {
  q?: string;
  unit?: string;
  type?: QuestionType;
  difficulty?: DifficultyLevel;
  year?: number;
}

export async function listPickableQuestions(filters: PickerFilters, excludeIds: string[]) {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('questions')
    .select(
      'id, question_code, current_title, current_stem, current_type, current_marks, current_difficulty, current_node_id, current_languages',
      { count: 'exact' },
    )
    .eq('status', 'published')
    .is('archived_at', null)
    .not('current_version_id', 'is', null);

  if (filters.unit) query = query.eq('current_unit_id', filters.unit);
  if (filters.type) query = query.eq('current_type', filters.type);
  if (filters.difficulty) query = query.eq('current_difficulty', filters.difficulty);
  if (filters.year) query = query.eq('current_year', filters.year);
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_,()]/g, '')}%`;
    query = query.or(`current_stem.ilike.${term},current_title.ilike.${term},question_code.ilike.${term}`);
  }
  if (excludeIds.length > 0) query = query.not('id', 'in', `(${excludeIds.join(',')})`);

  const { data, count, error } = await query.order('question_code').limit(100);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

// ---------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------

export interface AttemptListRow extends AttemptRow {
  student: { id: string; full_name: string; student_code: string } | null;
}

export interface AssessmentResults {
  attempts: AttemptListRow[];
  stats: {
    students: number;
    attempts: number;
    inProgress: number;
    awaitingMarking: number;
    average: number | null;
    highest: number | null;
    lowest: number | null;
    passRate: number | null;
  };
}

export async function getAssessmentResults(assessment: AssessmentRow): Promise<AssessmentResults> {
  const supabase = await createSupabaseServerClient();

  const read = async () => {
    const { data, error } = await supabase
      .from('attempts')
      .select('*, students(id, full_name, student_code)')
      .eq('assessment_id', assessment.id)
      .order('started_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as (AttemptRow & { students: AttemptListRow['student'] })[];
  };

  let rows = await read();
  const expired = rows.filter((row) => isExpired(row));
  if (expired.length > 0) {
    for (const row of expired) await finalizeAttemptPrivileged(row.id);
    rows = await read();
  }

  const attempts: AttemptListRow[] = rows.map(({ students, ...row }) => ({ ...row, student: students }));

  // A student's standing is their best finished attempt, which is how a
  // teacher reads a class list after a multi-attempt quiz.
  const best = new Map<string, number>();
  for (const attempt of attempts) {
    if (attempt.status === 'in_progress' || attempt.percentage === null) continue;
    const value = Number(attempt.percentage);
    best.set(attempt.student_id, Math.max(best.get(attempt.student_id) ?? -Infinity, value));
  }
  const values = [...best.values()];
  const pass = assessment.pass_percentage === null ? null : Number(assessment.pass_percentage);

  return {
    attempts,
    stats: {
      students: new Set(attempts.map((attempt) => attempt.student_id)).size,
      attempts: attempts.length,
      inProgress: attempts.filter((attempt) => attempt.status === 'in_progress').length,
      awaitingMarking: attempts.filter((attempt) => attempt.status === 'submitted').length,
      average: values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null,
      highest: values.length ? Math.max(...values) : null,
      lowest: values.length ? Math.min(...values) : null,
      passRate:
        pass === null || values.length === 0
          ? null
          : Math.round((values.filter((value) => value >= pass).length / values.length) * 1000) / 10,
    },
  };
}

// ---------------------------------------------------------------------
// One attempt, for review and manual marking
// ---------------------------------------------------------------------

export interface TeacherAttempt extends AttemptResult {
  student: { id: string; full_name: string; student_code: string };
  /** Versions pinned by this attempt that have since been superseded. */
  supersededVersionIds: Set<string>;
}

export async function getTeacherAttempt(attemptId: string): Promise<TeacherAttempt | null> {
  const supabase = await createSupabaseServerClient();

  let { data: attempt } = await supabase.from('attempts').select('*').eq('id', attemptId).maybeSingle();
  if (!attempt) return null;
  if (isExpired(attempt)) {
    await finalizeAttemptPrivileged(attempt.id);
    ({ data: attempt } = await supabase.from('attempts').select('*').eq('id', attemptId).maybeSingle());
    if (!attempt) return null;
  }

  const [{ data: assessment }, { data: student }] = await Promise.all([
    supabase.from('assessments').select('*').eq('id', attempt.assessment_id).maybeSingle(),
    supabase.from('students').select('id, full_name, student_code').eq('id', attempt.student_id).maybeSingle(),
  ]);
  if (!assessment || !student) return null;

  // The teacher reads versions through their own policies: no service role.
  const loadVersions = async (versionIds: string[]) => {
    const map = new Map<string, QuestionVersionDetail>();
    if (versionIds.length === 0) return map;
    const { data } = await supabase.from('question_versions').select('*').in('id', [...new Set(versionIds)]);
    for (const row of data ?? []) map.set(row.id, toVersionDetail(row));
    return map;
  };

  const items =
    attempt.status === 'in_progress'
      ? []
      : await loadReviewItems(attemptId, loadVersions, (version) =>
          localizeQuestion(version, version.translations, 'en'),
        );

  const questionIds = [...new Set(items.map((item) => item.questionId))];
  const { data: current } = questionIds.length
    ? await supabase.from('questions').select('id, current_version_id').in('id', questionIds)
    : { data: [] };
  const currentById = new Map((current ?? []).map((row) => [row.id, row.current_version_id]));

  return {
    attempt: {
      id: attempt.id,
      practiceLabel: attempt.practice_label,
      attemptNumber: attempt.attempt_number,
      status: attempt.status,
      startedAt: attempt.started_at,
      submittedAt: attempt.submitted_at,
      deadlineAt: attempt.deadline_at,
      score: Number(attempt.score),
      maxScore: Number(attempt.max_score),
      percentage: attempt.percentage === null ? null : Number(attempt.percentage),
      pendingManual: attempt.pending_manual,
      studentId: attempt.student_id,
    },
    assessment: toResultAssessment(assessment),
    visible: true,
    review: true,
    items,
    figureUrls: await signFigureUrls(items.flatMap((item) => contentFigurePaths(item.content))),
    student,
    supersededVersionIds: new Set(
      items.filter((item) => currentById.get(item.questionId) !== item.versionId).map((item) => item.versionId),
    ),
  };
}
