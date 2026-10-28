import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarChart3, Lock, PencilLine, Plus } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AssessmentItems } from '@/features/assessments/components/assessment-items';
import { AssessmentLifecycle } from '@/features/assessments/components/assessment-lifecycle';
import { RandomRuleDialog } from '@/features/assessments/components/random-rule-dialog';
import { getAssessmentDetail } from '@/features/assessments/queries';
import { ASSESSMENT_KIND_LABELS, NEGATIVE_MARKING_OPTIONS } from '@/features/assessments/types';
import { assessmentWindow, resultsVisible } from '@/features/attempts/scoring';
import { listBatchOptions } from '@/features/batches/queries';
import { flattenSyllabus, getSyllabusTree } from '@/features/syllabus/queries';
import { requireTeacher } from '@/lib/auth/session';
import { formatDateTime } from '@/lib/format';

export async function generateMetadata(props: PageProps<'/t/assessments/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const detail = await getAssessmentDetail(id);
  return { title: detail?.assessment.title ?? 'Assessment' };
}

export default async function AssessmentBuilderPage(props: PageProps<'/t/assessments/[id]'>) {
  await requireTeacher();
  const { id } = await props.params;

  const [detail, tree, batches] = await Promise.all([getAssessmentDetail(id), getSyllabusTree(), listBatchOptions()]);
  if (!detail) notFound();

  const { assessment, items, attemptCount } = detail;
  const nodes = flattenSyllabus(tree);
  const nodeLabels = Object.fromEntries(nodes.map((node) => [node.id, node.label]));
  const batchNames = batches.filter((batch) => detail.batchIds.includes(batch.id)).map((batch) => batch.name);
  const locked = attemptCount > 0;
  const window = assessmentWindow(assessment);
  const held = !resultsVisible(assessment);

  const statusBadge =
    assessment.archived_at !== null ? (
      <Badge variant="secondary">Archived</Badge>
    ) : assessment.status === 'draft' ? (
      <Badge variant="outline">Draft — students cannot see it</Badge>
    ) : window === 'upcoming' ? (
      <Badge variant="secondary">Published · opens {formatDateTime(assessment.opens_at)}</Badge>
    ) : window === 'closed' ? (
      <Badge variant="secondary">Closed</Badge>
    ) : (
      <Badge>Open to students</Badge>
    );

  return (
    <>
      <PageHeader
        title={assessment.title}
        description={ASSESSMENT_KIND_LABELS[assessment.kind]}
        actions={
          <AssessmentLifecycle
            id={assessment.id}
            status={assessment.status}
            archived={assessment.archived_at !== null}
            attemptCount={attemptCount}
            canRelease={held && attemptCount > 0 && !assessment.results_released_at}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {statusBadge}
        {attemptCount > 0 ? (
          <Button asChild variant="link" size="sm" className="h-auto px-1">
            <Link href={`/t/assessments/${assessment.id}/results`}>
              <BarChart3 className="size-4" aria-hidden />
              {attemptCount} {attemptCount === 1 ? 'attempt' : 'attempts'} — see results
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                {detail.questionCount} {detail.questionCount === 1 ? 'question' : 'questions'} per attempt
                {detail.questionCount > 0
                  ? detail.marksCertain
                    ? ` · ${detail.knownMarks} marks`
                    : ` · at least ${detail.knownMarks} marks from fixed items`
                  : ''}
              </CardDescription>
            </div>
            {!locked ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/t/assessments/${assessment.id}/add`}>
                    <Plus className="size-4" aria-hidden />
                    Add questions
                  </Link>
                </Button>
                <RandomRuleDialog assessmentId={assessment.id} nodes={nodes} />
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {locked ? (
              <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                Students have started this assessment, so its questions are fixed — otherwise earlier and later
                attempts would not be comparable. Duplicate it to make a changed version.
              </p>
            ) : null}

            {items.length === 0 ? (
              <EmptyState
                title="No questions yet"
                description="Hand-pick questions from your bank, or add a random rule such as “3 medium Electricity questions” — each student then gets their own selection."
                className="py-10"
              />
            ) : (
              <AssessmentItems
                assessmentId={assessment.id}
                items={items}
                nodeLabels={nodeLabels}
                nodes={nodes}
                locked={locked}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Settings</CardTitle>
              <CardDescription>Times are Sri Lanka time.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/t/assessments/${assessment.id}/edit`}>
                <PencilLine className="size-4" aria-hidden />
                Edit
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <Setting label="Batches" value={batchNames.length ? batchNames.join(', ') : 'None — choose at least one'} />
              <Setting label="Opens" value={assessment.opens_at ? formatDateTime(assessment.opens_at) : 'As soon as published'} />
              <Setting label="Closes" value={assessment.closes_at ? formatDateTime(assessment.closes_at) : 'Never'} />
              <Setting
                label="Time limit"
                value={assessment.time_limit_minutes ? `${assessment.time_limit_minutes} min` : 'Untimed'}
              />
              <Setting
                label="Attempts"
                value={assessment.max_attempts === null ? 'Unlimited' : String(assessment.max_attempts)}
              />
              <Setting
                label="Pass mark"
                value={assessment.pass_percentage === null ? 'None' : `${Number(assessment.pass_percentage)}%`}
              />
              <Setting
                label="Negative marking"
                value={
                  NEGATIVE_MARKING_OPTIONS.find((option) => Number(option.value) === Number(assessment.negative_marking))
                    ?.label ?? String(assessment.negative_marking)
                }
              />
              <Setting
                label="Results"
                value={
                  assessment.show_results_immediately
                    ? 'Straight away'
                    : assessment.results_released_at
                      ? `Released ${formatDateTime(assessment.results_released_at)}`
                      : assessment.closes_at
                        ? 'When it closes'
                        : 'When you release them'
                }
              />
              <Setting
                label="Review"
                value={
                  !assessment.allow_review
                    ? 'Score only'
                    : [
                        'Answers',
                        assessment.show_correct_answers ? 'correct answers' : null,
                        assessment.show_explanations ? 'explanations' : null,
                      ]
                        .filter(Boolean)
                        .join(', ')
                }
              />
              <Setting
                label="Shuffle"
                value={
                  [assessment.shuffle_questions ? 'questions' : null, assessment.shuffle_options ? 'options' : null]
                    .filter(Boolean)
                    .join(' and ') || 'Off'
                }
              />
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
