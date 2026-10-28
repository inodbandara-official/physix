import { markQuestion, roundMarks, type MarkResult, type QuestionResponse } from '@/features/questions/marking/mark-question';
import type { QuestionBody } from '@/features/questions/types';

import { isAnswered } from './response';

/**
 * Attempt-level rules layered over the per-question marking engine.
 * Pure, so every rule below is covered by tests rather than by trust.
 */

/** How long after the deadline an autosave already in flight is still accepted. Mirrors the SQL. */
export const DEADLINE_GRACE_MS = 30_000;

/** Kinds where a wrong answer can cost marks. A blank never does. */
const NEGATIVELY_MARKED = new Set<QuestionBody['kind']>(['mcq', 'true_false']);

/**
 * Marks one question of an attempt.
 *
 * Negative marking is deliberately narrow: only single-answer multiple
 * choice and true/false, only when answered, only when wrong. That is the
 * guessing penalty A/L students know from MCQ papers; applying it to a
 * numerical answer with the wrong unit would punish working, not guessing.
 */
export function markAttemptQuestion(
  body: QuestionBody,
  response: QuestionResponse | null,
  maxMarks: number,
  negativeFraction: number,
): MarkResult {
  const result = markQuestion(body, response, maxMarks);

  if (
    negativeFraction > 0 &&
    NEGATIVELY_MARKED.has(body.kind) &&
    isAnswered(response) &&
    result.correct === false
  ) {
    const penalty = roundMarks(maxMarks * Math.min(1, negativeFraction));
    return {
      ...result,
      marks: -penalty,
      detail: `${result.detail} ${penalty} ${penalty === 1 ? 'mark' : 'marks'} deducted for a wrong answer.`,
    };
  }

  return result;
}

/** A structured question's per-part results, in the compact form stored on the attempt. */
export type StoredPartResults = Record<
  string,
  { marks: number; maxMarks: number; correct: boolean | null; requiresManual: boolean; detail: string }
>;

export function toStoredParts(result: MarkResult): StoredPartResults | null {
  if (!result.parts) return null;
  const out: StoredPartResults = {};
  for (const [partId, part] of Object.entries(result.parts)) {
    out[partId] = {
      marks: part.marks,
      maxMarks: part.maxMarks,
      correct: part.correct,
      requiresManual: part.requiresManualMarking,
      detail: part.detail,
    };
  }
  return out;
}

export interface VisibilityRules {
  show_results_immediately: boolean;
  results_released_at: string | null;
  closes_at: string | null;
}

/**
 * Whether a student may see their marks yet.
 *
 * Held-back results appear on their own once the assessment closes — the
 * usual reason to hold them is so early finishers cannot pass answers on —
 * or earlier if the teacher releases them by hand.
 */
export function resultsVisible(rules: VisibilityRules, now: Date = new Date()): boolean {
  if (rules.show_results_immediately) return true;
  if (rules.results_released_at) return true;
  return rules.closes_at !== null && now.getTime() >= new Date(rules.closes_at).getTime();
}

/** An open attempt whose time has run out and which nobody submitted. */
export function isExpired(
  attempt: { status: string; deadline_at: string | null },
  now: Date = new Date(),
): boolean {
  if (attempt.status !== 'in_progress' || !attempt.deadline_at) return false;
  return now.getTime() > new Date(attempt.deadline_at).getTime() + DEADLINE_GRACE_MS;
}

export type AssessmentWindow = 'upcoming' | 'open' | 'closed';

export function assessmentWindow(
  assessment: { opens_at: string | null; closes_at: string | null },
  now: Date = new Date(),
): AssessmentWindow {
  const time = now.getTime();
  if (assessment.opens_at && time < new Date(assessment.opens_at).getTime()) return 'upcoming';
  if (assessment.closes_at && time >= new Date(assessment.closes_at).getTime()) return 'closed';
  return 'open';
}

/** Pass or fail, or null when the assessment sets no pass mark or the score is not final. */
export function passed(percentage: number | null, passPercentage: number | null): boolean | null {
  if (percentage === null || passPercentage === null) return null;
  return percentage >= passPercentage;
}
