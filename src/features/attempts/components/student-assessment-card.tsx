import Link from 'next/link';
import { CalendarClock, Clock, Repeat } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { kindLabel, t, tf } from '@/features/language/labels';
import { formatDateTime, formatPercent } from '@/lib/format';
import type { ContentLanguage } from '@/types/database';

import type { StudentAssessment } from '../queries';

/** One assessment in the student's list, with the single action that makes sense right now. */
export function StudentAssessmentCard({
  assessment,
  language,
}: {
  assessment: StudentAssessment;
  language: ContentLanguage;
}) {
  const finished = assessment.attempts.filter((attempt) => attempt.status !== 'in_progress');
  const latest = finished.at(-1) ?? null;

  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/s/assessments/${assessment.id}`} className="font-medium hover:underline">
            {assessment.title}
          </Link>
          <Badge variant="secondary" className="font-normal">
            {kindLabel(assessment.kind, language)}
          </Badge>
          {assessment.openAttemptId ? <Badge className="font-normal">{t('inProgress', language)}</Badge> : null}
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1">
            <CalendarClock className="size-3.5" aria-hidden />
            {assessment.window === 'upcoming'
              ? `${t('opens', language)} ${formatDateTime(assessment.opensAt)}`
              : assessment.closesAt
                ? `${assessment.window === 'closed' ? t('closed', language) : t('closes', language)} ${formatDateTime(assessment.closesAt)}`
                : t('noDeadline', language)}
          </li>
          <li className="flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {assessment.timeLimitMinutes
              ? tf('minutes', language, { n: assessment.timeLimitMinutes })
              : t('noTimeLimit', language)}
          </li>
          <li className="flex items-center gap-1">
            <Repeat className="size-3.5" aria-hidden />
            {assessment.attemptsLeft === null
              ? t('unlimited', language)
              : tf('attemptsLeft', language, { n: assessment.attemptsLeft })}
          </li>
          {assessment.best ? (
            <li className="font-medium text-foreground">
              {t('bestScore', language)}: {formatPercent(assessment.best.percentage)}
            </li>
          ) : finished.length > 0 && !assessment.resultsVisible ? (
            <li>{t('resultsLater', language)}</li>
          ) : null}
        </ul>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {latest ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/s/results/${latest.id}`}>{t('viewResult', language)}</Link>
          </Button>
        ) : null}
        {assessment.openAttemptId ? (
          <Button asChild size="sm">
            <Link href={`/s/attempt/${assessment.openAttemptId}`}>{t('resume', language)}</Link>
          </Button>
        ) : assessment.canStart ? (
          <Button asChild size="sm" variant={latest ? 'outline' : 'default'}>
            <Link href={`/s/assessments/${assessment.id}`}>{latest ? t('startAgain', language) : t('start', language)}</Link>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

