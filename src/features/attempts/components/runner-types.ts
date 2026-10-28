import type { ReactNode } from 'react';

import type { QuestionBody } from '@/features/questions/types';
import type { ContentLanguage } from '@/types/database';

import type { RunnerAnswer } from '../queries';

/**
 * What the test screen receives. Text arrives *already rendered* — the
 * server turns LaTeX into KaTeX markup — so the browser gets neither the
 * KaTeX library nor any field a renderer could accidentally reveal. Built
 * from `SheetQuestion`, which carries no answer data to begin with.
 */

export type RunnerInput =
  | { kind: 'mcq' | 'multi'; options: { id: string; letter: string; content: ReactNode }[] }
  | { kind: 'true_false' }
  | { kind: 'numerical' }
  | { kind: 'short_answer' }
  | { kind: 'essay'; guidance: ReactNode | null; expectedWords: number | null };

export interface RunnerPart {
  id: string;
  label: string;
  marks: number;
  prompt: ReactNode;
  figures: ReactNode;
  input: RunnerInput;
}

export interface RunnerQuestion {
  id: string;
  number: number;
  marks: number;
  kind: QuestionBody['kind'];
  /** False when the reader asked for Sinhala and only English exists. */
  showingFallback: boolean;
  stem: ReactNode;
  figures: ReactNode;
  input: RunnerInput | null;
  parts: RunnerPart[];
}

export interface RunnerProps {
  attemptId: string;
  assessmentId: string;
  title: string;
  /** Where "Leave" goes. */
  exitHref: string;
  attemptNumber: number;
  deadlineAt: string | null;
  serverNow: string;
  negativeMarking: boolean;
  language: ContentLanguage;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, RunnerAnswer>;
  languageToggle: ReactNode;
}
