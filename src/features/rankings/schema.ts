import { z } from 'zod';

const weight = z.coerce.number().int('Use whole numbers.').min(0).max(100);

export const rankingSettingsSchema = z.object({
  basis: z.enum(['average', 'total', 'weighted', 'recent']),
  recent_count: z.coerce.number().int().min(1, 'At least one test.').max(50).default(5),
  missed_counts_zero: z
    .union([z.literal('on'), z.undefined()])
    .transform((value) => value === 'on'),
  student_visibility: z.enum(['private', 'anonymous', 'batch']),
  weight_practice: weight,
  weight_class_test: weight,
  weight_unit_test: weight,
  weight_term_test: weight,
  weight_mock_exam: weight,
  weight_revision: weight,
  weight_custom: weight,
});

export type RankingSettingsInput = z.infer<typeof rankingSettingsSchema>;

export const RANKING_PERIODS = {
  all: { label: 'All time', days: null },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 3 months', days: 90 },
  '365d': { label: 'Last 12 months', days: 365 },
} as const;

export type RankingPeriod = keyof typeof RANKING_PERIODS;

export function periodSince(period: RankingPeriod): string | null {
  const days = RANKING_PERIODS[period].days;
  return days === null ? null : new Date(Date.now() - days * 86_400_000).toISOString();
}

export const BASIS_LABELS = {
  average: 'Average percentage',
  total: 'Total marks',
  weighted: 'Weighted by test type',
  recent: 'Recent performance',
} as const;

export const VISIBILITY_LABELS = {
  private: 'Private — each student sees only their own rank',
  anonymous: 'Anonymous — students see positions and scores, no names',
  batch: 'Within batch — students see classmates’ first names',
} as const;
