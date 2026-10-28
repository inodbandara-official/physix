import type { AssessmentKind, RankingBasis } from '@/types/database';

/**
 * The ranking engine.
 *
 * Deliberately plain arithmetic, so the rule can be printed on the
 * rankings page and checked by hand (§22: "do not use an opaque ranking
 * algorithm"). Pure, so every case the brief lists — ordering, ties,
 * weights, missing assessments, separate batches — is unit-tested.
 *
 * What counts
 * -----------
 * - Each student's **best finished attempt** at each assessment. Unlimited
 *   retries can therefore raise a score but never lower it.
 * - Only assessment kinds with a weight above 0. Practice is 0 by default.
 * - Only results the student can already see; a held-back result cannot
 *   leak through a rank. The caller filters for that.
 * - Optionally, a **missed** assessment — closed, set for the student's
 *   batch while they were in it, never sat — as 0%.
 *
 * The bases
 * ---------
 * - average:  mean of the counted percentages.
 * - total:    sum of marks scored.
 * - weighted: the mean percentage within each kind, combined by the kind
 *             weights. A kind the student has no result in is left out and
 *             the remaining weights rescaled, so a batch that has not sat a
 *             term test yet is not ranked on an empty one.
 * - recent:   mean of the most recent N counted assessments.
 *
 * Ties share a rank and the next rank is skipped (1, 2, 2, 4), compared at
 * the one decimal place that is displayed — two students shown as 87.1
 * never appear ranked apart.
 */

export interface RankingConfig {
  basis: RankingBasis;
  recentCount: number;
  weights: Partial<Record<AssessmentKind, number>>;
  missedCountsZero: boolean;
}

export interface RankAssessment {
  id: string;
  kind: AssessmentKind;
  /** The date that orders assessments for "recent": close, else publication. */
  date: string;
  closed: boolean;
}

export interface RankResult {
  studentId: string;
  assessmentId: string;
  percentage: number;
  score: number;
}

export interface RankingInput {
  studentIds: string[];
  assessments: RankAssessment[];
  results: RankResult[];
  /** Was this assessment set for this student (their batch, while a member)? Drives "missed". */
  wasSetFor: (studentId: string, assessmentId: string) => boolean;
}

export interface RankingRow {
  studentId: string;
  /** Null when the student has nothing that counts yet. */
  rank: number | null;
  score: number | null;
  counted: number;
  missed: number;
  /** Points needed to reach the next distinct score above; null for first place or unranked. */
  gapToNext: number | null;
}

export const DEFAULT_WEIGHTS: Record<AssessmentKind, number> = {
  practice: 0,
  class_test: 20,
  unit_test: 30,
  term_test: 50,
  mock_exam: 50,
  revision: 20,
  custom: 20,
};

const round1 = (value: number) => Math.round(value * 10) / 10;

interface Counted {
  assessment: RankAssessment;
  percentage: number;
  score: number;
  missed: boolean;
}

export function computeRanking(input: RankingInput, config: RankingConfig): RankingRow[] {
  const weightOf = (kind: AssessmentKind) => Math.max(0, config.weights[kind] ?? DEFAULT_WEIGHTS[kind] ?? 0);
  const assessments = input.assessments.filter((assessment) => weightOf(assessment.kind) > 0);

  // Best result per student per assessment.
  const best = new Map<string, RankResult>();
  for (const result of input.results) {
    const key = `${result.studentId}:${result.assessmentId}`;
    const current = best.get(key);
    if (!current || result.percentage > current.percentage) best.set(key, result);
  }

  const scored = input.studentIds.map((studentId) => {
    const counted: Counted[] = [];
    for (const assessment of assessments) {
      const result = best.get(`${studentId}:${assessment.id}`);
      if (result) {
        counted.push({ assessment, percentage: result.percentage, score: result.score, missed: false });
      } else if (config.missedCountsZero && assessment.closed && input.wasSetFor(studentId, assessment.id)) {
        counted.push({ assessment, percentage: 0, score: 0, missed: true });
      }
    }

    return {
      studentId,
      score: counted.length > 0 ? round1(scoreFor(counted, config, weightOf)) : null,
      counted: counted.length,
      missed: counted.filter((item) => item.missed).length,
    };
  });

  const ranked = scored
    .filter((row): row is typeof row & { score: number } => row.score !== null)
    .sort((a, b) => b.score - a.score);

  const rows: RankingRow[] = [];
  let previousScore: number | null = null;
  let previousRank = 0;
  ranked.forEach((row, index) => {
    const rank: number = previousScore !== null && row.score === previousScore ? previousRank : index + 1;
    previousScore = row.score;
    previousRank = rank;
    rows.push({ ...row, rank, gapToNext: rank === 1 ? null : round1(nextHigherScore(ranked, row.score) - row.score) });
  });

  for (const row of scored) {
    if (row.score === null) rows.push({ ...row, rank: null, gapToNext: null });
  }
  return rows;
}

/** The lowest score strictly above `score` — the next position up. */
function nextHigherScore(list: { score: number }[], score: number): number {
  let next = Infinity;
  for (const row of list) if (row.score > score && row.score < next) next = row.score;
  return next;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreFor(counted: Counted[], config: RankingConfig, weightOf: (kind: AssessmentKind) => number): number {
  switch (config.basis) {
    case 'average':
      return mean(counted.map((item) => item.percentage));

    case 'total':
      return counted.reduce((sum, item) => sum + item.score, 0);

    case 'weighted': {
      const byKind = new Map<AssessmentKind, number[]>();
      for (const item of counted) {
        byKind.set(item.assessment.kind, [...(byKind.get(item.assessment.kind) ?? []), item.percentage]);
      }
      let weighted = 0;
      let totalWeight = 0;
      for (const [kind, values] of byKind) {
        const weight = weightOf(kind);
        weighted += weight * mean(values);
        totalWeight += weight;
      }
      return totalWeight > 0 ? weighted / totalWeight : 0;
    }

    case 'recent': {
      const recent = [...counted]
        .sort((a, b) => new Date(b.assessment.date).getTime() - new Date(a.assessment.date).getTime())
        .slice(0, Math.max(1, config.recentCount));
      return mean(recent.map((item) => item.percentage));
    }
  }
}

/** One sentence describing the active rule, printed above every ranking. */
export function describeBasis(config: RankingConfig): string {
  const missed = config.missedCountsZero
    ? ' A closed test that was set but not sat counts as 0%.'
    : ' Tests not sat are left out.';
  switch (config.basis) {
    case 'average':
      return `Average of each student’s best percentage per test.${missed}`;
    case 'total':
      return `Total marks scored across all counted tests, best attempt each.${missed}`;
    case 'weighted':
      return `Average percentage per test type, combined by the type weights.${missed}`;
    case 'recent':
      return `Average of the ${config.recentCount} most recent counted tests.${missed}`;
  }
}
