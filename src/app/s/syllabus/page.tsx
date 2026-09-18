import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getSyllabusTree, type SyllabusNode } from '@/features/syllabus/queries';
import { requireStudent } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Syllabus' };

export default async function StudentSyllabusPage() {
  await requireStudent();
  const tree = await getSyllabusTree();

  return (
    <>
      <PageHeader title="Syllabus" description="Everything covered in this Physics course." />

      {tree.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Syllabus not published yet"
          description="Your teacher has not set up the syllabus. It will appear here once they do."
        />
      ) : (
        <div className="space-y-4">
          {tree.map((unit) => (
            <Card key={unit.id}>
              <CardContent className="space-y-3 p-5">
                <div>
                  <h2 className="font-semibold">{unit.name}</h2>
                  {unit.description ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{unit.description}</p>
                  ) : null}
                </div>
                {unit.children.length > 0 ? <TopicList topics={unit.children} /> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function TopicList({ topics }: { topics: SyllabusNode[] }) {
  return (
    <ul className="space-y-2 border-l pl-4">
      {topics.map((topic) => (
        <li key={topic.id}>
          <p className="text-sm font-medium">{topic.name}</p>
          {topic.children.length > 0 ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {topic.children.map((subtopic) => subtopic.name).join(' · ')}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
