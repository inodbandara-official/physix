import type { Metadata } from 'next';
import Link from 'next/link';
import { FileStack } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { t, tf } from '@/features/language/labels';
import { PracticeButton, TopicPracticeForm } from '@/features/past-papers/components/practice-controls';
import { getPastPaperBankId, listPastPapers, yearsOf } from '@/features/past-papers/queries';
import { getSyllabusTree } from '@/features/syllabus/queries';
import { nodeName } from '@/features/syllabus/tree';
import { requireStudent } from '@/lib/auth/session';
import { formatDateTime, formatPercent } from '@/lib/format';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Past papers' };

export default async function StudentPastPapersPage() {
  const session = await requireStudent();
  const language = session.profile.language;

  const [papers, tree, bankId] = await Promise.all([listPastPapers(true), getSyllabusTree(), getPastPaperBankId()]);

  const supabase = await createSupabaseServerClient();
  const { data: recent } = bankId
    ? await supabase
        .from('attempts')
        .select('id, status, practice_label, percentage, submitted_at, started_at')
        .eq('assessment_id', bankId)
        .eq('student_id', session.student.id)
        .order('started_at', { ascending: false })
        .limit(6)
    : { data: [] };

  // Units and their topics, for the topic picker.
  const topics = tree.flatMap((unit) => [
    { id: unit.id, label: nodeName(unit, language), depth: 0 },
    ...unit.children.map((topic) => ({ id: topic.id, label: nodeName(topic, language), depth: 1 })),
  ]);

  const byYear = new Map<number, typeof papers>();
  for (const paper of papers) byYear.set(paper.year, [...(byYear.get(paper.year) ?? []), paper]);

  return (
    <>
      <PageHeader title={t('pastPapers', language)} description={t('pastPapersIntro', language)} />

      {papers.length === 0 ? (
        <EmptyState icon={FileStack} title={t('noPapers', language)} description={t('noPapersHint', language)} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {[...byYear].map(([year, yearPapers]) => (
              <section key={year} className="space-y-3">
                <h2 className="text-sm font-semibold tracking-wide text-muted-foreground tabular-nums">{year}</h2>
                <ul className="space-y-3">
                  {yearPapers.map((paper) => (
                    <li key={paper.id} className="space-y-3 rounded-xl border bg-background p-4">
                      <div>
                        <p className="font-medium">{paper.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {tf('questionsCount', language, { n: paper.questionCount })}
                          {paper.description ? ` · ${paper.description}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <PracticeButton
                          language={language}
                          label={t('practiseWhole', language)}
                          filter={{ paper_id: paper.id, label: `${paper.year} ${paper.title}` }}
                        />
                        {paper.sections.map((section) => (
                          <PracticeButton
                            key={section}
                            language={language}
                            variant="outline"
                            label={tf('sectionN', language, { s: section })}
                            filter={{
                              paper_id: paper.id,
                              section,
                              label: `${paper.year} ${paper.title} · ${tf('sectionN', language, { s: section })}`,
                            }}
                          />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('practiseByTopic', language)}</CardTitle>
                <CardDescription>{t('practiceUntimed', language)}</CardDescription>
              </CardHeader>
              <CardContent>
                <TopicPracticeForm years={yearsOf(papers)} topics={topics} language={language} />
              </CardContent>
            </Card>

            {recent && recent.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('recentPractice', language)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {recent.map((attempt) => (
                      <li key={attempt.id}>
                        <Link
                          href={attempt.status === 'in_progress' ? `/s/attempt/${attempt.id}` : `/s/results/${attempt.id}`}
                          className="flex items-center justify-between gap-3 py-2.5 text-sm hover:underline"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{attempt.practice_label ?? t('pastPapers', language)}</span>
                            <span className="block text-xs text-muted-foreground">
                              {formatDateTime(attempt.submitted_at ?? attempt.started_at)}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {attempt.status === 'in_progress'
                              ? t('resume', language)
                              : formatPercent(attempt.percentage === null ? null : Number(attempt.percentage))}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
