import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { AssessmentSettingsForm } from '@/features/assessments/components/assessment-settings-form';
import { listBatchOptions } from '@/features/batches/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'New assessment' };

export default async function NewAssessmentPage() {
  await requireTeacher();
  const batches = await listBatchOptions();

  return (
    <>
      <PageHeader
        title="New assessment"
        description="Settings first. You add the questions on the next screen, and nothing is visible to students until you publish."
      />
      <AssessmentSettingsForm mode="create" batches={batches} />
    </>
  );
}
