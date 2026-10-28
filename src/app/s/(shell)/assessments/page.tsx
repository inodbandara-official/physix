import type { Metadata } from 'next';
import { ClipboardList } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { StudentAssessmentCard } from '@/features/attempts/components/student-assessment-card';
import { listStudentAssessments, type StudentAssessment } from '@/features/attempts/queries';
import { t } from '@/features/language/labels';
import { requireStudent } from '@/lib/auth/session';
import type { ContentLanguage } from '@/types/database';

export const metadata: Metadata = { title: 'Assessments' };

export default async function StudentAssessmentsPage() {
  const session = await requireStudent();
  const language = session.profile.language;
  const assessments = await listStudentAssessments(session.student.id);

  const available = assessments.filter((item) => item.active && item.window === 'open' && (item.canStart || item.openAttemptId));
  const upcoming = assessments.filter((item) => item.active && item.window === 'upcoming');
  const finished = assessments.filter(
    (item) => !available.includes(item) && !upcoming.includes(item) && (item.attempts.length > 0 || item.active),
  );

  return (
    <>
      <PageHeader title={t('assessments', language)} description={t('assessmentsIntro', language)} />

      {assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('nothingAssigned', language)}
          description={t('nothingAssignedHint', language)}
        />
      ) : (
        <div className="space-y-8" lang={language}>
          <Group title={t('availableNow', language)} items={available} language={language} />
          <Group title={t('upcoming', language)} items={upcoming} language={language} />
          <Group title={t('finished', language)} items={finished} language={language} />
        </div>
      )}
    </>
  );
}

function Group({ title, items, language }: { title: string; items: StudentAssessment[]; language: ContentLanguage }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <ul className="space-y-3">
        {items.map((assessment) => (
          <StudentAssessmentCard key={assessment.id} assessment={assessment} language={language} />
        ))}
      </ul>
    </section>
  );
}
