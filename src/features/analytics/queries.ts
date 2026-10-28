import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { resultsVisible } from '@/features/attempts/scoring';
import { chunk, fetchAllPages } from '@/lib/supabase/paginate';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AssessmentKind, Database, SyllabusNodeRow } from '@/types/database';

import {
  accuracyOf,
  categoryOf,
  groupAccuracy,
  improvement,
  monthlyTimeline,
  personalBests,
  questionStats,
  summarise,
  topicResolver,
  weakTopics,
  type Accuracy,
  type AttemptRecord,
  type MonthPoint,
  type PersonalBests,
  type QuestionCategory,
  type QuestionRecord,
  type QuestionStats,
  type TopicFinding,
} from './compute';

type Client = SupabaseClient<Database>;

export interface DatasetAttempt extends AttemptRecord {
  assessmentTitle: string;
  assessmentKind: AssessmentKind;
  pastPaper: boolean;
  practiceLabel: string | null;
  score: number;
  maxScore: number;
}

export interface Dataset {
  attempts: DatasetAttempt[];
  records: QuestionRecord[];
}

interface DatasetOptions {
  /** Null for every student the client can see. */
  studentIds: string[] | null;
  /** ISO date; only attempts submitted on or after it. */
  since?: string | null;
  /** Drop attempts whose results the student cannot see yet. Always true for a student. */
  visibleOnly: boolean;
}

/**
 * Every finished attempt in scope, and every marked question in them.
 *
 * Reads through whichever client it is given, so the same code serves a
 * student (their own rows, by RLS) and the teacher (everyone's).
 */
export async function loadDataset(client: Client, options: DatasetOptions): Promise<Dataset> {
  const attemptRows = (
    options.studentIds === null
      ? await fetchAllPages((from, to) => {
          let query = client
            .from('attempts')
            .select('id, student_id, assessment_id, status, submitted_at, percentage, score, max_score, practice_label')
            .neq('status', 'in_progress');
          if (options.since) query = query.gte('submitted_at', options.since);
          return query.order('submitted_at').range(from, to);
        })
      : (
          await Promise.all(
            chunk(options.studentIds).map((ids) =>
              fetchAllPages((from, to) => {
                let query = client
                  .from('attempts')
                  .select('id, student_id, assessment_id, status, submitted_at, percentage, score, max_score, practice_label')
                  .neq('status', 'in_progress')
                  .in('student_id', ids);
                if (options.since) query = query.gte('submitted_at', options.since);
                return query.order('submitted_at').range(from, to);
              }),
            ),
          )
        ).flat()
  ).filter((row) => row.submitted_at !== null);

  const assessmentIds = [...new Set(attemptRows.map((row) => row.assessment_id))];
  const assessments = new Map<
    string,
    {
      title: string;
      kind: AssessmentKind;
      past_paper_bank: boolean;
      show_results_immediately: boolean;
      results_released_at: string | null;
      closes_at: string | null;
    }
  >();
  for (const ids of chunk(assessmentIds)) {
    const { data } = await client
      .from('assessments')
      .select('id, title, kind, past_paper_bank, show_results_immediately, results_released_at, closes_at')
      .in('id', ids);
    for (const row of data ?? []) assessments.set(row.id, row);
  }

  const now = new Date();
  const kept = attemptRows.filter((row) => {
    const assessment = assessments.get(row.assessment_id);
    if (!assessment) return false;
    return !options.visibleOnly || resultsVisible(assessment, now);
  });

  const attempts: DatasetAttempt[] = kept
    // A score is only final once nothing waits for the teacher.
    .filter((row) => row.status === 'graded' && row.percentage !== null)
    .map((row) => {
      const assessment = assessments.get(row.assessment_id)!;
      return {
        attemptId: row.id,
        studentId: row.student_id,
        assessmentId: row.assessment_id,
        submittedAt: row.submitted_at!,
        percentage: Number(row.percentage),
        score: Number(row.score),
        maxScore: Number(row.max_score),
        assessmentTitle: assessment.title,
        assessmentKind: assessment.kind,
        pastPaper: assessment.past_paper_bank,
        practiceLabel: row.practice_label,
      };
    });

  const attemptById = new Map(kept.map((row) => [row.id, row]));
  const records: QuestionRecord[] = [];

  for (const ids of chunk([...attemptById.keys()], 100)) {
    const [questions, answered] = await Promise.all([
      fetchAllPages((from, to) =>
        client
          .from('attempt_questions')
          .select('id, attempt_id, question_id, marks_awarded, max_marks, node_id, unit_id, difficulty, question_type')
          .in('attempt_id', ids)
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        client
          .from('attempt_answers')
          .select('attempt_question_id')
          .in('attempt_id', ids)
          .not('response', 'is', null)
          .range(from, to),
      ),
    ]);

    const answeredIds = new Set(answered.map((row) => row.attempt_question_id));
    for (const row of questions) {
      // Not yet marked by hand: nothing to measure until it is.
      if (row.marks_awarded === null) continue;
      const attempt = attemptById.get(row.attempt_id)!;
      records.push({
        studentId: attempt.student_id,
        attemptId: row.attempt_id,
        questionId: row.question_id,
        submittedAt: attempt.submitted_at!,
        unitId: row.unit_id,
        nodeId: row.node_id,
        difficulty: row.difficulty,
        type: row.question_type,
        marks: Number(row.marks_awarded),
        maxMarks: Number(row.max_marks),
        answered: answeredIds.has(row.id),
      });
    }
  }

  return { attempts, records };
}

async function loadSyllabus(client: Client): Promise<Pick<SyllabusNodeRow, 'id' | 'parent_id' | 'kind' | 'name' | 'name_si' | 'sort_order'>[]> {
  const { data } = await client.from('syllabus_nodes').select('id, parent_id, kind, name, name_si, sort_order');
  return data ?? [];
}

// ---------------------------------------------------------------------
// One student
// ---------------------------------------------------------------------

export interface NamedAccuracy extends Accuracy {
  id: string;
  name: string;
  nameSi: string | null;
}

export interface StudentReport {
  overall: Accuracy;
  averagePercentage: number | null;
  attemptsCount: number;
  units: NamedAccuracy[];
  weak: (TopicFinding & { name: string; nameSi: string | null })[];
  difficulty: { level: string; accuracy: Accuracy }[];
  categories: { category: QuestionCategory; accuracy: Accuracy }[];
  timeline: MonthPoint[];
  improvement: number | null;
  bests: PersonalBests;
  recent: DatasetAttempt[];
}

export function buildStudentReport(
  dataset: Dataset,
  nodes: Pick<SyllabusNodeRow, 'id' | 'parent_id' | 'kind' | 'name' | 'name_si' | 'sort_order'>[],
): StudentReport {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const topicOf = topicResolver(nodes);
  const { records, attempts } = dataset;

  const units = [...groupAccuracy(records, (record) => record.unitId)]
    .map(([id, accuracy]) => ({ id, name: byId.get(id)?.name ?? 'Unsorted', nameSi: byId.get(id)?.name_si ?? null, ...accuracy }))
    .sort((a, b) => (byId.get(a.id)?.sort_order ?? 0) - (byId.get(b.id)?.sort_order ?? 0));

  const difficultyOrder = ['very_easy', 'easy', 'medium', 'hard', 'very_hard'];
  const difficulty = [...groupAccuracy(records, (record) => record.difficulty)]
    .map(([level, accuracy]) => ({ level, accuracy }))
    .sort((a, b) => difficultyOrder.indexOf(a.level) - difficultyOrder.indexOf(b.level));

  const categoryOrder: QuestionCategory[] = ['numerical', 'conceptual', 'written'];
  const categories = [...groupAccuracy(records, (record) => categoryOf(record.type))]
    .map(([category, accuracy]) => ({ category, accuracy }))
    .sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));

  const timeline = monthlyTimeline(attempts);
  const percentages = attempts.map((attempt) => attempt.percentage);

  return {
    overall: accuracyOf(records),
    averagePercentage: summarise(percentages).mean,
    attemptsCount: attempts.length,
    units,
    weak: weakTopics(records, topicOf)
      .slice(0, 5)
      .map((topic) => ({ ...topic, name: byId.get(topic.topicId)?.name ?? '—', nameSi: byId.get(topic.topicId)?.name_si ?? null })),
    difficulty,
    categories,
    timeline,
    improvement: improvement(timeline),
    bests: personalBests(attempts, records),
    recent: [...attempts].reverse().slice(0, 8),
  };
}

/** A student's own report: their rows only, and only results they may already see. */
export async function getMyReport(studentId: string): Promise<StudentReport> {
  const client = await createSupabaseServerClient();
  const [dataset, nodes] = await Promise.all([
    loadDataset(client, { studentIds: [studentId], visibleOnly: true }),
    loadSyllabus(client),
  ]);
  return buildStudentReport(dataset, nodes);
}

/** The teacher's view of one student: every finished attempt, held-back results included. */
export async function getStudentReportForTeacher(studentId: string): Promise<StudentReport> {
  const client = await createSupabaseServerClient();
  const [dataset, nodes] = await Promise.all([
    loadDataset(client, { studentIds: [studentId], visibleOnly: false }),
    loadSyllabus(client),
  ]);
  return buildStudentReport(dataset, nodes);
}

// ---------------------------------------------------------------------
// A class
// ---------------------------------------------------------------------

export interface ClassReport {
  students: { id: string; name: string; code: string }[];
  units: { id: string; name: string }[];
  /** studentId → unitId → accuracy. */
  heatmap: Map<string, Map<string, Accuracy>>;
  studentOverall: Map<string, Accuracy>;
  unitOverall: Map<string, Accuracy>;
  weak: (TopicFinding & { name: string })[];
  timeline: MonthPoint[];
  summary: ReturnType<typeof summarise>;
  attempts: number;
  activeStudents: number;
  questions: (QuestionStats & { code: string; title: string })[];
}

export async function getClassReport(batchId: string | null, since: string | null): Promise<ClassReport> {
  const client = await createSupabaseServerClient();

  let studentRows: { id: string; full_name: string; student_code: string }[];
  if (batchId) {
    const { data } = await client
      .from('batch_members')
      .select('students(id, full_name, student_code, archived_at)')
      .eq('batch_id', batchId)
      .is('left_at', null);
    studentRows = ((data ?? []) as unknown as { students: { id: string; full_name: string; student_code: string; archived_at: string | null } | null }[])
      .map((row) => row.students)
      .filter((student): student is NonNullable<typeof student> => Boolean(student && !student.archived_at));
  } else {
    const { data } = await client.from('students').select('id, full_name, student_code').is('archived_at', null);
    studentRows = data ?? [];
  }
  studentRows.sort((a, b) => a.full_name.localeCompare(b.full_name));

  const [dataset, nodes] = await Promise.all([
    loadDataset(client, { studentIds: studentRows.map((student) => student.id), since, visibleOnly: false }),
    loadSyllabus(client),
  ]);

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const topicOf = topicResolver(nodes);
  const units = nodes
    .filter((node) => node.kind === 'unit')
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((node) => ({ id: node.id, name: node.name }))
    .filter((unit) => dataset.records.some((record) => record.unitId === unit.id));

  const heatmap = new Map<string, Map<string, Accuracy>>();
  for (const student of studentRows) {
    const mine = dataset.records.filter((record) => record.studentId === student.id);
    heatmap.set(student.id, groupAccuracy(mine, (record) => record.unitId));
  }

  const stats = questionStats(dataset.records).filter((item) => item.flags.length > 0);
  const flaggedIds = stats.map((item) => item.questionId);
  const labels = new Map<string, { code: string; title: string }>();
  for (const ids of chunk(flaggedIds)) {
    const { data } = await client.from('questions').select('id, question_code, current_title, current_stem').in('id', ids);
    for (const row of data ?? []) {
      labels.set(row.id, { code: row.question_code, title: row.current_title || (row.current_stem ?? '').slice(0, 90) });
    }
  }

  return {
    students: studentRows.map((student) => ({ id: student.id, name: student.full_name, code: student.student_code })),
    units,
    heatmap,
    studentOverall: groupAccuracy(dataset.records, (record) => record.studentId),
    unitOverall: groupAccuracy(dataset.records, (record) => record.unitId),
    weak: weakTopics(dataset.records, topicOf, { minQuestions: 10 })
      .slice(0, 8)
      .map((topic) => ({ ...topic, name: byId.get(topic.topicId)?.name ?? '—' })),
    timeline: monthlyTimeline(dataset.attempts.filter((attempt) => !attempt.pastPaper)),
    summary: summarise(dataset.attempts.filter((attempt) => !attempt.pastPaper).map((attempt) => attempt.percentage)),
    attempts: dataset.attempts.length,
    activeStudents: new Set(dataset.attempts.map((attempt) => attempt.studentId)).size,
    questions: stats
      .map((item) => ({ ...item, code: labels.get(item.questionId)?.code ?? '—', title: labels.get(item.questionId)?.title ?? '' }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 20),
  };
}

// ---------------------------------------------------------------------
// One question
// ---------------------------------------------------------------------

export async function getQuestionPerformance(questionId: string): Promise<QuestionStats | null> {
  const client = await createSupabaseServerClient();

  const rows = await fetchAllPages((from, to) =>
    client
      .from('attempt_questions')
      .select('id, attempt_id, question_id, marks_awarded, max_marks, node_id, unit_id, difficulty, question_type, attempts(student_id, submitted_at, status)')
      .eq('question_id', questionId)
      .range(from, to),
  );

  type Row = (typeof rows)[number] & { attempts: { student_id: string; submitted_at: string | null; status: string } | null };
  const finished = (rows as Row[]).filter(
    (row) => row.attempts && row.attempts.status !== 'in_progress' && row.marks_awarded !== null,
  );
  if (finished.length === 0) return null;

  const answered = new Set<string>();
  for (const ids of chunk(finished.map((row) => row.id), 150)) {
    const { data } = await client
      .from('attempt_answers')
      .select('attempt_question_id')
      .in('attempt_question_id', ids)
      .not('response', 'is', null);
    for (const row of data ?? []) answered.add(row.attempt_question_id);
  }

  const records: QuestionRecord[] = finished.map((row) => ({
    studentId: row.attempts!.student_id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    submittedAt: row.attempts!.submitted_at ?? new Date().toISOString(),
    unitId: row.unit_id,
    nodeId: row.node_id,
    difficulty: row.difficulty,
    type: row.question_type,
    marks: Number(row.marks_awarded),
    maxMarks: Number(row.max_marks),
    answered: answered.has(row.id),
  }));

  return questionStats(records)[0] ?? null;
}

// ---------------------------------------------------------------------
// One assessment
// ---------------------------------------------------------------------

export interface AssessmentAnalytics {
  summary: ReturnType<typeof summarise>;
  percentages: number[];
  units: { id: string; name: string; accuracy: Accuracy }[];
  questions: (QuestionStats & { code: string; title: string })[];
  assigned: number;
  participated: number;
}

/** Best finished attempt per student, which is how an assessment's class result is read. */
export async function getAssessmentAnalytics(assessmentId: string): Promise<AssessmentAnalytics> {
  const client = await createSupabaseServerClient();

  const [{ data: attemptRows }, { data: links }, nodes] = await Promise.all([
    client
      .from('attempts')
      .select('id, student_id, status, percentage')
      .eq('assessment_id', assessmentId)
      .neq('status', 'in_progress'),
    client.from('assessment_batches').select('batch_id').eq('assessment_id', assessmentId),
    loadSyllabus(client),
  ]);

  const best = new Map<string, number>();
  for (const row of attemptRows ?? []) {
    if (row.status !== 'graded' || row.percentage === null) continue;
    best.set(row.student_id, Math.max(best.get(row.student_id) ?? -1, Number(row.percentage)));
  }

  let assigned = 0;
  const batchIds = (links ?? []).map((link) => link.batch_id);
  if (batchIds.length > 0) {
    const { data: members } = await client
      .from('batch_members')
      .select('student_id')
      .in('batch_id', batchIds)
      .is('left_at', null);
    assigned = new Set((members ?? []).map((row) => row.student_id)).size;
  }

  const dataset = await loadDataset(client, {
    studentIds: [...new Set((attemptRows ?? []).map((row) => row.student_id))],
    visibleOnly: false,
  });
  const ids = new Set((attemptRows ?? []).map((row) => row.id));
  const records = dataset.records.filter((record) => ids.has(record.attemptId));

  const names = new Map(nodes.map((node) => [node.id, node.name]));
  const stats = questionStats(records);
  const labels = new Map<string, { code: string; title: string }>();
  for (const chunkIds of chunk(stats.map((item) => item.questionId))) {
    const { data } = await client.from('questions').select('id, question_code, current_title, current_stem').in('id', chunkIds);
    for (const row of data ?? []) {
      labels.set(row.id, { code: row.question_code, title: row.current_title || (row.current_stem ?? '').slice(0, 90) });
    }
  }

  const percentages = [...best.values()];
  return {
    summary: summarise(percentages),
    percentages,
    units: [...groupAccuracy(records, (record) => record.unitId)]
      .map(([id, accuracy]) => ({ id, name: names.get(id) ?? 'Unsorted', accuracy }))
      .sort((a, b) => (a.accuracy.accuracy ?? 0) - (b.accuracy.accuracy ?? 0)),
    questions: stats
      .map((item) => ({ ...item, code: labels.get(item.questionId)?.code ?? '—', title: labels.get(item.questionId)?.title ?? '' }))
      .sort((a, b) => (a.correctRate ?? 0) - (b.correctRate ?? 0)),
    assigned,
    participated: best.size,
  };
}
