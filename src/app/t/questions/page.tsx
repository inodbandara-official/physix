import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { QuestionFilters } from '@/features/questions/components/question-filters';
import { QuestionsTable } from '@/features/questions/components/questions-table';
import { listQuestionTags, listQuestions } from '@/features/questions/queries';
import { questionFiltersSchema } from '@/features/questions/schema';
import { flattenSyllabus, getSyllabusTree } from '@/features/syllabus/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Question bank' };

export default async function QuestionsPage(props: PageProps<'/t/questions'>) {
  await requireTeacher();
  const searchParams = await props.searchParams;

  const parsed = questionFiltersSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : questionFiltersSchema.parse({});

  const [page, tree, tags] = await Promise.all([listQuestions(filters), getSyllabusTree(), listQuestionTags()]);

  const nodeLabels = Object.fromEntries(flattenSyllabus(tree).map((node) => [node.id, node.label]));
  const units = tree.map((unit) => ({ id: unit.id, name: unit.name }));
  const years = [...new Set(page.rows.map((row) => row.source_year).filter((year): year is number => year !== null))]
    .sort((a, b) => b - a);

  const baseQuery = new URLSearchParams(
    Object.entries(searchParams)
      .filter(([key, value]) => key !== 'page' && typeof value === 'string')
      .map(([key, value]) => [key, value as string]),
  ).toString();

  const isFiltered = Boolean(
    filters.q ||
      filters.unit ||
      filters.node ||
      filters.type ||
      filters.difficulty ||
      filters.status ||
      filters.tag ||
      filters.year ||
      filters.archived !== 'active',
  );

  return (
    <>
      <PageHeader
        title="Question bank"
        description="Questions live here independently of any assessment, so the same question can be reused across quizzes, tests and past-paper practice."
        actions={
          <Button asChild>
            <Link href="/t/questions/new">
              <Plus className="size-4" aria-hidden />
              New question
            </Link>
          </Button>
        }
      />

      <QuestionFilters units={units} tags={tags} years={years} />

      <QuestionsTable questions={page.rows} filtered={isFiltered} nodeLabels={nodeLabels} />

      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        total={page.total}
        perPage={page.perPage}
        baseQuery={baseQuery}
        basePath="/t/questions"
      />
    </>
  );
}
