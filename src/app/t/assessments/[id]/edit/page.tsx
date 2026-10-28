import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/page-header';
import { AssessmentSettingsForm } from '@/features/assessments/components/assessment-settings-form';
import { getAssessmentDetail } from '@/features/assessments/queries';
import { listBatchOptions } from '@/features/batches/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Assessment settings' };

export default async function EditAssessmentPage(props: PageProps<'/t/assessments/[id]/edit'>) {
  await requireTeacher();
  const { id } = await props.params;

  const [detail, batches] = await Promise.all([getAssessmentDetail(id), listBatchOptions()]);
  if (!detail) notFound();

  return (
    <>
      <PageHeader title="Assessment settings" description={detail.assessment.title} />
      <AssessmentSettingsForm
        mode="edit"
        assessment={detail.assessment}
        batches={batches}
        selectedBatchIds={detail.batchIds}
        hasAttempts={detail.attemptCount > 0}
      />
    </>
  );
}
