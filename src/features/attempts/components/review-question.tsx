import type { ReactNode } from 'react';
import { Check, Clock, Minus, X } from 'lucide-react';

import { MathText } from '@/components/math-text';
import { Badge } from '@/components/ui/badge';
import { t, tf } from '@/features/language/labels';
import type { SimpleResponse } from '@/features/questions/marking/mark-question';
import type { SimpleQuestionBody } from '@/features/questions/types';
import { cn } from '@/lib/utils';
import type { ContentLanguage } from '@/types/database';

import type { ReviewItem } from '../queries';
import type { StoredPartResults } from '../scoring';
import { optionSeed, orderOptions } from '../sheet';
import { Figures } from './figures';

interface ReviewQuestionProps {
  item: ReviewItem;
  number: number;
  language: ContentLanguage;
  /** Show the correct option / accepted value. */
  revealAnswers: boolean;
  /** Show explanations, worked solutions, option feedback. */
  revealExplanations: boolean;
  shuffleOptions: boolean;
  figureUrls: Map<string, string>;
  /** Teacher view: rubric and marking detail. */
  teacher?: boolean;
  /** Teacher view: the manual-marking form, rendered under the question. */
  children?: ReactNode;
}

/**
 * One question of a finished attempt, as the student answered it.
 *
 * A server component: whatever it leaves out — the answer key when the
 * teacher has hidden it, the explanations — is never sent to the browser
 * at all, rather than sent and hidden.
 */
export function ReviewQuestion({
  item,
  number,
  language,
  revealAnswers,
  revealExplanations,
  shuffleOptions,
  figureUrls,
  teacher = false,
  children,
}: ReviewQuestionProps) {
  const { content } = item;
  const body = content.body;
  const response = item.response;

  return (
    <article
      id={`q-${number}`}
      className="scroll-mt-20 space-y-4 rounded-xl border bg-background p-5 sm:p-6"
      lang={teacher ? undefined : content.language}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {tf('questionN', teacher ? 'en' : language, { n: number })}
        </h3>
        <div className="flex items-center gap-2">
          <OutcomeBadge item={item} language={language} />
          <Badge variant="outline" className="font-normal tabular-nums">
            {item.awaitingTeacher ? '— ' : `${item.marksAwarded ?? 0} `}/ {item.maxMarks}
          </Badge>
        </div>
      </header>

      <MathText className="text-[0.95rem]">{content.stem}</MathText>
      <Figures figures={content.figures} urls={figureUrls} />

      {body.kind === 'structured' ? (
        <ol className="space-y-5">
          {body.parts.map((part) => {
            const partResponse = response?.kind === 'structured' ? (response.parts[part.id] ?? null) : null;
            const partResult = item.partResults?.[part.id];
            return (
              <li key={part.id} className="space-y-3 border-l-2 pl-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">
                    ({part.label}){' '}
                    <span className="font-normal">
                      <MathText inline>{part.prompt}</MathText>
                    </span>
                  </p>
                  <PartScore result={partResult} max={part.marks} />
                </div>
                <Figures figures={part.figures} urls={figureUrls} />
                <ResponseView
                  body={part.body}
                  response={partResponse}
                  seed={optionSeed(item.attemptQuestionId, part.id, shuffleOptions, shuffles(part.body))}
                  language={language}
                  revealAnswers={revealAnswers}
                  revealExplanations={revealExplanations}
                  teacher={teacher}
                />
                {teacher && partResult ? <p className="text-xs text-muted-foreground">{partResult.detail}</p> : null}
                {revealExplanations && part.explanation ? (
                  <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    <MathText>{part.explanation}</MathText>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <ResponseView
          body={body}
          response={response && response.kind !== 'structured' ? response : null}
          seed={optionSeed(item.attemptQuestionId, null, shuffleOptions, shuffles(body))}
          language={language}
          revealAnswers={revealAnswers}
          revealExplanations={revealExplanations}
          teacher={teacher}
        />
      )}

      {item.feedback && (teacher || !item.awaitingTeacher) ? (
        <p className="text-sm text-muted-foreground">{item.feedback}</p>
      ) : null}

      {item.teacherComment ? (
        <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-3 py-2 text-sm">
          <p className="mb-0.5 text-xs font-medium text-primary">{teacher ? 'Your comment' : t('teacherComment', language)}</p>
          <p className="whitespace-pre-wrap">{item.teacherComment}</p>
        </div>
      ) : null}

      {revealExplanations ? <Explanations item={item} language={language} teacher={teacher} /> : null}

      {children}
    </article>
  );
}

function shuffles(body: SimpleQuestionBody): boolean {
  return (body.kind === 'mcq' || body.kind === 'multi') && body.shuffleOptions;
}

function OutcomeBadge({ item, language }: { item: ReviewItem; language: ContentLanguage }) {
  if (item.awaitingTeacher) {
    return (
      <Badge variant="secondary" className="gap-1 font-normal">
        <Clock className="size-3" aria-hidden />
        {t('waitingForTeacher', language)}
      </Badge>
    );
  }

  const marks = item.marksAwarded ?? 0;
  if (marks >= item.maxMarks) {
    return (
      <Badge className="gap-1 bg-emerald-600 font-normal text-white hover:bg-emerald-600">
        <Check className="size-3" aria-hidden />
        {t('correct', language)}
      </Badge>
    );
  }
  if (marks > 0) {
    return (
      <Badge variant="secondary" className="gap-1 font-normal">
        <Minus className="size-3" aria-hidden />
        {t('partlyCorrect', language)}
      </Badge>
    );
  }
  if (!item.response) {
    return (
      <Badge variant="outline" className="font-normal">
        {t('notAnswered', language)}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1 font-normal">
      <X className="size-3" aria-hidden />
      {t('incorrect', language)}
    </Badge>
  );
}

function PartScore({ result, max }: { result: StoredPartResults[string] | undefined; max: number }) {
  return (
    <Badge variant="outline" className="shrink-0 font-normal tabular-nums">
      {result && !result.requiresManual ? result.marks : '—'} / {max}
    </Badge>
  );
}

function ResponseView({
  body,
  response,
  seed,
  language,
  revealAnswers,
  revealExplanations,
  teacher,
}: {
  body: SimpleQuestionBody;
  response: SimpleResponse | null;
  seed: string | null;
  language: ContentLanguage;
  revealAnswers: boolean;
  revealExplanations: boolean;
  teacher: boolean;
}) {
  switch (body.kind) {
    case 'mcq':
    case 'multi': {
      const chosen = new Set(
        response?.kind === 'mcq' ? [response.optionId] : response?.kind === 'multi' ? response.optionIds : [],
      );
      const correct = new Set(body.kind === 'mcq' ? [body.correctOptionId] : body.correctOptionIds);
      const feedback = new Map(body.options.map((option) => [option.id, option.feedback]));

      return (
        <ul className="space-y-2">
          {orderOptions(body.options, seed).map((option) => {
            const isChosen = chosen.has(option.id);
            const isCorrect = revealAnswers && correct.has(option.id);
            const isWrongChoice = revealAnswers && isChosen && !correct.has(option.id);
            const note = revealExplanations && (isChosen || isCorrect) ? feedback.get(option.id) : null;

            return (
              <li
                key={option.id}
                className={cn(
                  'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
                  isCorrect && 'border-emerald-500/50 bg-emerald-500/8',
                  isWrongChoice && 'border-destructive/50 bg-destructive/8',
                  isChosen && !revealAnswers && 'border-primary bg-primary/8',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center border text-xs font-semibold',
                    body.kind === 'mcq' ? 'rounded-full' : 'rounded-md',
                    isChosen ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground',
                  )}
                  aria-hidden
                >
                  {option.letter}
                </span>
                <span className="min-w-0 flex-1 pt-1">
                  <MathText inline>{option.text}</MathText>
                  {isChosen ? (
                    <span className="sr-only">
                      {' '}
                      ({t('yourAnswer', language)})
                    </span>
                  ) : null}
                  {note ? <span className="mt-1 block text-xs text-muted-foreground">{note}</span> : null}
                </span>
                {isCorrect ? (
                  <Check className="mt-1 size-4 shrink-0 text-emerald-600" aria-label={t('correctAnswer', language)} />
                ) : isWrongChoice ? (
                  <X className="mt-1 size-4 shrink-0 text-destructive" aria-label={t('incorrect', language)} />
                ) : null}
              </li>
            );
          })}
        </ul>
      );
    }

    case 'true_false': {
      const given = response?.kind === 'true_false' ? response.value : null;
      return (
        <div className="space-y-2">
          <AnswerLine label={t('yourAnswer', language)}>
            {given === null ? (
              <span className="text-muted-foreground">{t('notAnswered', language)}</span>
            ) : given ? (
              t('trueLabel', language)
            ) : (
              t('falseLabel', language)
            )}
          </AnswerLine>
          {revealAnswers && body.correct !== null ? (
            <AnswerLine label={t('correctAnswer', language)} tone="correct">
              {body.correct ? t('trueLabel', language) : t('falseLabel', language)}
            </AnswerLine>
          ) : null}
        </div>
      );
    }

    case 'numerical':
    case 'short_answer':
    case 'essay': {
      const text = response && 'text' in response ? response.text : '';
      return (
        <div className="space-y-2">
          <AnswerLine label={t('yourAnswer', language)}>
            {text.trim() === '' ? (
              <span className="text-muted-foreground">{t('notAnswered', language)}</span>
            ) : body.kind === 'essay' ? (
              <span className="block whitespace-pre-wrap">{text}</span>
            ) : (
              <span className="font-mono">{text}</span>
            )}
          </AnswerLine>

          {revealAnswers && body.kind === 'numerical' && body.answers[0] ? (
            <AnswerLine label={t('acceptedAnswer', language)} tone="correct">
              <span className="font-mono">
                {body.answers[0].value}
                {body.answers[0].acceptedUnits[0] ? ` ${body.answers[0].acceptedUnits[0]}` : ''}
              </span>
            </AnswerLine>
          ) : null}

          {revealAnswers && body.kind === 'short_answer' && body.answers.length > 0 ? (
            <AnswerLine label={t('acceptedAnswer', language)} tone="correct">
              {body.answers.map((answer) => answer.text).join(' · ')}
            </AnswerLine>
          ) : null}

          {teacher && body.kind === 'essay' && body.rubric ? (
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Marking guide</p>
              <MathText>{body.rubric}</MathText>
            </div>
          ) : null}
        </div>
      );
    }
  }
}

function AnswerLine({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: 'correct';
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        tone === 'correct' && 'border-emerald-500/40 bg-emerald-500/8',
      )}
    >
      <p className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function Explanations({ item, language, teacher }: { item: ReviewItem; language: ContentLanguage; teacher: boolean }) {
  const { content } = item;
  const sections = [
    { key: 'explanation', title: teacher ? 'Explanation' : t('explanation', language), value: content.explanation },
    { key: 'solution', title: teacher ? 'Worked solution' : t('solution', language), value: content.solution },
    { key: 'commonMistake', title: teacher ? 'Common mistake' : t('commonMistake', language), value: content.commonMistake },
    { key: 'hint', title: teacher ? 'Hint' : t('hint', language), value: content.hint },
  ].filter((section) => section.value);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-4 rounded-lg bg-muted/40 p-4">
      {sections.map((section) => (
        <div key={section.key}>
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{section.title}</p>
          <MathText className="text-sm">{section.value}</MathText>
        </div>
      ))}
    </div>
  );
}
