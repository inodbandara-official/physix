import Link from 'next/link';
import { Award, BarChart3, CheckCircle2, Flame, Target, TrendingDown, TrendingUp } from 'lucide-react';

import { AccuracyBars } from '@/components/charts/accuracy-bars';
import { TrendChart } from '@/components/charts/trend-chart';
import { EmptyState } from '@/components/empty-state';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { t, tf, type LabelKey } from '@/features/language/labels';
import { formatDateTime, formatPercent } from '@/lib/format';
import type { ContentLanguage } from '@/types/database';

import { MIN_QUESTIONS, WEAK_THRESHOLD, type QuestionCategory } from '../compute';
import type { StudentReport } from '../queries';

const LEVEL_KEYS: Record<string, LabelKey> = {
  very_easy: 'levelVeryEasy',
  easy: 'levelEasy',
  medium: 'levelMedium',
  hard: 'levelHard',
  very_hard: 'levelVeryHard',
};

const CATEGORY_KEYS: Record<QuestionCategory, LabelKey> = {
  numerical: 'kindNumerical',
  conceptual: 'kindConceptual',
  written: 'kindWritten',
};

export function monthLabel(month: string, language: ContentLanguage): string {
  const [year, index] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(language === 'si' ? 'si-LK' : 'en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, index - 1, 1)));
}

/**
 * One student's performance, in their language. The teacher sees the same
 * view (in English) on the student's record, so both talk about the same
 * numbers.
 */
export function StudentReportView({
  report,
  language,
  resultHref,
}: {
  report: StudentReport;
  language: ContentLanguage;
  /** Where a recent result links to; differs for the teacher. */
  resultHref: (attemptId: string) => string;
}) {
  if (report.attemptsCount === 0 && report.overall.questions === 0) {
    return <EmptyState icon={BarChart3} title={t('noResultsYet', language)} description={t('noResultsHint', language)} />;
  }

  const name = (item: { name: string; nameSi: string | null }) => (language === 'si' && item.nameSi ? item.nameSi : item.name);
  const basedOn = (n: number) => tf('basedOn', language, { n });
  const weakIds = new Set(report.weak.map((topic) => topic.topicId));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('overallAccuracy', language)}
          value={formatPercent(report.overall.accuracy)}
          hint={basedOn(report.overall.questions)}
          icon={Target}
        />
        <StatCard
          label={t('averageScore', language)}
          value={formatPercent(report.averagePercentage)}
          hint={`${t('completed', language)}: ${report.attemptsCount}`}
          icon={BarChart3}
        />
        <StatCard
          label={t('sinceFirstMonth', language)}
          value={report.improvement === null ? '—' : `${report.improvement > 0 ? '+' : ''}${report.improvement}`}
          hint={report.improvement === null ? t('needTwoMonths', language) : tf('points', language, { n: Math.abs(report.improvement) })}
          icon={report.improvement !== null && report.improvement < 0 ? TrendingDown : TrendingUp}
        />
        <StatCard
          label={t('highestScore', language)}
          value={formatPercent(report.bests.highestPercentage)}
          icon={Award}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t('overTime', language)}</CardTitle>
            <CardDescription>{t('monthlyAverage', language)}</CardDescription>
          </CardHeader>
          <CardContent>
            {report.timeline.length < 2 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t('needTwoMonths', language)}</p>
            ) : (
              <>
                <TrendChart
                  ariaLabel={t('overTime', language)}
                  points={report.timeline.map((point) => ({
                    label: monthLabel(point.month, language),
                    value: point.average,
                    detail: `${t('completed', language)}: ${point.attempts}`,
                  }))}
                />
                <table className="sr-only">
                  <tbody>
                    {report.timeline.map((point) => (
                      <tr key={point.month}>
                        <th scope="row">{monthLabel(point.month, language)}</th>
                        <td>{point.average}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('needsAttention', language)}</CardTitle>
            <CardDescription>
              {language === 'si'
                ? `ප්‍රශ්න ${MIN_QUESTIONS}කට වඩා, ${WEAK_THRESHOLD}%ට අඩු`
                : `${MIN_QUESTIONS}+ questions, under ${WEAK_THRESHOLD}%`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.weak.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('needsAttentionNone', language)}</p>
            ) : (
              <ol className="space-y-3">
                {report.weak.map((topic, index) => (
                  <li key={topic.topicId} className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-semibold text-amber-800 dark:text-amber-300">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{name(topic)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatPercent(topic.accuracy)} · {basedOn(topic.questions)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('byUnit', language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <AccuracyBars
              basedOnLabel={basedOn}
              rows={report.units.map((unit) => ({
                key: unit.id,
                label: name(unit),
                accuracy: unit.accuracy,
                questions: unit.questions,
                weak: weakIds.has(unit.id),
              }))}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('byDifficulty', language)}</CardTitle>
            </CardHeader>
            <CardContent>
              <AccuracyBars
                basedOnLabel={basedOn}
                rows={report.difficulty.map((item) => ({
                  key: item.level,
                  label: LEVEL_KEYS[item.level] ? t(LEVEL_KEYS[item.level], language) : item.level,
                  accuracy: item.accuracy.accuracy,
                  questions: item.accuracy.questions,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('byKind', language)}</CardTitle>
            </CardHeader>
            <CardContent>
              <AccuracyBars
                basedOnLabel={basedOn}
                rows={report.categories.map((item) => ({
                  key: item.category,
                  label: t(CATEGORY_KEYS[item.category], language),
                  accuracy: item.accuracy.accuracy,
                  questions: item.accuracy.questions,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('personalBests', language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Best icon={Award} label={t('highestScore', language)} value={formatPercent(report.bests.highestPercentage)} />
              <Best icon={Flame} label={t('longestStreak', language)} value={tf('daysN', language, { n: report.bests.longestStreak })} />
              <Best icon={Target} label={t('questionsAnswered', language)} value={String(report.bests.questionsAnswered)} />
              <Best icon={CheckCircle2} label={t('fullyCorrect', language)} value={String(report.bests.questionsFullyCorrect)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('recentResults', language)}</CardTitle>
          </CardHeader>
          <CardContent>
            {report.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="divide-y">
                {report.recent.map((attempt) => (
                  <li key={attempt.attemptId}>
                    <Link
                      href={resultHref(attempt.attemptId)}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm hover:underline"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {attempt.pastPaper ? (attempt.practiceLabel ?? t('pastPapers', language)) : attempt.assessmentTitle}
                        </span>
                        <span className="block text-xs text-muted-foreground">{formatDateTime(attempt.submittedAt)}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatPercent(attempt.percentage)}</span>
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

function Best({ icon: Icon, label, value }: { icon: typeof Award; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      </div>
    </div>
  );
}
