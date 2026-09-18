import { describe, expect, it } from 'vitest';

import type { QuestionBody, QuestionPart } from '@/features/questions/types';

import { markQuestion, normalizeText } from './mark-question';

const options = [
  { id: 'o1', text: 'A', feedback: null },
  { id: 'o2', text: 'B', feedback: null },
  { id: 'o3', text: 'C', feedback: null },
  { id: 'o4', text: 'D', feedback: null },
];

describe('markQuestion — multiple choice', () => {
  const body: QuestionBody = { kind: 'mcq', options, correctOptionId: 'o2', shuffleOptions: true };

  it('awards full marks for the correct option', () => {
    expect(markQuestion(body, { kind: 'mcq', optionId: 'o2' }, 2)).toMatchObject({ marks: 2, correct: true });
  });

  it('awards nothing for a wrong option', () => {
    expect(markQuestion(body, { kind: 'mcq', optionId: 'o3' }, 2)).toMatchObject({ marks: 0, correct: false });
  });

  it('treats no selection as unanswered', () => {
    expect(markQuestion(body, { kind: 'mcq', optionId: null }, 2)).toMatchObject({ marks: 0, correct: false });
    expect(markQuestion(body, null, 2)).toMatchObject({ marks: 0, correct: false });
  });

  it('marks nothing correct when no answer key was set', () => {
    const unkeyed: QuestionBody = { ...body, correctOptionId: null };
    expect(markQuestion(unkeyed, { kind: 'mcq', optionId: 'o2' }, 2).correct).toBe(false);
  });

  it('ignores a response of the wrong shape', () => {
    expect(markQuestion(body, { kind: 'true_false', value: true }, 2)).toMatchObject({ correct: false, marks: 0 });
  });
});

describe('markQuestion — multiple response', () => {
  const body: QuestionBody = {
    kind: 'multi',
    options,
    correctOptionIds: ['o1', 'o3'],
    shuffleOptions: false,
    partialCredit: true,
  };

  it('awards full marks for exactly the correct set', () => {
    expect(markQuestion(body, { kind: 'multi', optionIds: ['o1', 'o3'] }, 4)).toMatchObject({
      marks: 4,
      correct: true,
    });
  });

  it('is insensitive to the order options were selected in', () => {
    expect(markQuestion(body, { kind: 'multi', optionIds: ['o3', 'o1'] }, 4).marks).toBe(4);
  });

  it('gives partial marks for a partially correct set', () => {
    expect(markQuestion(body, { kind: 'multi', optionIds: ['o1'] }, 4)).toMatchObject({ marks: 2, correct: false });
  });

  it('cancels a correct selection against an incorrect one', () => {
    // One right, one wrong: 2 marks earned, 2 lost.
    expect(markQuestion(body, { kind: 'multi', optionIds: ['o1', 'o2'] }, 4).marks).toBe(0);
  });

  it('does not reward selecting every option', () => {
    // The scheme has to stop "tick everything" from scoring.
    expect(markQuestion(body, { kind: 'multi', optionIds: ['o1', 'o2', 'o3', 'o4'] }, 4).marks).toBe(0);
  });

  it('never returns negative marks', () => {
    expect(markQuestion(body, { kind: 'multi', optionIds: ['o2', 'o4'] }, 4).marks).toBe(0);
  });

  it('is all-or-nothing when partial credit is off', () => {
    const strict: QuestionBody = { ...body, partialCredit: false } as QuestionBody;
    expect(markQuestion(strict, { kind: 'multi', optionIds: ['o1'] }, 4).marks).toBe(0);
    expect(markQuestion(strict, { kind: 'multi', optionIds: ['o1', 'o3'] }, 4).marks).toBe(4);
  });

  it('treats an empty selection as unanswered', () => {
    expect(markQuestion(body, { kind: 'multi', optionIds: [] }, 4)).toMatchObject({ marks: 0, correct: false });
  });
});

describe('markQuestion — true/false', () => {
  const body: QuestionBody = { kind: 'true_false', correct: true };

  it('marks a matching answer correct', () => {
    expect(markQuestion(body, { kind: 'true_false', value: true }, 1).correct).toBe(true);
  });

  it('marks the opposite answer wrong', () => {
    expect(markQuestion(body, { kind: 'true_false', value: false }, 1).correct).toBe(false);
  });

  it('treats no selection as unanswered', () => {
    expect(markQuestion(body, { kind: 'true_false', value: null }, 1).marks).toBe(0);
  });
});

describe('markQuestion — short answer', () => {
  const body: QuestionBody = {
    kind: 'short_answer',
    normalizeWhitespace: true,
    answers: [
      { id: 's1', text: 'acceleration', caseSensitive: false },
      { id: 's2', text: 'rate of change of velocity', caseSensitive: false },
    ],
  };

  it('accepts any configured answer', () => {
    expect(markQuestion(body, { kind: 'short_answer', text: 'acceleration' }, 1).correct).toBe(true);
    expect(markQuestion(body, { kind: 'short_answer', text: 'rate of change of velocity' }, 1).correct).toBe(true);
  });

  it('ignores case when the answer is not case-sensitive', () => {
    expect(markQuestion(body, { kind: 'short_answer', text: 'Acceleration' }, 1).correct).toBe(true);
  });

  it('respects case when the teacher asked for it', () => {
    // Physics symbols where case carries meaning, e.g. "N" vs "n".
    const strict: QuestionBody = {
      kind: 'short_answer',
      normalizeWhitespace: true,
      answers: [{ id: 's1', text: 'N', caseSensitive: true }],
    };
    expect(markQuestion(strict, { kind: 'short_answer', text: 'N' }, 1).correct).toBe(true);
    expect(markQuestion(strict, { kind: 'short_answer', text: 'n' }, 1).correct).toBe(false);
  });

  it('forgives stray spacing and a trailing full stop', () => {
    expect(markQuestion(body, { kind: 'short_answer', text: '  rate of   change of velocity. ' }, 1).correct).toBe(
      true,
    );
  });

  it('rejects an answer that is merely similar', () => {
    expect(markQuestion(body, { kind: 'short_answer', text: 'accelerate' }, 1).correct).toBe(false);
  });

  it('falls back to manual marking when nothing was configured', () => {
    const empty: QuestionBody = { kind: 'short_answer', normalizeWhitespace: true, answers: [] };
    expect(markQuestion(empty, { kind: 'short_answer', text: 'anything' }, 1)).toMatchObject({
      requiresManualMarking: true,
      correct: null,
    });
  });
});

describe('markQuestion — essay', () => {
  const body: QuestionBody = { kind: 'essay', guidance: null, rubric: null, expectedWords: null };

  it('always defers to a human', () => {
    const result = markQuestion(body, { kind: 'essay', text: 'A long explanation…' }, 10);
    expect(result).toMatchObject({ marks: 0, correct: null, requiresManualMarking: true });
  });

  it('still defers when nothing was written', () => {
    expect(markQuestion(body, { kind: 'essay', text: '' }, 10).requiresManualMarking).toBe(true);
  });
});

describe('markQuestion — structured', () => {
  // A particle under constant acceleration: (a) acceleration, (b) final
  // velocity, (c) displacement — the classic A/L three-parter.
  const structuredParts: QuestionPart[] = [
      {
        id: 'p1',
        label: 'a',
        prompt: 'Calculate the acceleration.',
        marks: 2,
        explanation: null,
        figures: [],
        body: {
          kind: 'numerical',
          answers: [
            {
              id: 'n1',
              value: '2.5',
              tolerance: { mode: 'absolute', value: '0.05' },
              significantFigures: null,
              requireUnit: true,
              acceptedUnits: ['m s^-2'],
              marks: null,
              note: null,
            },
          ],
        },
      },
      {
        id: 'p2',
        label: 'b',
        prompt: 'Calculate the final velocity.',
        marks: 3,
        explanation: null,
        figures: [],
        body: {
          kind: 'numerical',
          answers: [
            {
              id: 'n2',
              value: '12.5',
              tolerance: { mode: 'absolute', value: '0.1' },
              significantFigures: null,
              requireUnit: false,
              acceptedUnits: [],
              marks: null,
              note: null,
            },
          ],
        },
      },
      {
        id: 'p3',
        label: 'c',
        prompt: 'Explain the assumption made.',
        marks: 5,
        explanation: null,
        figures: [],
        body: { kind: 'essay', guidance: null, rubric: null, expectedWords: null },
      },
  ];

  const body: QuestionBody = { kind: 'structured', parts: structuredParts };

  it('marks each part independently and sums the marks', () => {
    const result = markQuestion(
      body,
      {
        kind: 'structured',
        parts: {
          p1: { kind: 'numerical', text: '2.5 m s^-2' },
          p2: { kind: 'numerical', text: '12.5' },
          p3: { kind: 'essay', text: 'Air resistance is neglected.' },
        },
      },
      10,
    );

    expect(result.parts?.p1.marks).toBe(2);
    expect(result.parts?.p2.marks).toBe(3);
    expect(result.parts?.p3.marks).toBe(0);
    expect(result.marks).toBe(5);
  });

  it('flags the whole question for manual marking when any part needs it', () => {
    const result = markQuestion(body, { kind: 'structured', parts: {} }, 10);
    expect(result.requiresManualMarking).toBe(true);
    expect(result.correct).toBeNull();
  });

  it('awards marks for the parts answered and none for those skipped', () => {
    const result = markQuestion(
      body,
      { kind: 'structured', parts: { p1: { kind: 'numerical', text: '2.5 m s^-2' } } },
      10,
    );
    expect(result.marks).toBe(2);
    expect(result.parts?.p2.marks).toBe(0);
  });

  it('does not let a part exceed its own marks', () => {
    const result = markQuestion(
      body,
      { kind: 'structured', parts: { p2: { kind: 'numerical', text: '12.5' } } },
      10,
    );
    expect(result.parts?.p2.marks).toBe(3);
  });

  it('caps the total at the question total', () => {
    // Defence in depth: the schema keeps part marks summing to the whole,
    // but a mismatched record must not inflate a student's score.
    const result = markQuestion(
      body,
      {
        kind: 'structured',
        parts: {
          p1: { kind: 'numerical', text: '2.5 m s^-2' },
          p2: { kind: 'numerical', text: '12.5' },
        },
      },
      4,
    );
    expect(result.marks).toBe(4);
  });

  it('reports every part correct only when all of them are', () => {
    const autoOnly: QuestionBody = { kind: 'structured', parts: structuredParts.slice(0, 2) };

    const allRight = markQuestion(
      autoOnly,
      {
        kind: 'structured',
        parts: {
          p1: { kind: 'numerical', text: '2.5 m s^-2' },
          p2: { kind: 'numerical', text: '12.5' },
        },
      },
      5,
    );
    expect(allRight.correct).toBe(true);

    const oneWrong = markQuestion(
      autoOnly,
      {
        kind: 'structured',
        parts: {
          p1: { kind: 'numerical', text: '9 m s^-2' },
          p2: { kind: 'numerical', text: '12.5' },
        },
      },
      5,
    );
    expect(oneWrong.correct).toBe(false);
  });
});

describe('normalizeText', () => {
  it('collapses whitespace only when asked', () => {
    expect(normalizeText('a   b', true, true)).toBe('a b');
    expect(normalizeText('a   b', false, true)).toBe('a   b');
  });

  it('strips trailing punctuation', () => {
    expect(normalizeText('acceleration.', true, true)).toBe('acceleration');
    expect(normalizeText('acceleration!?', true, true)).toBe('acceleration');
  });

  it('leaves punctuation inside the answer alone', () => {
    expect(normalizeText('e.g. velocity', true, true)).toBe('e.g. velocity');
  });
});
