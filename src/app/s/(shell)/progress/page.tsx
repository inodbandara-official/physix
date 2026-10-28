import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { StudentReportView } from '@/features/analytics/components/student-report-view';
import { getMyReport } from '@/features/analytics/queries';
import { t } from '@/features/language/labels';
import { StudentRankingCard } from '@/features/rankings/components/student-ranking-view';
import { getStudentRankings } from '@/features/rankings/queries';
import { requireStudent } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Progress' };

export default async function StudentProgressPage() {
  const session = await requireStudent();
  const language = session.profile.language;

  const [report, ranking] = await Promise.all([getMyReport(session.student.id), getStudentRankings(session.student.id)]);

  return (
    <>
      <PageHeader title={t('progress', language)} description={t('progressIntro', language)} />

      {ranking.batches.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {ranking.batches.map((batch) => (
            <StudentRankingCard key={batch.batchId} ranking={batch} settings={ranking.settings} language={language} compact />
          ))}
        </div>
      ) : null}

      <StudentReportView report={report} language={language} resultHref={(id) => `/s/results/${id}`} />
    </>
  );
}
