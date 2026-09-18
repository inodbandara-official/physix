import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { listBatchOptions } from '@/features/batches/queries';
import { StudentFilters } from '@/features/students/components/student-filters';
import { StudentsTable } from '@/features/students/components/students-table';
import { listStudents } from '@/features/students/queries';
import { studentFiltersSchema } from '@/features/students/schema';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Students' };

export default async function StudentsPage(props: PageProps<'/t/students'>) {
  await requireTeacher();
  const searchParams = await props.searchParams;

  // Unparseable query strings fall back to defaults rather than throwing.
  const parsed = studentFiltersSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : studentFiltersSchema.parse({});

  const [page, batches] = await Promise.all([listStudents(filters), listBatchOptions()]);

  const baseQuery = new URLSearchParams(
    Object.entries(searchParams)
      .filter(([key, value]) => key !== 'page' && typeof value === 'string')
      .map(([key, value]) => [key, value as string]),
  ).toString();

  const isFiltered = Boolean(
    filters.q || filters.batch || filters.status || filters.contact !== 'any' || filters.archived !== 'active',
  );

  return (
    <>
      <PageHeader
        title="Students"
        description="Everyone on your roll, their batches and their login accounts."
        actions={
          <Button asChild>
            <Link href="/t/students/new">
              <UserPlus className="size-4" aria-hidden />
              Add student
            </Link>
          </Button>
        }
      />

      <StudentFilters batches={batches} />

      <StudentsTable students={page.rows} filtered={isFiltered} />

      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        total={page.total}
        perPage={page.perPage}
        baseQuery={baseQuery}
        basePath="/t/students"
      />
    </>
  );
}
