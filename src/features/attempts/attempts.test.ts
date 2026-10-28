import { describe, expect, it } from 'vitest';

import { localizeQuestion } from '@/features/questions/translation';
import type { QuestionBody } from '@/features/questions/types';

import { isAnswered, parseStoredResponse, questionResponseSchema } from './response';
import {
  assessmentWindow,
  isExpired,
  markAttemptQuestion,
  passed,
  resultsVisible,
  toStoredParts,
} from './scoring';
import { buildSheetQuestion, orderOptions } from './sheet';
import { hashSeed, seededShuffle } from './shuffle';

const mcq: QuestionBody = {
  kind: 'mcq',
  options: [
    { id: 'a', text: 'Speed', feedback: 'Speed has no direction.' },
    { id: 'b', text: 'Velocity', feedback: 'Correct — it has direction.' },
    { id: 'c', text: 'Mass', feedback: null },
    { id: 'd', text: 'Energy', feedback: null },
  ],
  correctOptionId: 'b',
  shuffleOptions: true,
};

const numerical: QuestionBody = {
  kind: 'numerical',
  answers: [
    {
      id: 'n1',
      value: '19.8',
      tolerance: { mode: 'absolute', value: '0.1' },
      significantFigures: 3,
      requireUnit: true,
      acceptedUnits: ['m s^-1', 'm/s'],
      marks: null,
      note: 'SECRET-TEACHER-NOTE',
    },
  ],
};

const structured: QuestionBody = {
  kind: 'structured',
  parts: [
    {
      id: 'p1',
      label: 'a',
      prompt: 'State Newton’s first law.',
      marks: 2,
      body: { kind: 'essay', guidance: 'One sentence.', rubric: 'SECRET-RUBRIC', expectedWords: 30 },
      explanation: 'SECRET-PART-EXPLANATION',
      figures: [],
    },
    {
      id: 'p2',
      label: 'b',
      prompt: 'Is momentum conserved?',
      marks: 1,
      body: { kind: 'true_false', correct: true },
      explanation: null,
      figures: [],
    },
  ],
};

function content(body: QuestionBody) {
  return localizeQuestion(
    {
      title: 'Title',
      stem: 'Which is a vector?',
      explanation: 'SECRET-EXPLANATION',
      solution: 'SECRET-SOLUTION',
      hint: 'SECRET-HINT',
      common_mistake: 'SECRET-MISTAKE',
      body,
      figures: [],
    },
    {},
    'en',
  );
}

describe('seededShuffle', () => {
  it('is deterministic for a seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    expect(seededShuffle(items, 'seed-1')).toEqual(seededShuffle(items, 'seed-1'));
  });

  it('keeps every item exactly once', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect([...seededShuffle(items, 'x')].sort()).toEqual(items);
  });

  it('does not mutate its input', () => {
    const items = ['a', 'b', 'c'];
    seededShuffle(items, 'y');
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('varies between seeds', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const orders = new Set(Array.from({ length: 20 }, (_, i) => seededShuffle(items, `seed-${i}`).join('')));
    expect(orders.size).toBeGreaterThan(10);
  });

  it('hashes to an unsigned 32-bit integer', () => {
    const hash = hashSeed('anything');
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
  });
});

describe('orderOptions', () => {
  it('letters options in displayed order', () => {
    const ordered = orderOptions(
      [
        { id: 'x', text: 'X' },
        { id: 'y', text: 'Y' },
      ],
      null,
    );
    expect(ordered).toEqual([
      { id: 'x', letter: 'A', text: 'X' },
      { id: 'y', letter: 'B', text: 'Y' },
    ]);
  });
});

describe('buildSheetQuestion — nothing secret reaches the browser', () => {
  const secrets = ['SECRET', '19.8', 'Correct — it has direction', 'Speed has no direction', 'correctOptionId', 'm/s'];

  for (const [name, body] of [
    ['mcq', mcq],
    ['numerical', numerical],
    ['structured', structured],
  ] as const) {
    it(`strips the answer key from a ${name} question`, () => {
      const sheet = buildSheetQuestion({
        attemptQuestionId: 'aq-1',
        position: 1,
        marks: 3,
        content: content(body),
        shuffleOptions: true,
      });
      const serialised = JSON.stringify(sheet);
      for (const secret of secrets) expect(serialised).not.toContain(secret);
    });
  }

  it('keeps the options, in a stable shuffled order', () => {
    const build = () =>
      buildSheetQuestion({ attemptQuestionId: 'aq-7', position: 1, marks: 1, content: content(mcq), shuffleOptions: true });
    const first = build();
    expect(first.input?.kind).toBe('mcq');
    if (first.input?.kind !== 'mcq') return;
    expect(first.input.options.map((option) => option.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(build()).toEqual(first);
  });

  it('keeps authored order when the assessment disables shuffling', () => {
    const sheet = buildSheetQuestion({
      attemptQuestionId: 'aq-2',
      position: 1,
      marks: 1,
      content: content(mcq),
      shuffleOptions: false,
    });
    expect(sheet.input?.kind === 'mcq' && sheet.input.options.map((option) => option.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps essay guidance, which students are meant to read', () => {
    const sheet = buildSheetQuestion({
      attemptQuestionId: 'aq-3',
      position: 1,
      marks: 3,
      content: content(structured),
      shuffleOptions: true,
    });
    expect(sheet.parts[0].input).toEqual({ kind: 'essay', guidance: 'One sentence.', expectedWords: 30 });
  });
});

describe('markAttemptQuestion — negative marking', () => {
  it('deducts the configured fraction for a wrong MCQ answer', () => {
    const result = markAttemptQuestion(mcq, { kind: 'mcq', optionId: 'a' }, 4, 0.25);
    expect(result.marks).toBe(-1);
    expect(result.correct).toBe(false);
  });

  it('never deducts for a blank answer', () => {
    expect(markAttemptQuestion(mcq, { kind: 'mcq', optionId: null }, 4, 0.25).marks).toBe(0);
    expect(markAttemptQuestion(mcq, null, 4, 0.25).marks).toBe(0);
  });

  it('never deducts from a correct answer', () => {
    expect(markAttemptQuestion(mcq, { kind: 'mcq', optionId: 'b' }, 4, 0.25).marks).toBe(4);
  });

  it('leaves numerical questions alone', () => {
    const result = markAttemptQuestion(numerical, { kind: 'numerical', text: '5 m/s' }, 2, 0.5);
    expect(result.marks).toBe(0);
  });

  it('does nothing when switched off', () => {
    expect(markAttemptQuestion(mcq, { kind: 'mcq', optionId: 'a' }, 4, 0).marks).toBe(0);
  });

  it('applies to true / false', () => {
    const body: QuestionBody = { kind: 'true_false', correct: true };
    expect(markAttemptQuestion(body, { kind: 'true_false', value: false }, 2, 0.5).marks).toBe(-1);
  });
});

describe('toStoredParts', () => {
  it('keeps per-part marks for a structured question', () => {
    const result = markAttemptQuestion(
      structured,
      { kind: 'structured', parts: { p2: { kind: 'true_false', value: true } } },
      3,
      0,
    );
    const parts = toStoredParts(result);
    expect(parts?.p2.marks).toBe(1);
    expect(parts?.p1.requiresManual).toBe(true);
    expect(result.requiresManualMarking).toBe(true);
  });

  it('is null for a simple question', () => {
    expect(toStoredParts(markAttemptQuestion(mcq, null, 1, 0))).toBeNull();
  });
});

describe('resultsVisible', () => {
  const now = new Date('2026-10-01T12:00:00Z');

  it('shows immediately when configured', () => {
    expect(resultsVisible({ show_results_immediately: true, results_released_at: null, closes_at: null }, now)).toBe(true);
  });

  it('holds results until the assessment closes', () => {
    const rules = { show_results_immediately: false, results_released_at: null, closes_at: '2026-10-01T13:00:00Z' };
    expect(resultsVisible(rules, now)).toBe(false);
    expect(resultsVisible(rules, new Date('2026-10-01T13:00:00Z'))).toBe(true);
  });

  it('shows once the teacher releases them', () => {
    expect(
      resultsVisible({ show_results_immediately: false, results_released_at: '2026-10-01T11:00:00Z', closes_at: null }, now),
    ).toBe(true);
  });

  it('holds indefinitely with no close date and no release', () => {
    expect(resultsVisible({ show_results_immediately: false, results_released_at: null, closes_at: null }, now)).toBe(false);
  });
});

describe('isExpired', () => {
  const deadline = '2026-10-01T12:00:00Z';

  it('allows the grace period', () => {
    expect(isExpired({ status: 'in_progress', deadline_at: deadline }, new Date('2026-10-01T12:00:20Z'))).toBe(false);
    expect(isExpired({ status: 'in_progress', deadline_at: deadline }, new Date('2026-10-01T12:00:31Z'))).toBe(true);
  });

  it('never expires an untimed or finished attempt', () => {
    expect(isExpired({ status: 'in_progress', deadline_at: null })).toBe(false);
    expect(isExpired({ status: 'graded', deadline_at: '2000-01-01T00:00:00Z' })).toBe(false);
  });
});

describe('assessmentWindow', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  it('classifies the window', () => {
    expect(assessmentWindow({ opens_at: '2026-10-02T00:00:00Z', closes_at: null }, now)).toBe('upcoming');
    expect(assessmentWindow({ opens_at: null, closes_at: '2026-10-01T11:00:00Z' }, now)).toBe('closed');
    expect(assessmentWindow({ opens_at: null, closes_at: null }, now)).toBe('open');
  });
});

describe('passed', () => {
  it('compares against the pass mark', () => {
    expect(passed(50, 50)).toBe(true);
    expect(passed(49.99, 50)).toBe(false);
    expect(passed(80, null)).toBeNull();
  });
});

describe('responses', () => {
  it('recognises answered and blank responses', () => {
    expect(isAnswered({ kind: 'numerical', text: '  ' })).toBe(false);
    expect(isAnswered({ kind: 'numerical', text: '9.8' })).toBe(true);
    expect(isAnswered({ kind: 'multi', optionIds: [] })).toBe(false);
    expect(isAnswered({ kind: 'structured', parts: { p1: { kind: 'mcq', optionId: null } } })).toBe(false);
    expect(isAnswered({ kind: 'structured', parts: { p1: { kind: 'true_false', value: false } } })).toBe(true);
  });

  it('rejects oversized and malformed responses', () => {
    expect(questionResponseSchema.safeParse({ kind: 'numerical', text: 'x'.repeat(500) }).success).toBe(false);
    expect(questionResponseSchema.safeParse({ kind: 'mcq' }).success).toBe(false);
    expect(parseStoredResponse({ kind: 'nonsense' })).toBeNull();
    expect(parseStoredResponse({ kind: 'mcq', optionId: 'a' })).toEqual({ kind: 'mcq', optionId: 'a' });
  });
});
