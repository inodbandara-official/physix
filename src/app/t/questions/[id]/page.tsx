import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { History, PencilLine } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { MathText, mathToPlainText } from '@/components/math-text';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DifficultyBadge,
  MarksBadge,
  QuestionStatusBadge,
  QuestionTypeBadge,
} from '@/features/questions/components/question-badges';
import { QuestionPreview } from '@/features/questions/components/question-preview';
import {
  collectFigurePaths,
  getQuestion,
  getQuestionVersion,
  signFigureUrls,
} from '@/features/questions/queries';
import { isAutoMarked } from '@/features/questions/types';
import { flattenSyllabus, getSyllabusTree } from '@/features/syllabus/queries';
import { requireTeacher } from '@/lib/auth/session';
import { formatDateTime } from '@/lib/format';

export async function generateMetadata(props: PageProps<'/t/questions/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const detail = await getQuestion(id);
  if (!detail) return { title: 'Question' };
  return { title: detail.current.title || mathToPlainText(detail.current.stem, 60) };
}

export default async function QuestionDetailPage(props: PageProps<'/t/questions/[id]'>) {
  await requireTeacher();
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const detail = await getQuestion(id);
  if (!detail) notFound();

  const { question, current, versions, tags } = detail;

  // `?version=` shows a superseded version exactly as it was, which is what
  // makes a past attempt reviewable.
  const requestedId = typeof searchParams.version === 'string' ? searchParams.version : null;
  const viewing =
    requestedId && requestedId !== current.id ? ((await getQuestionVersion(requestedId)) ?? current) : current;
  const isHistorical = viewing.id !== current.id;

  const [figureUrls, tree] = await Promise.all([
    signFigureUrls(collectFigurePaths(viewing)),
    getSyllabusTree(),
  ]);

  const nodeLabel = viewing.syllabus_node_id
    ? flattenSyllabus(tree).find((node) => node.id === viewing.syllabus_node_id)?.label
    : null;

  return (
    <>
      <PageHeader
        title={current.title || mathToPlainText(current.stem, 70)}
        description={`${question.question_code} · version ${current.version_number}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/t/questions/${question.id}/edit`}>
              <PencilLine className="size-4" aria-hidden />
              Edit
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <QuestionStatusBadge status={question.archived_at ? 'archived' : question.status} />
        <QuestionTypeBadge type={viewing.type} />
        <DifficultyBadge difficulty={viewing.difficulty} />
        <MarksBadge marks={viewing.marks} />
        {nodeLabel ? (
          <Badge variant="secondary" className="font-normal">
            {nodeLabel}
          </Badge>
        ) : null}
        {!isAutoMarked(viewing.body) ? <Badge variant="outline">Marked by hand</Badge> : null}
        {tags.map((tag) => (
          <Badge key={tag} variant="outline" className="font-normal">
            {tag}
          </Badge>
        ))}
      </div>

      {isHistorical ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/8 px-4 py-3">
          <p className="text-sm">
            Showing version {viewing.version_number}, which has been superseded. This is what students who
            sat it at the time saw.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href={`/t/questions/${question.id}`}>Back to current version</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>As students see it</CardTitle>
              <CardDescription>With the answer key revealed, which students never get.</CardDescription>
            </CardHeader>
            <CardContent>
              <QuestionPreview
                stem={viewing.stem}
                body={viewing.body}
                marks={viewing.marks}
                figures={viewing.figures}
                figureUrls={figureUrls}
                revealAnswers
              />
            </CardContent>
          </Card>

          {viewing.explanation || viewing.solution || viewing.hint || viewing.common_mistake ? (
            <Card>
              <CardHeader>
                <CardTitle>Explanation and solution</CardTitle>
                <CardDescription>
                  Shown to students only where you enable explanations on the assessment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {viewing.explanation ? (
                  <Section title="Explanation">
                    <MathText>{viewing.explanation}</MathText>
                  </Section>
                ) : null}
                {viewing.solution ? (
                  <Section title="Worked solution">
                    <MathText>{viewing.solution}</MathText>
                  </Section>
                ) : null}
                {viewing.hint ? (
                  <Section title="Hint">
                    <MathText>{viewing.hint}</MathText>
                  </Section>
                ) : null}
                {viewing.common_mistake ? (
                  <Section title="Common mistake">
                    <MathText>{viewing.common_mistake}</MathText>
                  </Section>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" aria-hidden />
                Version history
              </CardTitle>
              <CardDescription>
                Editing a published question creates a new version. Old versions stay exactly as they were,
                so results already recorded never change.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {versions.map((version) => {
                  const isCurrent = version.id === current.id;
                  const isViewing = version.id === viewing.id;
                  return (
                    <li key={version.id}>
                      <Link
                        href={
                          isCurrent
                            ? `/t/questions/${question.id}`
                            : `/t/questions/${question.id}?version=${version.id}`
                        }
                        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          isViewing ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                        }`}
                        aria-current={isViewing ? 'true' : undefined}
                      >
                        <span className="font-medium">
                          Version {version.version_number}
                          {isCurrent ? ' · current' : ''}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(version.created_at)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {viewing.source || viewing.source_year || viewing.paper_reference || viewing.estimated_seconds ? (
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  {viewing.source ? <Detail label="Source" value={viewing.source} /> : null}
                  {viewing.source_year ? <Detail label="Year" value={String(viewing.source_year)} /> : null}
                  {viewing.paper_reference ? <Detail label="Paper" value={viewing.paper_reference} /> : null}
                  {viewing.estimated_seconds ? (
                    <Detail label="Estimated time" value={`${Math.round(viewing.estimated_seconds / 15) * 0.25} min`} />
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {viewing.teacher_notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Your notes</CardTitle>
                <CardDescription>Never shown to students.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{viewing.teacher_notes}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Question performance</CardTitle>
                <CardDescription>How students actually do on this question.</CardDescription>
              </div>
              <Badge variant="secondary">Phase 4</Badge>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="No attempts yet"
                description="Once this question has been answered, its attempt count, success rate and average time appear here — the data that tells you whether the question itself is working."
                className="py-8"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
