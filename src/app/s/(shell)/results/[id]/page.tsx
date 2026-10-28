import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, Hourglass } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ReviewQuestion } from '@/features/attempts/components/review-question';
import { getStudentResult } from '@/features/attempts/queries';
import { passed } from '@/features/attempts/scoring';
import { kindLabel, t, tf } from '@/features/language/labels';
import { requireStudent } from '@/lib/auth/session';
import { formatDateTime, formatPercent } from '@/lib/format';
import { formatDuration } from '@/lib/time';
import { cn } from '@/lib/utils';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Result' };

export default async function StudentResultPage(props: PageProps<'/s/results/[id]'>) {
  const session = await requireStudent();
  const { id } = await props.params;
  const language = session.profile.language;

  const result = await getStudentResult(id, language);
  if (!result) {
    // Still open: send the student back to it rather than to a 404.
    const supabase = await createSupabaseServerClient();
    const { data: open } = await supabase.from('attempts').select('id, status').eq('id', id).maybeSingle();
    if (open?.status === 'in_progress') redirect(`/s/attempt/${id}`);
    notFound();
  }

  const { attempt, assessment, visible, review, items, figureUrls } = result;
  const outcome = attempt.pendingManual > 0 ? null : passed(attempt.percentage, assessment.passPercentage);
  const seconds =
    attempt.submittedAt !== null
      ? (new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000
      : null;

  return (
    <div className="space-y-6" lang={language}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/s/assessments/${assessment.id}`}>
          <ArrowLeft className="size-4" aria-hidden />
          {assessment.title}
        </Link>
      </Button>

      <header className="space-y-1 border-b pb-5">
        <p className="text-sm text-muted-foreground">
          {kindLabel(assessment.kind, language)} · {tf('attemptN', language, { n: attempt.attemptNumber })}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('result', language)}</h1>
      </header>

      {!visible ? (
        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <Hourglass className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-sm">
              {assessment.closesAt ? t('heldUntilClose', language) : t('heldByTeacher', language)}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('score', language)}</p>
                <p className="text-4xl font-semibold tracking-tight tabular-nums">
                  {formatPercent(attempt.percentage)}
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {attempt.score} / {attempt.maxScore}
                </p>
              </div>
              {outcome !== null ? (
                <p
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
                    outcome
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
                  )}
                >
                  {outcome ? <CheckCircle2 className="size-4" aria-hidden /> : null}
                  {outcome ? t('passed', language) : t('belowPass', language)}
                </p>
              ) : null}
            </div>

            <Progress value={attempt.percentage ?? 0} aria-label={t('score', language)} />

            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {attempt.submittedAt ? (
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">{t('submitted', language)}</dt>
                  <dd>{formatDateTime(attempt.submittedAt)}</dd>
                </div>
              ) : null}
              {seconds !== null ? (
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">{t('timeTaken', language)}</dt>
                  <dd>{formatDuration(seconds)}</dd>
                </div>
              ) : null}
              {assessment.passPercentage !== null ? (
                <div className="flex gap-1.5">
                  <dd className="text-muted-foreground">{tf('passMark', language, { n: assessment.passPercentage })}</dd>
                </div>
              ) : null}
            </dl>

            {attempt.pendingManual > 0 ? (
              <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {tf('stillMarking', language, { n: attempt.pendingManual })}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {visible && !review ? <p className="text-sm text-muted-foreground">{t('reviewOff', language)}</p> : null}

      {review && items.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('review', language)}</h2>

          <nav aria-label={t('questionMap', language)} className="flex flex-wrap gap-2">
            {items.map((item, index) => {
              const full = !item.awaitingTeacher && (item.marksAwarded ?? 0) >= item.maxMarks;
              const none = !item.awaitingTeacher && (item.marksAwarded ?? 0) <= 0;
              return (
                <a
                  key={item.attemptQuestionId}
                  href={`#q-${index + 1}`}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg border text-sm font-medium tabular-nums',
                    full && 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                    none && 'border-destructive/40 bg-destructive/8 text-destructive',
                    !full && !none && 'bg-muted',
                  )}
                >
                  {index + 1}
                </a>
              );
            })}
          </nav>

          <div className="space-y-4">
            {items.map((item, index) => (
              <ReviewQuestion
                key={item.attemptQuestionId}
                item={item}
                number={index + 1}
                language={language}
                revealAnswers={assessment.showCorrectAnswers}
                revealExplanations={assessment.showExplanations}
                shuffleOptions={assessment.shuffleOptions}
                figureUrls={figureUrls}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
