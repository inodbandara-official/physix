import { z } from 'zod';

import { difficultySchema, questionTypeSchema } from '@/features/questions/schema';
import { fromLocalInput } from '@/lib/time';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

/** A switch posts "on" when checked and nothing at all when not. */
const checkbox = z
  .union([z.literal('on'), z.literal('true'), z.literal('false'), z.undefined()])
  .transform((value) => value === 'on' || value === 'true');

/** `<input type="datetime-local">`, read as Colombo wall-clock time. */
const localDateTime = z
  .string()
  .optional()
  .transform((value, context) => {
    if (!value) return null;
    const iso = fromLocalInput(value);
    if (!iso) {
      context.addIssue({ code: 'custom', message: 'Enter a date and time.' });
      return z.NEVER;
    }
    return iso;
  });

const optionalInt = (min: number, max: number, message: string) =>
  z.coerce.number().int(message).min(min, message).max(max, message).optional();

export const assessmentSettingsSchema = z
  .object({
    title: z.string().trim().min(2, 'Give the assessment a title.').max(160),
    description: optionalText(4000),
    kind: z.enum(['practice', 'class_test', 'unit_test', 'term_test', 'mock_exam', 'revision', 'custom']),
    opens_at: localDateTime,
    closes_at: localDateTime,
    time_limit_minutes: optionalInt(1, 600, 'Enter a time limit between 1 and 600 minutes.'),
    max_attempts: z
      .union([z.literal('unlimited'), z.coerce.number().int().min(1).max(50)])
      .default(1)
      .transform((value) => (value === 'unlimited' ? null : value)),
    pass_percentage: z.coerce.number().min(0).max(100, 'A pass mark is a percentage, 0 to 100.').optional(),
    negative_marking: z.coerce.number().min(0).max(1).default(0),
    shuffle_questions: checkbox,
    shuffle_options: checkbox,
    show_results_immediately: checkbox,
    show_correct_answers: checkbox,
    show_explanations: checkbox,
    allow_review: checkbox,
    batch_ids: z.array(z.string().uuid()).max(50).default([]),
  })
  .superRefine((value, context) => {
    if (value.opens_at && value.closes_at && new Date(value.closes_at) <= new Date(value.opens_at)) {
      context.addIssue({ code: 'custom', path: ['closes_at'], message: 'The closing time must be after the opening time.' });
    }
  });

export const createAssessmentSchema = assessmentSettingsSchema;
export const updateAssessmentSchema = z.intersection(
  assessmentSettingsSchema,
  z.object({ id: z.string().uuid() }),
);

export type AssessmentSettingsInput = z.infer<typeof assessmentSettingsSchema>;

export const randomRuleSchema = z.object({
  assessment_id: z.string().uuid(),
  item_id: z.string().uuid().optional(),
  pick_count: z.coerce.number().int().min(1, 'Draw at least one question.').max(100),
  syllabus_node_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  difficulties: z.array(difficultySchema).max(5).default([]),
  question_types: z.array(questionTypeSchema).max(7).default([]),
  marks: z.coerce.number().min(0.5).max(999).optional(),
});

export type RandomRuleInput = z.infer<typeof randomRuleSchema>;

export const addQuestionsSchema = z.object({
  assessment_id: z.string().uuid(),
  question_ids: z.array(z.string().uuid()).min(1, 'Select at least one question.').max(100),
});

export const manualMarkSchema = z.object({
  attempt_question_id: z.string().uuid(),
  marks: z.coerce.number().min(-999).max(999).optional(),
  /** Structured questions are marked per part; the question total is their sum. */
  part_marks: z.record(z.string(), z.coerce.number().min(0).max(999)).optional(),
  teacher_comment: optionalText(2000),
});
