import 'server-only';

import type { QuestionResponse } from '@/features/questions/marking/mark-question';
import { collectFigurePaths, type QuestionVersionDetail } from '@/features/questions/queries';
import { localizeQuestion, type LocalizedContent } from '@/features/questions/translation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AssessmentKind, AssessmentRow, AttemptRow, AttemptStatus, ContentLanguage } from '@/types/database';

import { finalizeAttemptPrivileged, loadVersionsPrivileged, signFiguresPrivileged } from './privileged';
import { parseStoredResponse } from './response';
import { assessmentWindow, isExpired, resultsVisible, type AssessmentWindow, type StoredPartResults } from './scoring';
import { buildSheetQuestion, type SheetQuestion } from './sheet';

/**
 * Loaders for the student's side of an assessment.
 *
 * Every read of an attempt goes through the caller's own RLS-bound client
 * first — that read *is* the authorisation — and only then, for the ids it
 * returned, through the privileged module for question content.
 */

// ---------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------

export interface AttemptSummary {
  id: string;
  practiceLabel: string | null;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  deadlineAt: string | null;
  score: number;
  maxScore: number;
  percentage: number | null;
  pendingManual: number;
}

function toAttemptSummary(row: AttemptRow): AttemptSummary {
  return {
    id: row.id,
    practiceLabel: row.practice_label,
    attemptNumber: row.attempt_number,
    status: row.status,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    deadlineAt: row.deadline_at,
    score: Number(row.score),
    maxScore: Number(row.max_score),
    percentage: row.percentage === null ? null : Number(row.percentage),
    pendingManual: row.pending_manual,
  };
}

/**
 * Closes any of these attempts whose time ran out while nobody was
 * looking — a phone that died mid-test, a tab that was closed. There is no
 * background job; the next person to look finalises it, which is always
 * before anyone can see a result.
 */
async function finalizeExpired(rows: AttemptRow[]): Promise<boolean> {
  const expired = rows.filter((row) => isExpired(row));
  for (const row of expired) await finalizeAttemptPrivileged(row.id);
  return expired.length > 0;
}

// ---------------------------------------------------------------------
// Assessment list and detail
// ---------------------------------------------------------------------

export interface StudentAssessment {
  id: string;
  title: string;
  description: string | null;
  kind: AssessmentKind;
  opensAt: string | null;
  closesAt: string | null;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  passPercentage: number | null;
  negativeMarking: boolean;
  window: AssessmentWindow;
  /** Still set for this student — false for an archived test they sat long ago. */
  active: boolean;
  attempts: AttemptSummary[];
  openAttemptId: string | null;
  attemptsLeft: number | null;
  canStart: boolean;
  resultsVisible: boolean;
  best: AttemptSummary | null;
}

function toStudentAssessment(assessment: AssessmentRow, attempts: AttemptSummary[], now = new Date()): StudentAssessment {
  const window = assessmentWindow(assessment, now);
  const active = assessment.status === 'published' && assessment.archived_at === null;
  const open = attempts.find((attempt) => attempt.status === 'in_progress') ?? null;
  const attemptsLeft = assessment.max_attempts === null ? null : Math.max(0, assessment.max_attempts - attempts.length);
  const visible = resultsVisible(assessment, now);
  const finished = attempts.filter((attempt) => attempt.status !== 'in_progress');

  return {
    id: assessment.id,
    title: assessment.title,
    description: assessment.description,
    kind: assessment.kind,
    opensAt: assessment.opens_at,
    closesAt: assessment.closes_at,
    timeLimitMinutes: assessment.time_limit_minutes,
    maxAttempts: assessment.max_attempts,
    passPercentage: assessment.pass_percentage === null ? null : Number(assessment.pass_percentage),
    negativeMarking: Number(assessment.negative_marking) > 0,
    window,
    active,
    attempts,
    openAttemptId: open?.id ?? null,
    attemptsLeft,
    canStart: active && window === 'open' && (open !== null || attemptsLeft === null || attemptsLeft > 0),
    resultsVisible: visible,
    best: visible
      ? (finished.reduce<AttemptSummary | null>(
          (best, attempt) => (best === null || (attempt.percentage ?? 0) > (best.percentage ?? 0) ? attempt : best),
          null,
        ) ?? null)
      : null,
  };
}

async function loadMyAttempts(studentId: string, assessmentId?: string): Promise<AttemptRow[]> {
  const supabase = await createSupabaseServerClient();
  const read = async () => {
    let query = supabase.from('attempts').select('*').eq('student_id', studentId);
    if (assessmentId) query = query.eq('assessment_id', assessmentId);
    const { data, error } = await query.order('attempt_number');
    if (error) throw error;
    return data ?? [];
  };

  const rows = await read();
  return (await finalizeExpired(rows)) ? read() : rows;
}

export async function listStudentAssessments(studentId: string): Promise<StudentAssessment[]> {
  const supabase = await createSupabaseServerClient();

  // RLS returns what is set for this student plus anything they have sat.
  const [{ data: assessments, error }, attempts] = await Promise.all([
    supabase.from('assessments').select('*').order('closes_at', { ascending: true, nullsFirst: false }),
    loadMyAttempts(studentId),
  ]);
  if (error) throw error;

  const byAssessment = new Map<string, AttemptSummary[]>();
  for (const row of attempts) {
    byAssessment.set(row.assessment_id, [...(byAssessment.get(row.assessment_id) ?? []), toAttemptSummary(row)]);
  }

  const now = new Date();
  return (assessments ?? [])
    // Past-paper practice has its own page.
    .filter((assessment) => !assessment.past_paper_bank)
    .map((assessment) => toStudentAssessment(assessment, byAssessment.get(assessment.id) ?? [], now));
}

export async function getStudentAssessment(
  studentId: string,
  assessmentId: string,
): Promise<(StudentAssessment & { questionCount: number | null }) | null> {
  const supabase = await createSupabaseServerClient();

  const { data: assessment } = await supabase.from('assessments').select('*').eq('id', assessmentId).maybeSingle();
  if (!assessment) return null;

  const [attempts, { data: count }] = await Promise.all([
    loadMyAttempts(studentId, assessmentId),
    supabase.rpc('assessment_question_count', { p_assessment_id: assessmentId }),
  ]);

  return {
    ...toStudentAssessment(assessment, attempts.map(toAttemptSummary)),
    questionCount: typeof count === 'number' ? count : null,
  };
}

// ---------------------------------------------------------------------
// Sitting an attempt
// ---------------------------------------------------------------------

export interface RunnerAnswer {
  response: QuestionResponse | null;
  flagged: boolean;
  /** When the server last stored it, so a newer copy on the device can win. */
  updatedAt: string;
}

export interface RunnerData {
  attemptId: string;
  attemptNumber: number;
  assessmentId: string;
  title: string;
  /** Past-paper practice returns to the past-papers page, not an assessment page. */
  pastPaper: boolean;
  deadlineAt: string | null;
  serverNow: string;
  negativeMarking: boolean;
  questions: SheetQuestion[];
  answers: Record<string, RunnerAnswer>;
  figureUrls: Map<string, string>;
}

export type RunnerLoad =
  | { state: 'ready'; data: RunnerData }
  /** Submitted, marked, or just finalised because its time ran out. */
  | { state: 'finished'; attemptId: string }
  | { state: 'missing' };

export async function getRunnerData(attemptId: string, language: ContentLanguage): Promise<RunnerLoad> {
  const supabase = await createSupabaseServerClient();

  const { data: attempt } = await supabase.from('attempts').select('*').eq('id', attemptId).maybeSingle();
  if (!attempt) return { state: 'missing' };

  if (attempt.status !== 'in_progress') return { state: 'finished', attemptId };
  if (isExpired(attempt)) {
    await finalizeAttemptPrivileged(attempt.id);
    return { state: 'finished', attemptId };
  }

  const [{ data: assessment }, { data: rows }, { data: answers }] = await Promise.all([
    supabase
      .from('assessments')
      .select('id, title, shuffle_options, negative_marking, past_paper_bank')
      .eq('id', attempt.assessment_id)
      .maybeSingle(),
    supabase.from('attempt_questions').select('id, position, question_version_id, max_marks').eq('attempt_id', attemptId).order('position'),
    supabase
      .from('attempt_answers')
      .select('attempt_question_id, response, flagged, updated_at')
      .eq('attempt_id', attemptId),
  ]);

  if (!assessment || !rows) return { state: 'missing' };

  const versions = await loadVersionsPrivileged(rows.map((row) => row.question_version_id));

  const questions: SheetQuestion[] = [];
  for (const row of rows) {
    const version = versions.get(row.question_version_id);
    if (!version) continue;
    questions.push(
      buildSheetQuestion({
        attemptQuestionId: row.id,
        position: row.position,
        marks: Number(row.max_marks),
        content: studentContent(version, language),
        shuffleOptions: assessment.shuffle_options,
      }),
    );
  }

  const figurePaths = questions.flatMap((question) => [
    ...question.figures.map((figure) => figure.path),
    ...question.parts.flatMap((part) => part.figures.map((figure) => figure.path)),
  ]);

  return {
    state: 'ready',
    data: {
      attemptId: attempt.id,
      attemptNumber: attempt.attempt_number,
      assessmentId: assessment.id,
      title: assessment.past_paper_bank ? (attempt.practice_label ?? assessment.title) : assessment.title,
      pastPaper: assessment.past_paper_bank,
      deadlineAt: attempt.deadline_at,
      serverNow: new Date().toISOString(),
      negativeMarking: Number(assessment.negative_marking) > 0,
      questions,
      answers: Object.fromEntries(
        (answers ?? []).map((row) => [
          row.attempt_question_id,
          { response: parseStoredResponse(row.response), flagged: row.flagged, updatedAt: row.updated_at },
        ]),
      ),
      figureUrls: await signFiguresPrivileged(figurePaths),
    },
  };
}

/** What a student reads: their language if a *reviewed* translation exists, English otherwise. */
function studentContent(version: QuestionVersionDetail, language: ContentLanguage): LocalizedContent {
  return localizeQuestion(version, version.translations, language);
}

// ---------------------------------------------------------------------
// Results and review
// ---------------------------------------------------------------------

export interface ReviewItem {
  attemptQuestionId: string;
  position: number;
  maxMarks: number;
  marksAwarded: number | null;
  isCorrect: boolean | null;
  requiresManual: boolean;
  awaitingTeacher: boolean;
  feedback: string | null;
  teacherComment: string | null;
  partResults: StoredPartResults | null;
  response: QuestionResponse | null;
  content: LocalizedContent;
  /** For the teacher's view: the version this attempt pinned, and whether it is still current. */
  versionId: string;
  questionId: string;
}

export interface AttemptResult {
  attempt: AttemptSummary & { studentId: string };
  assessment: {
    id: string;
    title: string;
    kind: AssessmentKind;
    passPercentage: number | null;
    shuffleOptions: boolean;
    showCorrectAnswers: boolean;
    showExplanations: boolean;
    allowReview: boolean;
    closesAt: string | null;
    pastPaper: boolean;
  };
  /** Marks may be shown. */
  visible: boolean;
  /** Question-by-question review may be shown. */
  review: boolean;
  items: ReviewItem[];
  figureUrls: Map<string, string>;
}

/**
 * A student's own result. Returns null for an attempt that is not theirs
 * (RLS hides it) or still open.
 */
export async function getStudentResult(attemptId: string, language: ContentLanguage): Promise<AttemptResult | null> {
  const supabase = await createSupabaseServerClient();

  let { data: attempt } = await supabase.from('attempts').select('*').eq('id', attemptId).maybeSingle();
  if (!attempt) return null;

  if (isExpired(attempt)) {
    await finalizeAttemptPrivileged(attempt.id);
    ({ data: attempt } = await supabase.from('attempts').select('*').eq('id', attemptId).maybeSingle());
    if (!attempt) return null;
  }
  if (attempt.status === 'in_progress') return null;

  const { data: assessment } = await supabase
    .from('assessments')
    .select('*')
    .eq('id', attempt.assessment_id)
    .maybeSingle();
  if (!assessment) return null;

  const visible = resultsVisible(assessment);
  const review = visible && assessment.allow_review;

  const items = review
    ? await loadReviewItems(attemptId, (versionIds) => loadVersionsPrivileged(versionIds), (version) =>
        studentContent(version, language),
      )
    : [];

  return {
    attempt: { ...toAttemptSummary(attempt), studentId: attempt.student_id },
    assessment: toResultAssessment(assessment),
    visible,
    review,
    items,
    figureUrls: review ? await signFiguresPrivileged(items.flatMap((item) => contentFigurePaths(item.content))) : new Map(),
  };
}

export function toResultAssessment(assessment: AssessmentRow): AttemptResult['assessment'] {
  return {
    id: assessment.id,
    title: assessment.title,
    kind: assessment.kind,
    passPercentage: assessment.pass_percentage === null ? null : Number(assessment.pass_percentage),
    shuffleOptions: assessment.shuffle_options,
    showCorrectAnswers: assessment.show_correct_answers,
    showExplanations: assessment.show_explanations,
    allowReview: assessment.allow_review,
    closesAt: assessment.closes_at,
    pastPaper: assessment.past_paper_bank,
  };
}

/**
 * Question-by-question results for one attempt. `loadVersions` decides
 * how answer keys are read: privileged for a student, through the
 * teacher's own policies for the teacher.
 */
export async function loadReviewItems(
  attemptId: string,
  loadVersions: (versionIds: string[]) => Promise<Map<string, QuestionVersionDetail>>,
  toContent: (version: QuestionVersionDetail) => LocalizedContent,
): Promise<ReviewItem[]> {
  const supabase = await createSupabaseServerClient();

  const [{ data: rows }, { data: answers }] = await Promise.all([
    supabase.from('attempt_questions').select('*').eq('attempt_id', attemptId).order('position'),
    supabase.from('attempt_answers').select('attempt_question_id, response').eq('attempt_id', attemptId),
  ]);

  const versions = await loadVersions((rows ?? []).map((row) => row.question_version_id));
  const responses = new Map((answers ?? []).map((row) => [row.attempt_question_id, parseStoredResponse(row.response)]));

  const items: ReviewItem[] = [];
  for (const row of rows ?? []) {
    const version = versions.get(row.question_version_id);
    if (!version) continue;
    items.push({
      attemptQuestionId: row.id,
      position: row.position,
      maxMarks: Number(row.max_marks),
      marksAwarded: row.marks_awarded === null ? null : Number(row.marks_awarded),
      isCorrect: row.is_correct,
      requiresManual: row.requires_manual,
      awaitingTeacher: row.requires_manual && row.marked_at === null,
      feedback: row.feedback,
      teacherComment: row.teacher_comment,
      partResults: (row.part_results ?? null) as StoredPartResults | null,
      response: responses.get(row.id) ?? null,
      content: toContent(version),
      versionId: version.id,
      questionId: row.question_id,
    });
  }
  return items;
}

export function contentFigurePaths(content: LocalizedContent): string[] {
  return collectFigurePaths({
    figures: content.figures,
    body: content.body,
  } as QuestionVersionDetail);
}
