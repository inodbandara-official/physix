import type { QuestionBody, SimpleQuestionBody } from '@/features/questions/types';

import { markNumerical } from './numerical';

/**
 * The marking engine.
 *
 * Pure functions over a body and a response — no database, no session, no
 * side effects — so the rules can be tested exhaustively and reused
 * unchanged by the attempt pipeline in Phase 3.
 */

export type SimpleResponse =
  | { kind: 'mcq'; optionId: string | null }
  | { kind: 'multi'; optionIds: string[] }
  | { kind: 'true_false'; value: boolean | null }
  | { kind: 'numerical'; text: string }
  | { kind: 'short_answer'; text: string }
  | { kind: 'essay'; text: string };

export type QuestionResponse =
  | SimpleResponse
  | { kind: 'structured'; parts: Record<string, SimpleResponse | undefined> };

export interface MarkResult {
  marks: number;
  maxMarks: number;
  /** `null` when a human still has to decide. */
  correct: boolean | null;
  requiresManualMarking: boolean;
  detail: string;
  /** Present for structured questions, keyed by part id. */
  parts?: Record<string, MarkResult>;
}

export function markQuestion(
  body: QuestionBody,
  response: QuestionResponse | null | undefined,
  maxMarks: number,
): MarkResult {
  if (body.kind === 'structured') {
    return markStructured(body.parts, response, maxMarks);
  }

  if (!response || response.kind !== body.kind) {
    return unanswered(body, maxMarks);
  }

  return markSimple(body, response, maxMarks);
}

function unanswered(body: SimpleQuestionBody, maxMarks: number): MarkResult {
  const manual = body.kind === 'essay';
  return {
    marks: 0,
    maxMarks,
    correct: manual ? null : false,
    requiresManualMarking: manual,
    detail: 'No answer given.',
  };
}

function markSimple(body: SimpleQuestionBody, response: SimpleResponse, maxMarks: number): MarkResult {
  switch (body.kind) {
    case 'mcq': {
      const chosen = response.kind === 'mcq' ? response.optionId : null;
      if (!chosen) return unanswered(body, maxMarks);
      const correct = body.correctOptionId !== null && chosen === body.correctOptionId;
      return {
        marks: correct ? maxMarks : 0,
        maxMarks,
        correct,
        requiresManualMarking: false,
        detail: correct ? 'Correct option chosen.' : 'Incorrect option chosen.',
      };
    }

    case 'multi': {
      const chosen = response.kind === 'multi' ? response.optionIds : [];
      return markMultipleResponse(body.correctOptionIds, body.options.length, chosen, body.partialCredit, maxMarks);
    }

    case 'true_false': {
      const given = response.kind === 'true_false' ? response.value : null;
      if (given === null) return unanswered(body, maxMarks);
      const correct = body.correct !== null && given === body.correct;
      return {
        marks: correct ? maxMarks : 0,
        maxMarks,
        correct,
        requiresManualMarking: false,
        detail: correct ? 'Correct.' : 'Incorrect.',
      };
    }

    case 'numerical': {
      const text = response.kind === 'numerical' ? response.text : '';
      const result = markNumerical(text, body.answers, maxMarks);
      return {
        marks: result.marks,
        maxMarks,
        correct: result.correct,
        requiresManualMarking: false,
        detail: result.detail,
      };
    }

    case 'short_answer': {
      const text = response.kind === 'short_answer' ? response.text : '';
      return markShortAnswer(body.answers, body.normalizeWhitespace, text, maxMarks);
    }

    case 'essay': {
      const text = response.kind === 'essay' ? response.text : '';
      return {
        marks: 0,
        maxMarks,
        correct: null,
        requiresManualMarking: true,
        detail: text.trim() === '' ? 'No answer given.' : 'Awaiting manual marking.',
      };
    }
  }
}

/**
 * Multiple response.
 *
 * With partial credit, each correct option found earns a share of the
 * marks and each incorrect option selected cancels one out, floored at
 * zero. That is the standard negative-within-question scheme, and it stops
 * "select everything" from scoring.
 */
export function markMultipleResponse(
  correctIds: string[],
  totalOptions: number,
  chosenIds: string[],
  partialCredit: boolean,
  maxMarks: number,
): MarkResult {
  const correctSet = new Set(correctIds);
  const chosenSet = new Set(chosenIds);

  if (chosenSet.size === 0) {
    return {
      marks: 0,
      maxMarks,
      correct: false,
      requiresManualMarking: false,
      detail: 'No options selected.',
    };
  }

  const hits = [...chosenSet].filter((id) => correctSet.has(id)).length;
  const misses = chosenSet.size - hits;
  const exact = hits === correctSet.size && misses === 0;

  if (exact) {
    return {
      marks: maxMarks,
      maxMarks,
      correct: true,
      requiresManualMarking: false,
      detail: 'All correct options selected.',
    };
  }

  if (!partialCredit || correctSet.size === 0) {
    return {
      marks: 0,
      maxMarks,
      correct: false,
      requiresManualMarking: false,
      detail: `Selected ${hits} of ${correctSet.size} correct option(s), with ${misses} incorrect.`,
    };
  }

  const share = maxMarks / correctSet.size;
  const marks = roundMarks(Math.max(0, hits * share - misses * share));

  return {
    marks,
    maxMarks,
    correct: false,
    requiresManualMarking: false,
    detail: `Selected ${hits} of ${correctSet.size} correct option(s), with ${misses} incorrect (of ${totalOptions}).`,
  };
}

function markShortAnswer(
  accepted: { id: string; text: string; caseSensitive: boolean }[],
  normalizeWhitespace: boolean,
  response: string,
  maxMarks: number,
): MarkResult {
  if (response.trim() === '') {
    return {
      marks: 0,
      maxMarks,
      correct: false,
      requiresManualMarking: false,
      detail: 'No answer given.',
    };
  }

  if (accepted.length === 0) {
    return {
      marks: 0,
      maxMarks,
      correct: null,
      requiresManualMarking: true,
      detail: 'No accepted answers configured — marked by hand.',
    };
  }

  const match = accepted.find((candidate) => {
    const left = normalizeText(response, normalizeWhitespace, candidate.caseSensitive);
    const right = normalizeText(candidate.text, normalizeWhitespace, candidate.caseSensitive);
    return left === right;
  });

  return {
    marks: match ? maxMarks : 0,
    maxMarks,
    correct: Boolean(match),
    requiresManualMarking: false,
    detail: match ? 'Matches an accepted answer.' : 'Does not match any accepted answer.',
  };
}

/**
 * Trailing punctuation is dropped so "acceleration." matches
 * "acceleration", but nothing inside the answer is altered: an engine that
 * rewrites what the student wrote cannot explain why it marked them wrong.
 */
export function normalizeText(value: string, collapseWhitespace: boolean, caseSensitive: boolean): string {
  let out = value.trim().replace(/[.,;:!?]+$/u, '');
  if (collapseWhitespace) out = out.replace(/\s+/g, ' ');
  if (!caseSensitive) out = out.toLowerCase();
  return out;
}

function markStructured(
  parts: { id: string; label: string; marks: number; body: SimpleQuestionBody }[],
  response: QuestionResponse | null | undefined,
  maxMarks: number,
): MarkResult {
  const given = response && response.kind === 'structured' ? response.parts : {};

  const results: Record<string, MarkResult> = {};
  let total = 0;
  let manual = false;
  let allCorrect = parts.length > 0;

  for (const part of parts) {
    const partResponse = given[part.id];
    const result = partResponse
      ? markSimple(part.body, partResponse, part.marks)
      : unanswered(part.body, part.marks);

    results[part.id] = result;
    total += result.marks;
    if (result.requiresManualMarking) manual = true;
    if (result.correct !== true) allCorrect = false;
  }

  // The question's own mark total is authoritative; part marks should sum
  // to it, and the schema enforces that on save.
  const marks = roundMarks(Math.min(total, maxMarks));

  return {
    marks,
    maxMarks,
    correct: manual ? null : allCorrect,
    requiresManualMarking: manual,
    detail: manual
      ? `${marks} of ${maxMarks} from auto-marked parts; some parts need manual marking.`
      : `${marks} of ${maxMarks} across ${parts.length} part(s).`,
    parts: results,
  };
}

/** Marks are stored to two decimal places, matching numeric(6,2). */
export function roundMarks(value: number): number {
  return Math.round(value * 100) / 100;
}
