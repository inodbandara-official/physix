import type { DifficultyLevel, QuestionType } from '@/types/database';

import { APP_TIME_ZONE } from '@/lib/time';

/**
 * Performance analytics, as pure functions over served-question records.
 *
 * Accuracy is **marks earned over marks available**, with a negatively
 * marked question counted as 0 rather than below it — accuracy describes
 * what a student knows, and a guessing penalty is about the test, not the
 * topic. Every figure travels with its sample size, because 2 out of 3 is
 * not evidence of anything (§25).
 */

export interface QuestionRecord {
  studentId: string;
  attemptId: string;
  questionId: string;
  submittedAt: string;
  unitId: string | null;
  nodeId: string | null;
  difficulty: DifficultyLevel | null;
  type: QuestionType | null;
  marks: number;
  maxMarks: number;
  answered: boolean;
}

export interface Accuracy {
  /** 0–100, or null when there is nothing to measure. */
  accuracy: number | null;
  questions: number;
  marks: number;
  maxMarks: number;
}

export function accuracyOf(records: QuestionRecord[]): Accuracy {
  let marks = 0;
  let maxMarks = 0;
  for (const record of records) {
    marks += Math.max(0, record.marks);
    maxMarks += record.maxMarks;
  }
  return {
    accuracy: maxMarks > 0 ? Math.round((marks / maxMarks) * 1000) / 10 : null,
    questions: records.length,
    marks: Math.round(marks * 100) / 100,
    maxMarks: Math.round(maxMarks * 100) / 100,
  };
}

export function groupAccuracy<K extends string>(
  records: QuestionRecord[],
  keyOf: (record: QuestionRecord) => K | null,
): Map<K, Accuracy> {
  const groups = new Map<K, QuestionRecord[]>();
  for (const record of records) {
    const key = keyOf(record);
    if (key === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return new Map([...groups].map(([key, group]) => [key, accuracyOf(group)]));
}

/** How a question is answered, which is what students experience as its kind. */
export type QuestionCategory = 'numerical' | 'conceptual' | 'written';

export function categoryOf(type: QuestionType | null): QuestionCategory | null {
  switch (type) {
    case 'numerical':
      return 'numerical';
    case 'mcq':
    case 'multi':
    case 'true_false':
    case 'short_answer':
      return 'conceptual';
    case 'essay':
    case 'structured':
      return 'written';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------
// Weak topics
// ---------------------------------------------------------------------

/** Below this accuracy a topic needs attention. */
export const WEAK_THRESHOLD = 60;
/** Fewer questions than this is not enough to call a topic weak. */
export const MIN_QUESTIONS = 5;

export interface TopicFinding extends Accuracy {
  topicId: string;
}

/**
 * Topics where accuracy is below the threshold on enough questions to
 * mean something, weakest first. `topicOf` folds a subtopic into its
 * topic, so ten questions spread over three subtopics still count as ten.
 */
export function weakTopics(
  records: QuestionRecord[],
  topicOf: (nodeId: string | null) => string | null,
  { threshold = WEAK_THRESHOLD, minQuestions = MIN_QUESTIONS } = {},
): TopicFinding[] {
  return [...groupAccuracy(records, (record) => topicOf(record.nodeId))]
    .map(([topicId, accuracy]) => ({ topicId, ...accuracy }))
    .filter((topic) => topic.questions >= minQuestions && topic.accuracy !== null && topic.accuracy < threshold)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
}

/** Maps any syllabus node to its topic-level ancestor (a unit maps to itself). */
export function topicResolver(
  nodes: { id: string; parent_id: string | null; kind: string }[],
): (nodeId: string | null) => string | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return (nodeId) => {
    let current = nodeId ? byId.get(nodeId) : undefined;
    for (let depth = 0; depth < 8 && current; depth += 1) {
      if (current.kind === 'topic' || current.kind === 'unit') return current.id;
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return null;
  };
}

// ---------------------------------------------------------------------
// Over time
// ---------------------------------------------------------------------

export interface AttemptRecord {
  attemptId: string;
  studentId: string;
  assessmentId: string;
  submittedAt: string;
  percentage: number;
}

/** "2026-03" in Colombo time, so an attempt at 11 pm on the 31st lands in the right month. */
export function monthKey(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit' })
    .formatToParts(new Date(iso));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

export function dayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));
}

export interface MonthPoint {
  month: string;
  average: number;
  attempts: number;
}

export function monthlyTimeline(attempts: AttemptRecord[]): MonthPoint[] {
  const months = new Map<string, number[]>();
  for (const attempt of attempts) {
    const key = monthKey(attempt.submittedAt);
    months.set(key, [...(months.get(key) ?? []), attempt.percentage]);
  }
  return [...months]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({
      month,
      average: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
      attempts: values.length,
    }));
}

/**
 * Change from the first to the latest month with data, in percentage
 * points. Null until there are two months to compare.
 */
export function improvement(timeline: MonthPoint[]): number | null {
  if (timeline.length < 2) return null;
  return Math.round((timeline[timeline.length - 1].average - timeline[0].average) * 10) / 10;
}

// ---------------------------------------------------------------------
// Personal bests
// ---------------------------------------------------------------------

export interface PersonalBests {
  highestPercentage: number | null;
  questionsAnswered: number;
  questionsFullyCorrect: number;
  /** Most consecutive days with at least one submitted attempt. */
  longestStreak: number;
}

export function personalBests(attempts: AttemptRecord[], records: QuestionRecord[]): PersonalBests {
  const days = [...new Set(attempts.map((attempt) => dayKey(attempt.submittedAt)))].sort();
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of days) {
    const time = Date.parse(`${day}T00:00:00Z`);
    run = previous !== null && time - previous === 86_400_000 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = time;
  }

  return {
    highestPercentage: attempts.length ? Math.max(...attempts.map((attempt) => attempt.percentage)) : null,
    questionsAnswered: records.filter((record) => record.answered).length,
    questionsFullyCorrect: records.filter((record) => record.maxMarks > 0 && record.marks >= record.maxMarks).length,
    longestStreak: longest,
  };
}

// ---------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------

export interface Summary {
  count: number;
  mean: number | null;
  median: number | null;
  standardDeviation: number | null;
  highest: number | null;
  lowest: number | null;
}

export function summarise(values: number[]): Summary {
  if (values.length === 0) {
    return { count: 0, mean: null, median: null, standardDeviation: null, highest: null, lowest: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  // Population SD: these are the whole class, not a sample of a larger one.
  const variance = sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length;
  const r = (value: number) => Math.round(value * 10) / 10;
  return {
    count: sorted.length,
    mean: r(mean),
    median: r(median),
    standardDeviation: r(Math.sqrt(variance)),
    highest: r(sorted[sorted.length - 1]),
    lowest: r(sorted[0]),
  };
}

export interface Bin {
  /** "0–9", …, "90–100". */
  label: string;
  from: number;
  to: number;
  count: number;
}

/** Ten-point bins; 100% falls in the last bin rather than an eleventh. */
export function histogram(percentages: number[]): Bin[] {
  const bins: Bin[] = Array.from({ length: 10 }, (_, index) => ({
    label: index === 9 ? '90–100' : `${index * 10}–${index * 10 + 9}`,
    from: index * 10,
    to: index === 9 ? 100 : index * 10 + 9,
    count: 0,
  }));
  for (const value of percentages) {
    const index = Math.min(9, Math.max(0, Math.floor(value / 10)));
    bins[index].count += 1;
  }
  return bins;
}

// ---------------------------------------------------------------------
// Question health
// ---------------------------------------------------------------------

export interface QuestionStats {
  questionId: string;
  attempts: number;
  /** Share of attempts scoring full marks, 0–100. */
  correctRate: number | null;
  averageMarks: number | null;
  maxMarks: number;
  skipRate: number | null;
  flags: QuestionFlag[];
}

export type QuestionFlag = 'too-easy' | 'too-hard' | 'often-skipped' | 'often-wrong';

/** Below this many attempts no flag is raised — the numbers are too thin. */
export const MIN_ATTEMPTS_FOR_FLAGS = 10;

export function questionStats(records: QuestionRecord[]): QuestionStats[] {
  const byQuestion = new Map<string, QuestionRecord[]>();
  for (const record of records) byQuestion.set(record.questionId, [...(byQuestion.get(record.questionId) ?? []), record]);

  return [...byQuestion].map(([questionId, group]) => {
    const attempts = group.length;
    const full = group.filter((record) => record.maxMarks > 0 && record.marks >= record.maxMarks).length;
    const answered = group.filter((record) => record.answered).length;
    const correctRate = attempts ? Math.round((full / attempts) * 1000) / 10 : null;
    const skipRate = attempts ? Math.round(((attempts - answered) / attempts) * 1000) / 10 : null;
    const wrongAnswered = group.filter((record) => record.answered && record.marks <= 0).length;

    const flags: QuestionFlag[] = [];
    if (attempts >= MIN_ATTEMPTS_FOR_FLAGS && correctRate !== null && skipRate !== null) {
      if (correctRate >= 90) flags.push('too-easy');
      if (correctRate <= 25) flags.push('too-hard');
      if (skipRate >= 25) flags.push('often-skipped');
      if (answered > 0 && wrongAnswered / answered >= 0.6) flags.push('often-wrong');
    }

    return {
      questionId,
      attempts,
      correctRate,
      averageMarks: attempts
        ? Math.round((group.reduce((sum, record) => sum + Math.max(0, record.marks), 0) / attempts) * 100) / 100
        : null,
      maxMarks: group[0]?.maxMarks ?? 0,
      skipRate,
      flags,
    };
  });
}

export const FLAG_LABELS: Record<QuestionFlag, string> = {
  'too-easy': 'Possibly too easy',
  'too-hard': 'Possibly too hard',
  'often-skipped': 'Often skipped',
  'often-wrong': 'Often answered wrongly',
};
