import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { t } from '@/features/language/labels';
import { getSyllabusTree, type SyllabusNode } from '@/features/syllabus/queries';
import { nodeDescription, nodeName } from '@/features/syllabus/tree';
import { requireStudent } from '@/lib/auth/session';
import type { ContentLanguage } from '@/types/database';

export const metadata: Metadata = { title: 'Syllabus' };

export default async function StudentSyllabusPage() {
  const session = await requireStudent();
  const language = session.profile.language;
  const tree = await getSyllabusTree();

  return (
    <>
      <PageHeader title={t('syllabus', language)} description={t('syllabusIntro', language)} />

      {tree.length === 0 ? (
        <EmptyState icon={BookOpen} title={t('syllabusEmpty', language)} />
      ) : (
        <div className="space-y-4" lang={language}>
          {tree.map((unit) => (
            <Card key={unit.id}>
              <CardContent className="space-y-3 p-5">
                <div>
                  <h2 className="font-semibold">{nodeName(unit, language)}</h2>
                  {nodeDescription(unit, language) ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {nodeDescription(unit, language)}
                    </p>
                  ) : null}
                </div>
                {unit.children.length > 0 ? (
                  <TopicList topics={unit.children} language={language} />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function TopicList({ topics, language }: { topics: SyllabusNode[]; language: ContentLanguage }) {
  return (
    <ul className="space-y-2 border-l pl-4">
      {topics.map((topic) => (
        <li key={topic.id}>
          <p className="text-sm font-medium">{nodeName(topic, language)}</p>
          {topic.children.length > 0 ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {topic.children.map((subtopic) => nodeName(subtopic, language)).join(' · ')}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
