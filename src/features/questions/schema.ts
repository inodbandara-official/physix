import { z } from 'zod';

import type { QuestionBody, QuestionPart, SimpleQuestionBody } from './types';

/**
 * Validation for the question bank.
 *
 * Two layers, on purpose:
 *
 * - `questionBodySchema` checks *shape*. It is permissive about
 *   completeness so a teacher can save a half-written question as a draft
 *   and come back to it.
 * - `publishIssues()` checks *readiness*. A question cannot be published
 *   until it would actually mark correctly.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

/** A decimal literal, optionally in scientific notation. Stored as a string. */
export const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

const decimalString = z
  .string()
  .trim()
  .regex(DECIMAL_PATTERN, 'Enter a number, for example 9.81 or 1.6e-19');

const id = z.string().min(1).max(64);

export const figureSchema = z.object({
  id,
  path: z.string().min(1).max(400),
  alt: z.string().trim().max(200),
  caption: z.string().trim().max(300).nullable().default(null),
});

export const choiceOptionSchema = z.object({
  id,
  text: z.string().trim().min(1, 'An option cannot be empty.').max(2000),
  feedback: z.string().trim().max(1000).nullable().default(null),
});

export const numericalAnswerSchema = z.object({
  id,
  value: decimalString,
  tolerance: z.object({
    mode: z.enum(['exact', 'absolute', 'relative']),
    value: z
      .string()
      .trim()
      .regex(/^\d*\.?\d*(?:[eE][+-]?\d+)?$/, 'Tolerance must be a positive number.')
      .default('0'),
  }),
  significantFigures: z.coerce.number().int().min(1).max(10).nullable().default(null),
  requireUnit: z.boolean().default(false),
  acceptedUnits: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  marks: z.coerce.number().min(0).max(999).nullable().default(null),
  note: z.string().trim().max(300).nullable().default(null),
});

export const shortAnswerAcceptedSchema = z.object({
  id,
  text: z.string().trim().min(1, 'An accepted answer cannot be empty.').max(500),
  caseSensitive: z.boolean().default(false),
});

const mcqBodySchema = z.object({
  kind: z.literal('mcq'),
  options: z.array(choiceOptionSchema).max(12),
  correctOptionId: z.string().nullable().default(null),
  shuffleOptions: z.boolean().default(true),
});

const multiBodySchema = z.object({
  kind: z.literal('multi'),
  options: z.array(choiceOptionSchema).max(12),
  correctOptionIds: z.array(z.string()).max(12).default([]),
  shuffleOptions: z.boolean().default(true),
  partialCredit: z.boolean().default(true),
});

const trueFalseBodySchema = z.object({
  kind: z.literal('true_false'),
  correct: z.boolean().nullable().default(null),
});

const numericalBodySchema = z.object({
  kind: z.literal('numerical'),
  answers: z.array(numericalAnswerSchema).max(10),
});

const shortAnswerBodySchema = z.object({
  kind: z.literal('short_answer'),
  answers: z.array(shortAnswerAcceptedSchema).max(20),
  normalizeWhitespace: z.boolean().default(true),
});

const essayBodySchema = z.object({
  kind: z.literal('essay'),
  guidance: z.string().trim().max(2000).nullable().default(null),
  rubric: z.string().trim().max(4000).nullable().default(null),
  expectedWords: z.coerce.number().int().min(10).max(5000).nullable().default(null),
});

export const simpleBodySchema = z.discriminatedUnion('kind', [
  mcqBodySchema,
  multiBodySchema,
  trueFalseBodySchema,
  numericalBodySchema,
  shortAnswerBodySchema,
  essayBodySchema,
]);

export const questionPartSchema = z.object({
  id,
  label: z.string().trim().min(1, 'Give the part a label, e.g. a.').max(8),
  prompt: z.string().trim().min(1, 'A part needs a prompt.').max(4000),
  marks: z.coerce.number().min(0.5, 'A part must be worth at least 0.5 marks.').max(999),
  body: simpleBodySchema,
  explanation: z.string().trim().max(4000).nullable().default(null),
  figures: z.array(figureSchema).max(6).default([]),
});

const structuredBodySchema = z.object({
  kind: z.literal('structured'),
  parts: z.array(questionPartSchema).max(20),
});

export const questionBodySchema: z.ZodType<QuestionBody> = z.discriminatedUnion('kind', [
  mcqBodySchema,
  multiBodySchema,
  trueFalseBodySchema,
  numericalBodySchema,
  shortAnswerBodySchema,
  essayBodySchema,
  structuredBodySchema,
]);

export const questionTypeSchema = z.enum([
  'mcq',
  'multi',
  'true_false',
  'numerical',
  'short_answer',
  'structured',
  'essay',
]);

export const difficultySchema = z.enum(['very_easy', 'easy', 'medium', 'hard', 'very_hard']);
export const questionStatusSchema = z.enum(['draft', 'published', 'archived']);

export const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** The editor's payload. `body` arrives as JSON because it is deeply nested. */
export const questionInputSchema = z.object({
  question_code: z
    .string()
    .trim()
    .min(2, 'Give the question an ID.')
    .max(32)
    .regex(/^[A-Za-z0-9/-]+$/, 'Use letters, numbers, hyphens and slashes only.'),
  title: z.string().trim().max(160).default(''),
  type: questionTypeSchema,
  stem: z.string().trim().min(1, 'Write the question.').max(20000),
  body: questionBodySchema,
  marks: z.coerce.number().min(0.5, 'A question must be worth at least 0.5 marks.').max(999),
  difficulty: difficultySchema.default('medium'),
  estimated_seconds: z.coerce.number().int().min(5).max(7200).optional(),
  syllabus_node_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  source: optionalText(120),
  source_year: z.coerce.number().int().min(1950).max(2100).optional(),
  paper_reference: optionalText(80),
  explanation: optionalText(8000),
  solution: optionalText(12000),
  common_mistake: optionalText(2000),
  hint: optionalText(1000),
  teacher_notes: optionalText(4000),
  figures: z.array(figureSchema).max(8).default([]),
  tags: z
    .array(z.string().trim().toLowerCase().regex(TAG_PATTERN, 'Tags use lowercase letters, numbers and hyphens.'))
    .max(20)
    .default([]),
});

export const createQuestionSchema = questionInputSchema;
export const updateQuestionSchema = questionInputSchema.extend({ id: z.string().uuid() });

export const questionFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  unit: z.string().uuid().optional(),
  node: z.string().uuid().optional(),
  type: questionTypeSchema.optional(),
  difficulty: difficultySchema.optional(),
  status: questionStatusSchema.optional(),
  tag: z.string().trim().max(40).optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional(),
  archived: z.enum(['active', 'archived', 'all']).default('active'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(100).default(25),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;
export type QuestionFilters = z.infer<typeof questionFiltersSchema>;

/**
 * Everything standing between a draft and publication.
 *
 * Returns messages a teacher can act on, rather than a boolean, because
 * "this question is not ready" is useless without saying why. A published
 * question must be able to mark a student's answer — that is the bar.
 */
export function publishIssues(input: {
  type: QuestionInput['type'];
  stem: string;
  marks: number;
  body: QuestionBody;
  syllabus_node_id?: string;
}): string[] {
  const issues: string[] = [];

  if (input.stem.trim().length < 10) {
    issues.push('The question text is too short to publish.');
  }
  if (!input.syllabus_node_id) {
    issues.push('Choose a syllabus topic, so the question can be found and counted in analytics.');
  }
  if (input.marks <= 0) {
    issues.push('Set the marks this question is worth.');
  }

  issues.push(...bodyIssues(input.body, ''));

  return issues;
}

function bodyIssues(body: QuestionBody, prefix: string): string[] {
  const issues: string[] = [];
  const label = prefix ? `${prefix}: ` : '';

  switch (body.kind) {
    case 'mcq': {
      if (body.options.length < 2) issues.push(`${label}Add at least two options.`);
      if (!body.correctOptionId) issues.push(`${label}Mark which option is correct.`);
      else if (!body.options.some((option) => option.id === body.correctOptionId)) {
        issues.push(`${label}The correct option no longer exists.`);
      }
      break;
    }

    case 'multi': {
      if (body.options.length < 2) issues.push(`${label}Add at least two options.`);
      if (body.correctOptionIds.length === 0) issues.push(`${label}Mark at least one option as correct.`);
      if (body.correctOptionIds.length === body.options.length && body.options.length > 0) {
        issues.push(`${label}Every option is marked correct, so the question cannot discriminate.`);
      }
      break;
    }

    case 'true_false': {
      if (body.correct === null) issues.push(`${label}Choose whether the statement is true or false.`);
      break;
    }

    case 'numerical': {
      if (body.answers.length === 0) issues.push(`${label}Add the accepted answer.`);
      for (const answer of body.answers) {
        if (!DECIMAL_PATTERN.test(answer.value)) {
          issues.push(`${label}"${answer.value}" is not a valid number.`);
        }
        if (answer.tolerance.mode !== 'exact' && Number(answer.tolerance.value) <= 0) {
          issues.push(`${label}A ${answer.tolerance.mode} tolerance needs a value above zero.`);
        }
        if (answer.requireUnit && answer.acceptedUnits.length === 0) {
          issues.push(`${label}A unit is required, so list the units that are accepted.`);
        }
      }
      break;
    }

    case 'short_answer': {
      if (body.answers.length === 0) {
        issues.push(`${label}Add at least one accepted answer, or use an essay question for manual marking.`);
      }
      break;
    }

    case 'essay':
      // Nothing to check: an essay is marked by hand by definition.
      break;

    case 'structured': {
      if (body.parts.length === 0) {
        issues.push('Add at least one part.');
        break;
      }
      const labels = new Set<string>();
      for (const part of body.parts) {
        if (labels.has(part.label.toLowerCase())) {
          issues.push(`Two parts are both labelled "${part.label}".`);
        }
        labels.add(part.label.toLowerCase());
        issues.push(...bodyIssues(part.body, `Part ${part.label}`));
      }
      break;
    }
  }

  return issues;
}

/** Structured questions are worth the sum of their parts; the editor keeps them in step. */
export function totalPartMarks(parts: QuestionPart[]): number {
  return Math.round(parts.reduce((sum, part) => sum + part.marks, 0) * 100) / 100;
}

export function effectiveMarks(body: QuestionBody, declaredMarks: number): number {
  return body.kind === 'structured' && body.parts.length > 0 ? totalPartMarks(body.parts) : declaredMarks;
}

/** Narrowing helper for the editor, which handles simple and structured bodies differently. */
export function isSimpleBody(body: QuestionBody): body is SimpleQuestionBody {
  return body.kind !== 'structured';
}
