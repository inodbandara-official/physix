import type { DifficultyLevel, QuestionStatus, QuestionType } from '@/types/database';

/**
 * The contract for `question_versions.body`.
 *
 * Stored as JSONB, but every write passes through `questionBodySchema`
 * first, so the column only ever holds one of the shapes below.
 */

export interface Figure {
  id: string;
  /** Object path inside the `question-figures` bucket. Never a URL: the app signs one at render time. */
  path: string;
  alt: string;
  caption: string | null;
}

export interface ChoiceOption {
  id: string;
  text: string;
  /** Shown after the attempt, when the teacher has enabled explanations. */
  feedback: string | null;
}

export type ToleranceMode = 'exact' | 'absolute' | 'relative';

/**
 * A single accepted numerical answer.
 *
 * Values are decimal *strings*, not JavaScript numbers: `0.1 + 0.2` must
 * never enter the marking path, and the number of digits a teacher typed
 * is itself meaningful when significant figures are being checked.
 */
export interface NumericalAnswer {
  id: string;
  value: string;
  tolerance: { mode: ToleranceMode; value: string };
  /** When set, the student's answer must be written to exactly this many significant figures. */
  significantFigures: number | null;
  requireUnit: boolean;
  /**
   * Units accepted verbatim, e.g. `['m s^-1', 'm/s']`. There is no implicit
   * conversion anywhere in the marking engine: if `km/h` should be accepted,
   * the teacher lists it and gives its own `value`.
   */
  acceptedUnits: string[];
  /** Marks for this alternative. `null` means the full marks of the question or part. */
  marks: number | null;
  /** Teacher-facing note, e.g. "accepts g = 10 m s^-2". Never shown to students. */
  note: string | null;
}

export interface ShortAnswerAccepted {
  id: string;
  text: string;
  caseSensitive: boolean;
}

export interface McqBody {
  kind: 'mcq';
  options: ChoiceOption[];
  correctOptionId: string | null;
  shuffleOptions: boolean;
}

export interface MultiBody {
  kind: 'multi';
  options: ChoiceOption[];
  correctOptionIds: string[];
  shuffleOptions: boolean;
  /** When true, marks scale with how many correct options were found. */
  partialCredit: boolean;
}

export interface TrueFalseBody {
  kind: 'true_false';
  correct: boolean | null;
}

export interface NumericalBody {
  kind: 'numerical';
  answers: NumericalAnswer[];
}

export interface ShortAnswerBody {
  kind: 'short_answer';
  answers: ShortAnswerAccepted[];
  /** Ignore spacing and punctuation differences when comparing. */
  normalizeWhitespace: boolean;
}

export interface EssayBody {
  kind: 'essay';
  guidance: string | null;
  rubric: string | null;
  expectedWords: number | null;
}

/** Everything a structured part may be. A part cannot itself be structured. */
export type SimpleQuestionBody =
  | McqBody
  | MultiBody
  | TrueFalseBody
  | NumericalBody
  | ShortAnswerBody
  | EssayBody;

export interface QuestionPart {
  id: string;
  /** Displayed as "(a)", "(b)" — the teacher controls the labelling. */
  label: string;
  prompt: string;
  marks: number;
  body: SimpleQuestionBody;
  explanation: string | null;
  figures: Figure[];
}

export interface StructuredBody {
  kind: 'structured';
  parts: QuestionPart[];
}

export type QuestionBody = SimpleQuestionBody | StructuredBody;

/** Maps the database enum to the body discriminant. They are kept in step by design. */
export const BODY_KIND_BY_TYPE: Record<QuestionType, QuestionBody['kind']> = {
  mcq: 'mcq',
  multi: 'multi',
  true_false: 'true_false',
  numerical: 'numerical',
  short_answer: 'short_answer',
  structured: 'structured',
  essay: 'essay',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple choice',
  multi: 'Multiple response',
  true_false: 'True / false',
  numerical: 'Numerical',
  short_answer: 'Short answer',
  structured: 'Structured',
  essay: 'Essay',
};

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  very_easy: 'Very easy',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  very_hard: 'Very hard',
};

export const DIFFICULTY_ORDER: DifficultyLevel[] = [
  'very_easy',
  'easy',
  'medium',
  'hard',
  'very_hard',
];

export const STATUS_LABELS: Record<QuestionStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

/** Types the system marks on its own. Essay is always manual; structured depends on its parts. */
export const AUTO_MARKED_KINDS = new Set<QuestionBody['kind']>([
  'mcq',
  'multi',
  'true_false',
  'numerical',
  'short_answer',
]);

export function isAutoMarked(body: QuestionBody): boolean {
  if (body.kind === 'structured') return body.parts.every((part) => AUTO_MARKED_KINDS.has(part.body.kind));
  return AUTO_MARKED_KINDS.has(body.kind);
}

/** An empty body of the requested kind, used when the editor switches type. */
export function emptyBody(kind: QuestionBody['kind']): QuestionBody {
  switch (kind) {
    case 'mcq':
      return { kind, options: [], correctOptionId: null, shuffleOptions: true };
    case 'multi':
      return { kind, options: [], correctOptionIds: [], shuffleOptions: true, partialCredit: true };
    case 'true_false':
      return { kind, correct: null };
    case 'numerical':
      return { kind, answers: [] };
    case 'short_answer':
      return { kind, answers: [], normalizeWhitespace: true };
    case 'essay':
      return { kind, guidance: null, rubric: null, expectedWords: null };
    case 'structured':
      return { kind, parts: [] };
  }
}
