import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { z } from 'zod';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QuestionPicker } from '@/features/assessments/components/question-picker';
import { getAssessmentDetail, listPickableQuestions } from '@/features/assessments/queries';
import { difficultySchema, questionTypeSchema } from '@/features/questions/schema';
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER, QUESTION_TYPE_LABELS } from '@/features/questions/types';
import { flattenSyllabus, getSyllabusTree } from '@/features/syllabus/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Add questions' };

/**
 * A plain GET form for filtering: it needs no client code, and the
 * filtered list is a URL the teacher can come back to.
 */
export default async function AddQuestionsPage(props: PageProps<'/t/assessments/[id]/add'>) {
  await requireTeacher();
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const detail = await getAssessmentDetail(id);
  if (!detail) notFound();
  if (detail.attemptCount > 0) redirect(`/t/assessments/${id}`);

  const pick = (key: string) => (typeof searchParams[key] === 'string' ? (searchParams[key] as string) : undefined);
  const filters = {
    q: pick('q')?.trim().slice(0, 200) || undefined,
    unit: z.string().uuid().safeParse(pick('unit')).data,
    type: questionTypeSchema.safeParse(pick('type')).data,
    difficulty: difficultySchema.safeParse(pick('difficulty')).data,
  };

  const taken = detail.items.flatMap((item) => (item.kind === 'question' && item.question ? [item.question.id] : []));
  const [{ rows, total }, tree] = await Promise.all([listPickableQuestions(filters, taken), getSyllabusTree()]);
  const labels = Object.fromEntries(flattenSyllabus(tree).map((node) => [node.id, node.label]));

  const selectClass =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30';

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/t/assessments/${id}`}>
          <ArrowLeft className="size-4" aria-hidden />
          {detail.assessment.title}
        </Link>
      </Button>

      <PageHeader
        title="Add questions"
        description="Published questions from your bank. The version that is current when a student starts is the one they sit."
      />

      <form method="get" className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
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
          <Label htmlFor="type" className="text-xs text-muted-foreground">
            Type
          </Label>
          <select id="type" name="type" defaultValue={filters.type ?? ''} className={selectClass}>
            <option value="">Any type</option>
            {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="difficulty" className="text-xs text-muted-foreground">
            Difficulty
          </Label>
          <select id="difficulty" name="difficulty" defaultValue={filters.difficulty ?? ''} className={selectClass}>
            <option value="">Any</option>
            {DIFFICULTY_ORDER.map((level) => (
              <option key={level} value={level}>
                {DIFFICULTY_LABELS[level]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" className="w-full">
            Filter
          </Button>
        </div>
      </form>

      {total > rows.length ? (
        <p className="text-sm text-muted-foreground">
          Showing the first {rows.length} of {total}. Narrow the filters to find a particular question.
        </p>
      ) : null}

      <QuestionPicker
        assessmentId={id}
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
