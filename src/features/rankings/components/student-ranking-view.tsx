import { Info, Trophy } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { t, tf } from '@/features/language/labels';
import { cn } from '@/lib/utils';
import type { ContentLanguage, RankingSettingsRow } from '@/types/database';

import type { StudentBatchRanking } from '../queries';

export function rankingRule(settings: RankingSettingsRow, language: ContentLanguage): string {
  const basis =
    settings.basis === 'average'
      ? t('basisAverage', language)
      : settings.basis === 'total'
        ? t('basisTotal', language)
        : settings.basis === 'weighted'
          ? t('basisWeighted', language)
          : tf('basisRecent', language, { n: settings.recent_count });
  return `${basis} ${settings.missed_counts_zero ? t('missedZero', language) : t('missedLeftOut', language)}`;
}

/**
 * A student's standing in one batch. Shows exactly what the teacher's
 * privacy setting allows: always their own position and the gap to the
 * next place, and — only if enabled — the rest of the list.
 */
export function StudentRankingCard({
  ranking,
  settings,
  language,
  compact = false,
}: {
  ranking: StudentBatchRanking;
  settings: RankingSettingsRow;
  language: ContentLanguage;
  compact?: boolean;
}) {
  const me = ranking.me;
  const ranked = me?.rank !== null && me?.rank !== undefined;
  const unit = settings.basis === 'total' ? '' : '%';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ranking.batchName}</CardTitle>
        <CardDescription>{t('yourPosition', language)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!ranked ? (
          <div className="rounded-lg bg-muted px-4 py-3">
            <p className="font-medium">{t('notRankedYet', language)}</p>
            <p className="text-sm text-muted-foreground">{t('notRankedHint', language)}</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="text-5xl font-semibold tracking-tight tabular-nums">
              #{me!.rank}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                {tf('ofN', language, { n: ranking.rankedCount })}
              </span>
            </p>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {me!.score}
                {unit}
              </p>
              <p className="text-sm text-muted-foreground">
                {me!.gapToNext === null
                  ? t('topOfClass', language)
                  : tf('behindNext', language, { gap: me!.gapToNext, rank: me!.rank! - 1 })}
              </p>
            </div>
          </div>
        )}

        {!compact && ranking.rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('rank', language)}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium" />
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('score', language)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranking.rows.map((row, index) => (
                  <tr key={index} className={cn('border-t', row.isMe && 'bg-primary/8 font-semibold')}>
                    <td className="px-3 py-2 tabular-nums">#{row.rank}</td>
                    <td className="px-3 py-2">{row.isMe ? t('you', language) : (row.label ?? t('classmate', language))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.score}
                      {unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!compact && settings.student_visibility === 'private' ? (
          <p className="text-xs text-muted-foreground">{t('rankPrivate', language)}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StudentRankingPage({
  batches,
  settings,
  language,
}: {
  batches: StudentBatchRanking[];
  settings: RankingSettingsRow;
  language: ContentLanguage;
}) {
  if (batches.length === 0) {
    return <EmptyState icon={Trophy} title={t('notRankedYet', language)} description={t('noClassYet', language)} />;
  }

  return (
    <div className="space-y-6">
      {batches.map((ranking) => (
        <StudentRankingCard key={ranking.batchId} ranking={ranking} settings={settings} language={language} />
      ))}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium text-foreground">{t('howWorkedOut', language)}: </span>
          {rankingRule(settings, language)}
        </span>
      </p>
    </div>
  );
}
