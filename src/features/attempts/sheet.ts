import type { LocalizedContent } from '@/features/questions/translation';
import type { Figure, QuestionBody, SimpleQuestionBody } from '@/features/questions/types';
import type { ContentLanguage } from '@/types/database';

import { seededShuffle } from './shuffle';

/**
 * The question as a student may see it while sitting an assessment.
 *
 * This is a *whitelist*: every field below is copied in by name, and
 * nothing else is. Answer keys, accepted numerical values, tolerances,
 * rubrics, option feedback, explanations and worked solutions have no
 * field to travel in, so no future change to `QuestionBody` can leak one
 * into the browser by accident. Tests assert the same from the outside.
 */

export type SheetInput =
  | { kind: 'mcq'; options: SheetOption[] }
  | { kind: 'multi'; options: SheetOption[] }
  | { kind: 'true_false' }
  | { kind: 'numerical' }
  | { kind: 'short_answer' }
  | { kind: 'essay'; guidance: string | null; expectedWords: number | null };

export interface SheetOption {
  id: string;
  /** "A", "B", … in the order this student sees them. */
  letter: string;
  text: string;
}

export interface SheetFigure {
  id: string;
  path: string;
  alt: string;
  caption: string | null;
}

export interface SheetPart {
  id: string;
  label: string;
  prompt: string;
  marks: number;
  figures: SheetFigure[];
  input: SheetInput;
}

export interface SheetQuestion {
  attemptQuestionId: string;
  position: number;
  marks: number;
  stem: string;
  figures: SheetFigure[];
  /** The language actually shown — English when no reviewed translation exists. */
  language: ContentLanguage;
  translated: boolean;
  kind: QuestionBody['kind'];
  /** Present for every kind except structured. */
  input: SheetInput | null;
  /** Present for structured questions only. */
  parts: SheetPart[];
}

interface BuildOptions {
  attemptQuestionId: string;
  position: number;
  marks: number;
  content: LocalizedContent;
  /** Whether the assessment allows option shuffling at all. */
  shuffleOptions: boolean;
}

export function buildSheetQuestion({
  attemptQuestionId,
  position,
  marks,
  content,
  shuffleOptions,
}: BuildOptions): SheetQuestion {
  const body = content.body;
  const base = {
    attemptQuestionId,
    position,
    marks,
    stem: content.stem,
    figures: content.figures.map(copyFigure),
    language: content.language,
    translated: content.translated,
    kind: body.kind,
  };

  if (body.kind === 'structured') {
    return {
      ...base,
      input: null,
      parts: body.parts.map((part) => ({
        id: part.id,
        label: part.label,
        prompt: part.prompt,
        marks: part.marks,
        figures: part.figures.map(copyFigure),
        // Seeded by part as well, so two MCQ parts do not share one order.
        input: toInput(part.body, shuffleOptions ? `${attemptQuestionId}:${part.id}` : null),
      })),
    };
  }

  return {
    ...base,
    input: toInput(body, shuffleOptions ? attemptQuestionId : null),
    parts: [],
  };
}

function copyFigure(figure: Figure): SheetFigure {
  return { id: figure.id, path: figure.path, alt: figure.alt, caption: figure.caption };
}

function toInput(body: SimpleQuestionBody, seed: string | null): SheetInput {
  switch (body.kind) {
    case 'mcq':
    case 'multi':
      return { kind: body.kind, options: orderOptions(body.options, body.shuffleOptions ? seed : null) };
    case 'true_false':
      return { kind: 'true_false' };
    case 'numerical':
      return { kind: 'numerical' };
    case 'short_answer':
      return { kind: 'short_answer' };
    case 'essay':
      return { kind: 'essay', guidance: body.guidance, expectedWords: body.expectedWords };
  }
}

/**
 * The order a student sees the options in. Exported so the results page
 * and the teacher's review letter the options exactly as the student saw
 * them.
 */
export function orderOptions<T extends { id: string; text: string }>(
  options: T[],
  seed: string | null,
): SheetOption[] {
  const ordered = seed ? seededShuffle(options, seed) : options;
  return ordered.map((option, index) => ({
    id: option.id,
    letter: String.fromCharCode(65 + index),
    text: option.text,
  }));
}

/** The seed a given question (or part) was shuffled with, for re-deriving its order later. */
export function optionSeed(
  attemptQuestionId: string,
  partId: string | null,
  shuffleOptions: boolean,
  bodyShuffles: boolean,
): string | null {
  if (!shuffleOptions || !bodyShuffles) return null;
  return partId ? `${attemptQuestionId}:${partId}` : attemptQuestionId;
}
