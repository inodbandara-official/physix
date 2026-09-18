import { describe, expect, it } from 'vitest';

import { publishIssues, questionBodySchema, questionInputSchema, totalPartMarks } from './schema';
import type { QuestionBody } from './types';

const validInput = {
  question_code: 'Q-1001',
  type: 'mcq' as const,
  stem: 'Which quantity is a vector?',
  marks: 1,
  body: {
    kind: 'mcq' as const,
    options: [
      { id: 'o1', text: 'Speed', feedback: null },
      { id: 'o2', text: 'Velocity', feedback: null },
    ],
    correctOptionId: 'o2',
    shuffleOptions: true,
  },
};

describe('questionInputSchema', () => {
  it('accepts a minimal question', () => {
    const result = questionInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.difficulty).toBe('medium');
      expect(result.data.tags).toEqual([]);
    }
  });

  it('rejects a question worth nothing', () => {
    expect(questionInputSchema.safeParse({ ...validInput, marks: 0 }).success).toBe(false);
  });

  it('lowercases tags so they group correctly', () => {
    const result = questionInputSchema.safeParse({ ...validInput, tags: ['Past-Paper', 'MECHANICS'] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tags).toEqual(['past-paper', 'mechanics']);
  });

  it('rejects a tag with spaces', () => {
    expect(questionInputSchema.safeParse({ ...validInput, tags: ['past paper'] }).success).toBe(false);
  });

  it('rejects an empty question stem', () => {
    expect(questionInputSchema.safeParse({ ...validInput, stem: '   ' }).success).toBe(false);
  });
});

describe('questionBodySchema', () => {
  it('accepts a draft with no answer key yet', () => {
    // Half-written questions must be savable, or the teacher loses work.
    const result = questionBodySchema.safeParse({
      kind: 'mcq',
      options: [],
      correctOptionId: null,
      shuffleOptions: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a numerical answer that is not a number', () => {
    const result = questionBodySchema.safeParse({
      kind: 'numerical',
      answers: [
        {
          id: 'n1',
          value: 'about nine',
          tolerance: { mode: 'exact', value: '0' },
          significantFigures: null,
          requireUnit: false,
          acceptedUnits: [],
          marks: null,
          note: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts scientific notation in an answer value', () => {
    const result = questionBodySchema.safeParse({
      kind: 'numerical',
      answers: [
        {
          id: 'n1',
          value: '1.6e-19',
          tolerance: { mode: 'relative', value: '0.01' },
          significantFigures: 2,
          requireUnit: true,
          acceptedUnits: ['C'],
          marks: null,
          note: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a structured question nested inside a part', () => {
    const result = questionBodySchema.safeParse({
      kind: 'structured',
      parts: [
        {
          id: 'p1',
          label: 'a',
          prompt: 'Do something',
          marks: 2,
          explanation: null,
          figures: [],
          body: { kind: 'structured', parts: [] },
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('publishIssues', () => {
  const base = {
    type: 'mcq' as const,
    stem: 'Which of the following quantities is a vector?',
    marks: 1,
    syllabus_node_id: '11111111-1111-1111-1111-111111111111',
  };

  it('passes a complete multiple-choice question', () => {
    expect(publishIssues({ ...base, body: validInput.body })).toEqual([]);
  });

  it('requires a syllabus topic', () => {
    const issues = publishIssues({ ...base, syllabus_node_id: undefined, body: validInput.body });
    expect(issues.join(' ')).toContain('syllabus topic');
  });

  it('requires an answer key', () => {
    const body: QuestionBody = { ...validInput.body, correctOptionId: null };
    expect(publishIssues({ ...base, body }).join(' ')).toContain('Mark which option is correct');
  });

  it('catches an answer key pointing at a deleted option', () => {
    const body: QuestionBody = { ...validInput.body, correctOptionId: 'gone' };
    expect(publishIssues({ ...base, body }).join(' ')).toContain('no longer exists');
  });

  it('requires at least two options', () => {
    const body: QuestionBody = { ...validInput.body, options: [validInput.body.options[0]], correctOptionId: 'o1' };
    expect(publishIssues({ ...base, body }).join(' ')).toContain('two options');
  });

  it('rejects a multiple-response question where every option is correct', () => {
    const body: QuestionBody = {
      kind: 'multi',
      options: validInput.body.options,
      correctOptionIds: ['o1', 'o2'],
      shuffleOptions: true,
      partialCredit: true,
    };
    expect(publishIssues({ ...base, type: 'multi', body }).join(' ')).toContain('cannot discriminate');
  });

  it('requires a tolerance value when the tolerance is not exact', () => {
    const body: QuestionBody = {
      kind: 'numerical',
      answers: [
        {
          id: 'n1',
          value: '9.81',
          tolerance: { mode: 'absolute', value: '0' },
          significantFigures: null,
          requireUnit: false,
          acceptedUnits: [],
          marks: null,
          note: null,
        },
      ],
    };
    expect(publishIssues({ ...base, type: 'numerical', body }).join(' ')).toContain('above zero');
  });

  it('requires accepted units when a unit is mandatory', () => {
    const body: QuestionBody = {
      kind: 'numerical',
      answers: [
        {
          id: 'n1',
          value: '9.81',
          tolerance: { mode: 'exact', value: '0' },
          significantFigures: null,
          requireUnit: true,
          acceptedUnits: [],
          marks: null,
          note: null,
        },
      ],
    };
    expect(publishIssues({ ...base, type: 'numerical', body }).join(' ')).toContain('units that are accepted');
  });

  it('reports issues per part for a structured question', () => {
    const body: QuestionBody = {
      kind: 'structured',
      parts: [
        {
          id: 'p1',
          label: 'a',
          prompt: 'Calculate the acceleration.',
          marks: 2,
          explanation: null,
          figures: [],
          body: { kind: 'numerical', answers: [] },
        },
      ],
    };
    const issues = publishIssues({ ...base, type: 'structured', body });
    expect(issues.join(' ')).toContain('Part a');
  });

  it('catches duplicate part labels', () => {
    const part = {
      id: 'p1',
      label: 'a',
      prompt: 'Do something',
      marks: 2,
      explanation: null,
      figures: [],
      body: { kind: 'essay' as const, guidance: null, rubric: null, expectedWords: null },
    };
    const body: QuestionBody = { kind: 'structured', parts: [part, { ...part, id: 'p2' }] };
    expect(publishIssues({ ...base, type: 'structured', body }).join(' ')).toContain('both labelled');
  });

  it('accepts an essay with nothing configured', () => {
    const body: QuestionBody = { kind: 'essay', guidance: null, rubric: null, expectedWords: null };
    expect(publishIssues({ ...base, type: 'essay', body })).toEqual([]);
  });
});

describe('totalPartMarks', () => {
  it('sums part marks without floating point drift', () => {
    const parts = [0.1, 0.2, 0.3].map((marks, index) => ({
      id: `p${index}`,
      label: String(index),
      prompt: 'x',
      marks,
      explanation: null,
      figures: [],
      body: { kind: 'essay' as const, guidance: null, rubric: null, expectedWords: null },
    }));
    expect(totalPartMarks(parts)).toBe(0.6);
  });
});
