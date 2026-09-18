import Decimal from 'decimal.js';

import type { NumericalAnswer } from '@/features/questions/types';

import { countSignificantFigures, parseNumericAnswer } from './numeric-parse';

/**
 * Marking a numerical Physics answer.
 *
 * Three rules govern everything here, and all three exist because the
 * alternative marks correct Physics as wrong:
 *
 * 1. Arithmetic is decimal, never floating point.
 * 2. Significant figures are counted from the string the student typed,
 *    not from the parsed value — 9.810 and 9.81 differ.
 * 3. Units are compared against an explicit list. Nothing is converted
 *    implicitly: if km/h is acceptable, the teacher says so and gives the
 *    value in km/h.
 */

export type NumericalOutcome =
  | 'exact'
  | 'within-tolerance'
  | 'wrong-value'
  | 'missing-unit'
  | 'wrong-unit'
  | 'wrong-significant-figures'
  | 'unparseable'
  | 'blank';

export interface NumericalMarkResult {
  correct: boolean;
  /** Marks earned, capped at `maxMarks`. */
  marks: number;
  outcome: NumericalOutcome;
  /** Which accepted answer matched, when one did. */
  matchedAnswerId: string | null;
  /** Teacher-facing explanation of the outcome. Never shown to a student mid-attempt. */
  detail: string;
}

const OUTCOME_RANK: Record<NumericalOutcome, number> = {
  exact: 0,
  'within-tolerance': 1,
  'wrong-significant-figures': 2,
  'wrong-unit': 3,
  'missing-unit': 4,
  'wrong-value': 5,
  unparseable: 6,
  blank: 7,
};

/**
 * Marks a response against every accepted answer and reports the best
 * result. "Best" means most marks, then the most informative outcome — so
 * a student who got the value right but the unit wrong is told that,
 * rather than simply "wrong".
 */
export function markNumerical(
  response: string | null | undefined,
  answers: NumericalAnswer[],
  maxMarks: number,
): NumericalMarkResult {
  if (response === null || response === undefined || response.trim() === '') {
    return blank();
  }

  if (answers.length === 0) {
    return {
      correct: false,
      marks: 0,
      outcome: 'wrong-value',
      matchedAnswerId: null,
      detail: 'This question has no accepted answer configured.',
    };
  }

  const parsed = parseNumericAnswer(response);
  if (!parsed.ok) {
    return {
      correct: false,
      marks: 0,
      outcome: parsed.reason === 'empty' ? 'blank' : 'unparseable',
      matchedAnswerId: null,
      detail:
        parsed.reason === 'empty'
          ? 'No answer given.'
          : `"${response.trim()}" could not be read as a number.`,
    };
  }

  let best: NumericalMarkResult | null = null;

  for (const answer of answers) {
    const result = markAgainst(parsed.parsed, answer, maxMarks);
    if (!best || isBetter(result, best)) best = result;
  }

  return best ?? blank();
}

function isBetter(candidate: NumericalMarkResult, current: NumericalMarkResult): boolean {
  if (candidate.marks !== current.marks) return candidate.marks > current.marks;
  return OUTCOME_RANK[candidate.outcome] < OUTCOME_RANK[current.outcome];
}

function blank(): NumericalMarkResult {
  return {
    correct: false,
    marks: 0,
    outcome: 'blank',
    matchedAnswerId: null,
    detail: 'No answer given.',
  };
}

function markAgainst(
  parsed: { value: Decimal; raw: string; unit: string; significantFigures: number },
  answer: NumericalAnswer,
  maxMarks: number,
): NumericalMarkResult {
  const awarded = Math.min(answer.marks ?? maxMarks, maxMarks);

  let expected: Decimal;
  try {
    expected = new Decimal(answer.value);
  } catch {
    return {
      correct: false,
      marks: 0,
      outcome: 'wrong-value',
      matchedAnswerId: answer.id,
      detail: `The accepted answer "${answer.value}" is not a valid number.`,
    };
  }

  // --- value -----------------------------------------------------------
  const difference = parsed.value.minus(expected).abs();
  let valueOutcome: 'exact' | 'within-tolerance' | 'wrong-value';

  if (parsed.value.equals(expected)) {
    valueOutcome = 'exact';
  } else if (answer.tolerance.mode === 'exact') {
    valueOutcome = 'wrong-value';
  } else {
    let limit: Decimal;
    try {
      limit = new Decimal(answer.tolerance.value || '0');
    } catch {
      limit = new Decimal(0);
    }
    // A relative tolerance is a fraction of the expected magnitude. Against
    // an expected value of zero it would always be zero, so it degrades to
    // an absolute comparison rather than rejecting every answer.
    const allowed =
      answer.tolerance.mode === 'relative' && !expected.isZero()
        ? limit.times(expected.abs())
        : limit;
    valueOutcome = difference.lessThanOrEqualTo(allowed) ? 'within-tolerance' : 'wrong-value';
  }

  if (valueOutcome === 'wrong-value') {
    return {
      correct: false,
      marks: 0,
      outcome: 'wrong-value',
      matchedAnswerId: answer.id,
      detail: `Expected ${answer.value}${describeTolerance(answer)}, got ${parsed.raw}.`,
    };
  }

  // --- units -----------------------------------------------------------
  // Checked before significant figures: a missing unit is the more useful
  // thing to tell a student who has otherwise done the Physics correctly.
  if (answer.requireUnit || answer.acceptedUnits.length > 0) {
    const unitResult = checkUnit(parsed.unit, answer);
    if (unitResult) return { ...unitResult, matchedAnswerId: answer.id };
  }

  // --- significant figures --------------------------------------------
  if (answer.significantFigures !== null) {
    const given = countSignificantFigures(parsed.raw);
    if (given !== answer.significantFigures) {
      return {
        correct: false,
        marks: 0,
        outcome: 'wrong-significant-figures',
        matchedAnswerId: answer.id,
        detail: `Answer must be given to ${answer.significantFigures} significant figures; "${parsed.raw}" has ${given}.`,
      };
    }
  }

  return {
    correct: true,
    marks: awarded,
    outcome: valueOutcome,
    matchedAnswerId: answer.id,
    detail:
      valueOutcome === 'exact'
        ? 'Exact match.'
        : `Within the accepted tolerance of ${answer.value}.`,
  };
}

function checkUnit(
  given: string,
  answer: NumericalAnswer,
): Omit<NumericalMarkResult, 'matchedAnswerId'> | null {
  const normalized = normalizeUnit(given);

  if (normalized === '') {
    if (!answer.requireUnit) return null;
    return {
      correct: false,
      marks: 0,
      outcome: 'missing-unit',
      detail: `A unit is required (${answer.acceptedUnits.join(' or ') || 'see the accepted answer'}).`,
    };
  }

  if (answer.acceptedUnits.length === 0) {
    // No list configured: any unit is tolerated rather than guessed at.
    return null;
  }

  const accepted = answer.acceptedUnits.map(normalizeUnit);
  if (accepted.includes(normalized)) return null;

  return {
    correct: false,
    marks: 0,
    outcome: 'wrong-unit',
    detail: `Unit "${given.trim()}" is not accepted. Expected ${answer.acceptedUnits.join(' or ')}.`,
  };
}

/**
 * Normalises only what is unambiguously cosmetic: surrounding whitespace,
 * repeated spaces, and the several characters used for multiplication and
 * division in unit strings.
 *
 * Case is preserved. In SI, `m` and `M`, `s` and `S`, `k` and `K` are
 * different things, and a marking engine that ignores that teaches
 * students a bad habit.
 */
export function normalizeUnit(unit: string): string {
  return unit
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[·⋅*]/g, ' ')
    .replace(/∕/g, '/')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function describeTolerance(answer: NumericalAnswer): string {
  switch (answer.tolerance.mode) {
    case 'absolute':
      return ` ± ${answer.tolerance.value}`;
    case 'relative':
      return ` ± ${new Decimal(answer.tolerance.value || '0').times(100).toString()}%`;
    default:
      return '';
  }
}
