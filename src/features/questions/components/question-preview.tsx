import { Check, Circle, Square } from 'lucide-react';

import { MathText } from '@/components/math-text';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { Figure, QuestionBody, SimpleQuestionBody } from '../types';

/**
 * Shows a question the way a student will see it, optionally with the
 * answer key revealed.
 *
 * Used both in the bank (teacher, `revealAnswers`) and — from Phase 3 —
 * as the read-only half of the attempt view, so what the teacher previews
 * is literally what gets sat.
 */

interface QuestionPreviewProps {
  stem: string;
  body: QuestionBody;
  marks: number;
  figures: Figure[];
  /** Storage path → signed URL. Figures without one render as a caption only. */
  figureUrls: Map<string, string>;
  revealAnswers?: boolean;
}

export function QuestionPreview({
  stem,
  body,
  marks,
  figures,
  figureUrls,
  revealAnswers = false,
}: QuestionPreviewProps) {
  return (
    <div className="space-y-4">
      <MathText className="text-[0.95rem]">{stem}</MathText>

      <FigureList figures={figures} figureUrls={figureUrls} />

      {body.kind === 'structured' ? (
        <ol className="space-y-5">
          {body.parts.map((part) => (
            <li key={part.id} className="space-y-3 border-l-2 pl-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">
                  ({part.label}){' '}
                  <span className="font-normal">
                    <MathText inline>{part.prompt}</MathText>
                  </span>
                </p>
                <Badge variant="outline" className="shrink-0 font-normal tabular-nums">
                  {part.marks}
                </Badge>
              </div>
              <FigureList figures={part.figures} figureUrls={figureUrls} />
              <AnswerArea body={part.body} revealAnswers={revealAnswers} />
              {revealAnswers && part.explanation ? (
                <p className="text-sm text-muted-foreground">
                  <MathText inline>{part.explanation}</MathText>
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <AnswerArea body={body} revealAnswers={revealAnswers} />
      )}

      <p className="text-xs text-muted-foreground">
        Total: {marks} {marks === 1 ? 'mark' : 'marks'}
      </p>
    </div>
  );
}

function FigureList({ figures, figureUrls }: { figures: Figure[]; figureUrls: Map<string, string> }) {
  if (figures.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {figures.map((figure) => {
        const url = figureUrls.get(figure.path);
        return (
          <figure key={figure.id} className="space-y-1.5">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed Storage URLs expire, so they are not a stable optimiser input
              <img
                src={url}
                alt={figure.alt}
                className="w-full rounded-lg border bg-white object-contain p-2"
                loading="lazy"
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                Figure unavailable
              </div>
            )}
            {figure.caption ? (
              <figcaption className="text-xs text-muted-foreground">{figure.caption}</figcaption>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}

function AnswerArea({ body, revealAnswers }: { body: SimpleQuestionBody; revealAnswers: boolean }) {
  switch (body.kind) {
    case 'mcq':
    case 'multi': {
      const correct = new Set(body.kind === 'mcq' ? [body.correctOptionId] : body.correctOptionIds);
      const Icon = body.kind === 'mcq' ? Circle : Square;

      return (
        <ul className="space-y-2">
          {body.options.map((option, index) => {
            const isCorrect = revealAnswers && correct.has(option.id);
            return (
              <li
                key={option.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-2 text-sm',
                  isCorrect && 'border-emerald-500/40 bg-emerald-500/8',
                )}
              >
                {isCorrect ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Correct" />
                ) : (
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="mr-2 font-medium text-muted-foreground">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  <MathText inline>{option.text}</MathText>
                  {revealAnswers && option.feedback ? (
                    <span className="mt-1 block text-xs text-muted-foreground">{option.feedback}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      );
    }

    case 'true_false':
      return (
        <ul className="flex gap-2">
          {[true, false].map((value) => (
            <li
              key={String(value)}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm',
                revealAnswers && body.correct === value && 'border-emerald-500/40 bg-emerald-500/8 font-medium',
              )}
            >
              {value ? 'True' : 'False'}
            </li>
          ))}
        </ul>
      );

    case 'numerical':
      return (
        <div className="space-y-2">
          <div className="flex max-w-xs items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Numerical answer
          </div>
          {revealAnswers ? (
            <ul className="space-y-1.5 text-sm">
              {body.answers.map((answer) => (
                <li key={answer.id} className="rounded-lg bg-muted/60 px-3 py-2">
                  <span className="font-mono font-medium">{answer.value}</span>
                  {answer.acceptedUnits.length > 0 ? (
                    <span className="font-mono text-muted-foreground"> {answer.acceptedUnits[0]}</span>
                  ) : null}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {describeAcceptance(answer)}
                  </span>
                  {answer.note ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{answer.note}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );

    case 'short_answer':
      return (
        <div className="space-y-2">
          <div className="max-w-sm rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Short answer
          </div>
          {revealAnswers && body.answers.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Accepts: {body.answers.map((answer) => answer.text).join(' · ')}
            </p>
          ) : null}
        </div>
      );

    case 'essay':
      return (
        <div className="space-y-2">
          <div className="rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
            Written answer{body.expectedWords ? ` — about ${body.expectedWords} words` : ''}
          </div>
          {revealAnswers && body.rubric ? (
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Marking guide
              </p>
              <MathText>{body.rubric}</MathText>
            </div>
          ) : null}
        </div>
      );
  }
}

function describeAcceptance(answer: {
  tolerance: { mode: string; value: string };
  significantFigures: number | null;
  requireUnit: boolean;
  acceptedUnits: string[];
}): string {
  const parts: string[] = [];

  if (answer.tolerance.mode === 'absolute') parts.push(`± ${answer.tolerance.value}`);
  else if (answer.tolerance.mode === 'relative') parts.push(`± ${Number(answer.tolerance.value) * 100}%`);
  else parts.push('exact');

  if (answer.significantFigures) parts.push(`${answer.significantFigures} s.f.`);
  if (answer.requireUnit) parts.push(`unit required (${answer.acceptedUnits.join(', ')})`);
  else if (answer.acceptedUnits.length > 0) parts.push(`units: ${answer.acceptedUnits.join(', ')}`);

  return parts.join(' · ');
}
