import { describe, expect, it } from 'vitest';

import { computeRanking, DEFAULT_WEIGHTS, type RankAssessment, type RankingConfig, type RankResult } from './engine';

const config = (overrides: Partial<RankingConfig> = {}): RankingConfig => ({
  basis: 'average',
  recentCount: 5,
  weights: DEFAULT_WEIGHTS,
  missedCountsZero: false,
  ...overrides,
});

const assessment = (id: string, kind: RankAssessment['kind'] = 'class_test', date = '2026-01-01', closed = true): RankAssessment => ({
  id,
  kind,
  date,
  closed,
});

const result = (studentId: string, assessmentId: string, percentage: number, score = percentage): RankResult => ({
  studentId,
  assessmentId,
  percentage,
  score,
});

const always = () => true;

function ranks(rows: ReturnType<typeof computeRanking>) {
  return Object.fromEntries(rows.map((row) => [row.studentId, row.rank]));
}

describe('computeRanking — ordering', () => {
  it('ranks by average, highest first', () => {
    const rows = computeRanking(
      {
        studentIds: ['a', 'b', 'c'],
        assessments: [assessment('t1'), assessment('t2')],
        results: [result('a', 't1', 60), result('a', 't2', 80), result('b', 't1', 90), result('c', 't1', 50)],
        wasSetFor: always,
      },
      config(),
    );
    expect(rows.map((row) => row.studentId)).toEqual(['b', 'a', 'c']);
    expect(rows[1].score).toBe(70);
  });

  it('uses the best attempt per assessment', () => {
    const rows = computeRanking(
      {
        studentIds: ['a'],
        assessments: [assessment('t1')],
        results: [result('a', 't1', 40), result('a', 't1', 75)],
        wasSetFor: always,
      },
      config(),
    );
    expect(rows[0].score).toBe(75);
  });
});

describe('computeRanking — ties', () => {
  it('gives equal scores the same rank and skips the next', () => {
    const rows = computeRanking(
      {
        studentIds: ['a', 'b', 'c', 'd'],
        assessments: [assessment('t1')],
        results: [result('a', 't1', 90), result('b', 't1', 80), result('c', 't1', 80), result('d', 't1', 70)],
        wasSetFor: always,
      },
      config(),
    );
    expect(ranks(rows)).toEqual({ a: 1, b: 2, c: 2, d: 4 });
  });

  it('ties at the displayed precision', () => {
    const rows = computeRanking(
      {
        studentIds: ['a', 'b'],
        assessments: [assessment('t1'), assessment('t2'), assessment('t3')],
        // 87.13 and 87.10 both display as 87.1.
        results: [
          result('a', 't1', 87.13), result('a', 't2', 87.13), result('a', 't3', 87.13),
          result('b', 't1', 87.1), result('b', 't2', 87.1), result('b', 't3', 87.1),
        ],
        wasSetFor: always,
      },
      config(),
    );
    expect(ranks(rows)).toEqual({ a: 1, b: 1 });
  });

  it('reports the gap to the next distinct score above', () => {
    const rows = computeRanking(
      {
        studentIds: ['a', 'b', 'c'],
        assessments: [assessment('t1')],
        results: [result('a', 't1', 90), result('b', 't1', 90), result('c', 't1', 87.2)],
        wasSetFor: always,
      },
      config(),
    );
    const c = rows.find((row) => row.studentId === 'c')!;
    expect(c.rank).toBe(3);
    expect(c.gapToNext).toBe(2.8);
    expect(rows.find((row) => row.studentId === 'a')!.gapToNext).toBeNull();
  });
});

describe('computeRanking — missing assessments', () => {
  const input = {
    studentIds: ['diligent', 'skipper'],
    assessments: [assessment('easy'), assessment('hard')],
    results: [result('diligent', 'easy', 90), result('diligent', 'hard', 50), result('skipper', 'easy', 90)],
    wasSetFor: always,
  };

  it('can leave missed tests out', () => {
    const rows = computeRanking(input, config({ missedCountsZero: false }));
    expect(rows[0].studentId).toBe('skipper');
  });

  it('counts a missed closed test as zero when configured', () => {
    const rows = computeRanking(input, config({ missedCountsZero: true }));
    expect(rows[0].studentId).toBe('diligent');
    expect(rows.find((row) => row.studentId === 'skipper')).toMatchObject({ score: 45, missed: 1 });
  });

  it('never counts a test that is still open as missed', () => {
    const rows = computeRanking(
      { ...input, assessments: [assessment('easy'), assessment('hard', 'class_test', '2026-01-02', false)] },
      config({ missedCountsZero: true }),
    );
    expect(rows.find((row) => row.studentId === 'skipper')!.score).toBe(90);
  });

  it('never counts a test that was not set for the student', () => {
    const rows = computeRanking(
      { ...input, wasSetFor: (studentId, assessmentId) => !(studentId === 'skipper' && assessmentId === 'hard') },
      config({ missedCountsZero: true }),
    );
    expect(rows.find((row) => row.studentId === 'skipper')!.score).toBe(90);
  });

  it('leaves a student with nothing counted unranked', () => {
    const rows = computeRanking(
      { studentIds: ['a', 'new'], assessments: [assessment('t1')], results: [result('a', 't1', 50)], wasSetFor: () => false },
      config({ missedCountsZero: true }),
    );
    expect(rows.find((row) => row.studentId === 'new')).toMatchObject({ rank: null, score: null });
  });
});

describe('computeRanking — weighting', () => {
  it('combines kind averages by weight', () => {
    const rows = computeRanking(
      {
        studentIds: ['a'],
        assessments: [assessment('quiz', 'class_test'), assessment('unit', 'unit_test'), assessment('term', 'term_test')],
        results: [result('a', 'quiz', 100), result('a', 'unit', 50), result('a', 'term', 80)],
        wasSetFor: always,
      },
      config({ basis: 'weighted', weights: { class_test: 20, unit_test: 30, term_test: 50 } }),
    );
    // (20×100 + 30×50 + 50×80) / 100 = 75
    expect(rows[0].score).toBe(75);
  });

  it('rescales over the kinds a student actually has', () => {
    const rows = computeRanking(
      {
        studentIds: ['a'],
        assessments: [assessment('quiz', 'class_test'), assessment('term', 'term_test')],
        results: [result('a', 'quiz', 60)],
        wasSetFor: always,
      },
      config({ basis: 'weighted', weights: { class_test: 20, term_test: 50 } }),
    );
    expect(rows[0].score).toBe(60);
  });

  it('ignores kinds weighted zero — practice by default', () => {
    const rows = computeRanking(
      {
        studentIds: ['a'],
        assessments: [assessment('drill', 'practice'), assessment('test', 'class_test')],
        results: [result('a', 'drill', 100), result('a', 'test', 40)],
        wasSetFor: always,
      },
      config(),
    );
    expect(rows[0]).toMatchObject({ score: 40, counted: 1 });
  });
});

describe('computeRanking — other bases', () => {
  it('totals marks', () => {
    const rows = computeRanking(
      {
        studentIds: ['a'],
        assessments: [assessment('t1'), assessment('t2')],
        results: [result('a', 't1', 50, 10), result('a', 't2', 100, 25)],
        wasSetFor: always,
      },
      config({ basis: 'total' }),
    );
    expect(rows[0].score).toBe(35);
  });

  it('averages only the most recent tests', () => {
    const rows = computeRanking(
      {
        studentIds: ['a'],
        assessments: [
          assessment('old', 'class_test', '2026-01-01'),
          assessment('mid', 'class_test', '2026-02-01'),
          assessment('new', 'class_test', '2026-03-01'),
        ],
        results: [result('a', 'old', 10), result('a', 'mid', 60), result('a', 'new', 80)],
        wasSetFor: always,
      },
      config({ basis: 'recent', recentCount: 2 }),
    );
    expect(rows[0].score).toBe(70);
  });
});

describe('computeRanking — separate batches', () => {
  it('ranks only the students it is given', () => {
    // The caller ranks one batch at a time; another batch's results are inert.
    const rows = computeRanking(
      {
        studentIds: ['a', 'b'],
        assessments: [assessment('t1')],
        results: [result('a', 't1', 50), result('b', 't1', 60), result('outsider', 't1', 99)],
        wasSetFor: always,
      },
      config(),
    );
    expect(rows.map((row) => row.studentId)).toEqual(['b', 'a']);
    expect(rows[0].rank).toBe(1);
  });
});
