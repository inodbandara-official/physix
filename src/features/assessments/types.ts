import type { AssessmentKind, AttemptStatus } from '@/types/database';

export const ASSESSMENT_KIND_LABELS: Record<AssessmentKind, string> = {
  practice: 'Practice quiz',
  class_test: 'Class test',
  unit_test: 'Unit test',
  term_test: 'Term test',
  mock_exam: 'Mock exam',
  revision: 'Revision test',
  custom: 'Custom',
};

export const ASSESSMENT_KIND_ORDER: AssessmentKind[] = [
  'class_test',
  'practice',
  'unit_test',
  'term_test',
  'mock_exam',
  'revision',
  'custom',
];

export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  in_progress: 'In progress',
  submitted: 'Awaiting marking',
  graded: 'Marked',
};

/** The fractions offered for negative marking. Anything finer is not how A/L papers work. */
export const NEGATIVE_MARKING_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'Off' },
  { value: '0.25', label: '¼ of the question’s marks' },
  { value: '0.333', label: '⅓ of the question’s marks' },
  { value: '0.5', label: '½ of the question’s marks' },
  { value: '1', label: 'The question’s full marks' },
];

export const MAX_ATTEMPT_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 attempt' },
  { value: '2', label: '2 attempts' },
  { value: '3', label: '3 attempts' },
  { value: '5', label: '5 attempts' },
  { value: 'unlimited', label: 'Unlimited' },
];
