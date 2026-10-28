import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, PencilLine, Plus } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaperFormDialog } from '@/features/past-papers/components/paper-form-dialog';
import { PaperLifecycle } from '@/features/past-papers/components/paper-lifecycle';
import { PaperQuestions } from '@/features/past-papers/components/paper-questions';
import { getPastPaper } from '@/features/past-papers/queries';
import { flattenSyllabus, getSyllabusTree } from '@/features/syllabus/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Past paper' };

export default async function PastPaperPage(props: PageProps<'/t/past-papers/[id]'>) {
  await requireTeacher();
  const { id } = await props.params;

  const [detail, tree] = await Promise.all([getPastPaper(id), getSyllabusTree()]);
  if (!detail) notFound();

  const { paper, questions } = detail;
  const nodeLabels = Object.fromEntries(flattenSyllabus(tree).map((node) => [node.id, node.label]));
  const marks = questions.reduce((sum, item) => sum + Number(item.question?.current_marks ?? 0), 0);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/t/past-papers">
          <ArrowLeft className="size-4" aria-hidden />
          Past papers
        </Link>
      </Button>

      <PageHeader
        title={`${paper.year} ${paper.title}`}
        description={paper.description ?? undefined}
        actions={
          <>
            <PaperFormDialog
              paper={paper}
              trigger={
                <Button variant="outline">
                  <PencilLine className="size-4" aria-hidden />
                  Edit
                </Button>
              }
            />
            <PaperLifecycle id={paper.id} published={paper.published} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {paper.published ? (
          <Badge>Published — students can practise it</Badge>
        ) : (
          <Badge variant="outline">Draft — hidden from students</Badge>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Questions</CardTitle>
            <CardDescription>
              {questions.length} {questions.length === 1 ? 'question' : 'questions'} · {Math.round(marks * 100) / 100}{' '}
              marks. Number and section them as on the printed paper; sections become practice options for students.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href={`/t/past-papers/${paper.id}/add`}>
              <Plus className="size-4" aria-hidden />
              Add questions
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <EmptyState
              title="No questions yet"
              description="Add the paper's questions from your bank. The picker starts filtered to this paper's year."
              className="py-10"
            />
          ) : (
            <PaperQuestions paperId={paper.id} questions={questions} nodeLabels={nodeLabels} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
