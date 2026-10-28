import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarClock, Clock, ListOrdered, Repeat } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StartAttemptButton } from '@/features/attempts/components/start-attempt-button';
import { getStudentAssessment } from '@/features/attempts/queries';
import { kindLabel, t, tf } from '@/features/language/labels';
import { requireStudent } from '@/lib/auth/session';
import { formatDateTime, formatPercent } from '@/lib/format';

export const metadata: Metadata = { title: 'Assessment' };

export default async function StudentAssessmentPage(props: PageProps<'/s/assessments/[id]'>) {
  const session = await requireStudent();
  const { id } = await props.params;
  const language = session.profile.language;

  const assessment = await getStudentAssessment(session.student.id, id);
  if (!assessment) notFound();

  const facts = [
    {
      icon: ListOrdered,
      label: t('questions', language),
      value: assessment.questionCount === null ? '—' : String(assessment.questionCount),
    },
    {
      icon: Clock,
      label: t('timeLimit', language),
      value: assessment.timeLimitMinutes
        ? tf('minutes', language, { n: assessment.timeLimitMinutes })
        : t('noTimeLimit', language),
    },
    {
      icon: Repeat,
      label: t('attempts', language),
      value:
        assessment.maxAttempts === null
          ? t('unlimited', language)
          : `${assessment.attempts.length} / ${assessment.maxAttempts}`,
    },
    {
      icon: CalendarClock,
      label: assessment.window === 'upcoming' ? t('opens', language) : t('closes', language),
      value:
        assessment.window === 'upcoming'
          ? formatDateTime(assessment.opensAt)
          : assessment.closesAt
            ? formatDateTime(assessment.closesAt)
            : t('noDeadline', language),
    },
  ];

  return (
    <div className="space-y-6" lang={language}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/s/assessments">
          <ArrowLeft className="size-4" aria-hidden />
          {t('backToAssessments', language)}
        </Link>
      </Button>

      <PageHeader title={assessment.title} description={kindLabel(assessment.kind, language)} />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-start gap-3 rounded-xl border bg-background p-4">
            <fact.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="font-medium">{fact.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('beforeYouStart', language)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {assessment.description ? (
              <p className="text-sm whitespace-pre-wrap">{assessment.description}</p>
            ) : null}

            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {assessment.timeLimitMinutes ? <li>{t('ruleTimer', language)}</li> : null}
              <li>{t('ruleAutosave', language)}</li>
              {assessment.timeLimitMinutes || assessment.closesAt ? <li>{t('ruleTimeUp', language)}</li> : null}
              {assessment.negativeMarking ? <li className="font-medium text-foreground">{t('ruleNegative', language)}</li> : null}
              {assessment.passPercentage !== null ? (
                <li>{tf('passMark', language, { n: assessment.passPercentage })}</li>
              ) : null}
            </ul>

            <div className="flex flex-wrap items-center gap-3 border-t pt-5">
              {assessment.openAttemptId ? (
                <Button asChild size="lg">
                  <Link href={`/s/attempt/${assessment.openAttemptId}`}>{t('resume', language)}</Link>
                </Button>
              ) : assessment.canStart ? (
                <StartAttemptButton
                  assessmentId={assessment.id}
                  label={assessment.attempts.length > 0 ? t('startAgain', language) : t('startNow', language)}
                />
              ) : (
                <p className="text-sm font-medium text-muted-foreground">
                  {!assessment.active || assessment.window === 'closed'
                    ? t('closed', language)
                    : assessment.window === 'upcoming'
                      ? t('notOpenYet', language)
                      : t('noAttemptsLeft', language)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('yourAttempts', language)}</CardTitle>
          </CardHeader>
          <CardContent>
            {assessment.attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-2">
                {[...assessment.attempts].reverse().map((attempt) => (
                  <li key={attempt.id}>
                    <Link
                      href={attempt.status === 'in_progress' ? `/s/attempt/${attempt.id}` : `/s/results/${attempt.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/60"
                    >
                      <span>
                        <span className="block font-medium">{tf('attemptN', language, { n: attempt.attemptNumber })}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDateTime(attempt.submittedAt ?? attempt.startedAt)}
                        </span>
                      </span>
                      {attempt.status === 'in_progress' ? (
                        <Badge>{t('inProgress', language)}</Badge>
                      ) : assessment.resultsVisible ? (
                        <span className="font-semibold tabular-nums">{formatPercent(attempt.percentage)}</span>
                      ) : (
                        <Badge variant="secondary" className="font-normal">
                          {t('resultsLater', language)}
                        </Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
