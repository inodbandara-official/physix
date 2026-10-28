import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { t } from '@/features/language/labels';
import { StudentRankingPage } from '@/features/rankings/components/student-ranking-view';
import { getStudentRankings } from '@/features/rankings/queries';
import { requireStudent } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Ranking' };

export default async function StudentRankingsRoute() {
  const session = await requireStudent();
  const language = session.profile.language;
  const { settings, batches } = await getStudentRankings(session.student.id);

  return (
    <>
      <PageHeader title={t('ranking', language)} description={t('rankingIntro', language)} />
      <StudentRankingPage batches={batches} settings={settings} language={language} />
    </>
  );
}
