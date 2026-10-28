import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { z } from 'zod';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QuestionPicker } from '@/features/assessments/components/question-picker';
import { listPickableQuestions } from '@/features/assessments/queries';
import { addPaperQuestionsAction } from '@/features/past-papers/actions';
import { getPastPaper } from '@/features/past-papers/queries';
import { flattenSyllabus, getSyllabusTree } from '@/features/syllabus/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Add questions to paper' };

const yearSchema = z.coerce.number().int().min(1950).max(2100);

export default async function AddPaperQuestionsPage(props: PageProps<'/t/past-papers/[id]/add'>) {
  await requireTeacher();
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const detail = await getPastPaper(id);
  if (!detail) notFound();

  const pick = (key: string) => (typeof searchParams[key] === 'string' ? (searchParams[key] as string) : undefined);
  // Starts filtered to the paper's year; "any" (or blank) clears it.
  const yearParam = pick('year');
  const year =
    yearParam === undefined ? detail.paper.year : yearParam === 'any' || yearParam === '' ? undefined : yearSchema.safeParse(yearParam).data;
  const filters = {
    q: pick('q')?.trim().slice(0, 200) || undefined,
    unit: z.string().uuid().safeParse(pick('unit')).data,
    year,
  };

  const taken = detail.questions.map((item) => item.questionId);
  const [{ rows, total }, tree] = await Promise.all([listPickableQuestions(filters, taken), getSyllabusTree()]);
  const labels = Object.fromEntries(flattenSyllabus(tree).map((node) => [node.id, node.label]));

  const selectClass =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30';

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/t/past-papers/${id}`}>
          <ArrowLeft className="size-4" aria-hidden />
          {detail.paper.year} {detail.paper.title}
        </Link>
      </Button>

      <PageHeader
        title="Add questions to the paper"
        description="Published questions from your bank. Set a question's source year when you write it and it shows up here first."
      />

      <form method="get" className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_8rem_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="q" className="text-xs text-muted-foreground">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Text, title or ID" className="pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit" className="text-xs text-muted-foreground">
            Unit
          </Label>
          <select id="unit" name="unit" defaultValue={filters.unit ?? ''} className={selectClass}>
            <option value="">All units</option>
            {tree.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="year" className="text-xs text-muted-foreground">
            Source year
          </Label>
          <Input id="year" name="year" defaultValue={year ?? ''} placeholder="Any" inputMode="numeric" />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" className="w-full">
            Filter
          </Button>
        </div>
      </form>

      {total > rows.length ? <p className="text-sm text-muted-foreground">Showing the first {rows.length} of {total}.</p> : null}

      <QuestionPicker
        targetField="paper_id"
        targetId={id}
        action={addPaperQuestionsAction}
        doneHref={`/t/past-papers/${id}`}
        targetNoun="paper"
        rows={rows.map((row) => ({
          id: row.id,
          code: row.question_code,
          title: row.current_title,
          stem: row.current_stem ?? '',
          type: row.current_type,
          difficulty: row.current_difficulty,
          marks: Number(row.current_marks ?? 0),
          nodeLabel: row.current_node_id ? (labels[row.current_node_id] ?? null) : null,
          hasSinhala: (row.current_languages ?? []).includes('si'),
        }))}
      />
    </>
  );
}
