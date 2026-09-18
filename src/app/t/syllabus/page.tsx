import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { SyllabusTree } from '@/features/syllabus/components/syllabus-tree';
import { getSyllabusTree } from '@/features/syllabus/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Syllabus' };

export default async function SyllabusPage(props: PageProps<'/t/syllabus'>) {
  await requireTeacher();
  const searchParams = await props.searchParams;
  const includeArchived = searchParams.archived === 'true';

  const tree = await getSyllabusTree(includeArchived);

  return (
    <>
      <PageHeader
        title="Syllabus"
        description="Your own A/L Physics structure: units, topics and subtopics. Questions, assessments and topic analytics all hang off this tree."
        actions={
          <Button asChild variant="outline">
            <Link href={includeArchived ? '/t/syllabus' : '/t/syllabus?archived=true'}>
              {includeArchived ? 'Hide archived' : 'Show archived'}
            </Link>
          </Button>
        }
      />

      {tree.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Your syllabus is empty"
          description="Start with a unit such as Mechanics, then add topics like Motion and subtopics like Equations of Motion."
        />
      ) : null}

      <SyllabusTree tree={tree} />
    </>
  );
}
