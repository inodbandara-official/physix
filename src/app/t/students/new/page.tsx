import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { listBatchOptions } from '@/features/batches/queries';
import { StudentForm } from '@/features/students/components/student-form';
import { suggestStudentCode } from '@/features/students/credentials';
import { listStudentCodes } from '@/features/students/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Add student' };

export default async function NewStudentPage() {
  await requireTeacher();
  const [batches, codes] = await Promise.all([listBatchOptions(), listStudentCodes()]);

  const defaultYear = batches.find((batch) => batch.al_year)?.al_year ?? null;

  return (
    <>
      <PageHeader
        title="Add student"
        description="Create the record now; the login account can be issued straight afterwards."
      />
      <StudentForm mode="create" batches={batches} suggestedCode={suggestStudentCode(defaultYear, codes)} />
    </>
  );
}
