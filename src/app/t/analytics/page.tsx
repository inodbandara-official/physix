import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, AlertTriangle, BarChart3, Users } from 'lucide-react';

import { heatStep } from '@/components/charts/accuracy-bars';
import { TrendChart } from '@/components/charts/trend-chart';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { monthLabel } from '@/features/analytics/components/student-report-view';
import { FLAG_LABELS, MIN_ATTEMPTS_FOR_FLAGS } from '@/features/analytics/compute';
import { getClassReport } from '@/features/analytics/queries';
import { listBatchOptions } from '@/features/batches/queries';
import { periodSince, RANKING_PERIODS, type RankingPeriod } from '@/features/rankings/schema';
import { requireTeacher } from '@/lib/auth/session';
import { formatPercent } from '@/lib/format';

export const metadata: Metadata = { title: 'Analytics' };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function AnalyticsPage(props: PageProps<'/t/analytics'>) {
  await requireTeacher();
  const searchParams = await props.searchParams;
  const pick = (key: string) => (typeof searchParams[key] === 'string' ? (searchParams[key] as string) : undefined);

  const batches = await listBatchOptions();
  const batchParam = pick('batch');
  // Opens on the first batch; "all" widens to every student.
  const batchId =
    batchParam === 'all' ? null : batchParam && UUID.test(batchParam) ? batchParam : (batches[0]?.id ?? null);
  const period = (Object.keys(RANKING_PERIODS).includes(pick('period') ?? '') ? pick('period') : 'all') as RankingPeriod;

  const report = await getClassReport(batchId, periodSince(period));

  const selectClass =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30';

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Where the class is strong and weak, which questions are working, and how results are moving. Every figure shows how many answers it rests on."
      />

      <form method="get" className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="batch" className="text-xs text-muted-foreground">
            Batch
          </Label>
          <select id="batch" name="batch" defaultValue={batchId ?? 'all'} className={selectClass}>
            <option value="all">All students</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="period" className="text-xs text-muted-foreground">
            Period
          </Label>
          <select id="period" name="period" defaultValue={period} className={selectClass}>
            {(Object.keys(RANKING_PERIODS) as RankingPeriod[]).map((key) => (
              <option key={key} value={key}>
                {RANKING_PERIODS[key].label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" className="w-full">
            Show
          </Button>
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Students active"
          value={`${report.activeStudents} / ${report.students.length}`}
          hint="Finished at least one test or practice"
          icon={Users}
        />
        <StatCard label="Attempts finished" value={report.attempts} icon={Activity} />
        <StatCard
          label="Average test score"
          value={formatPercent(report.summary.mean)}
          hint={report.summary.median !== null ? `Median ${formatPercent(report.summary.median)}` : undefined}
          icon={BarChart3}
        />
        <StatCard
          label="Spread"
          value={report.summary.standardDeviation === null ? '—' : `±${report.summary.standardDeviation}`}
          hint="Standard deviation, percentage points"
          icon={BarChart3}
        />
      </section>

      {report.attempts === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No finished attempts in this view"
          description="Analytics fill in as students finish tests and past-paper practice."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Topic heatmap</CardTitle>
              <CardDescription>
                Accuracy per student per unit; darker is stronger. The small number is how many questions the cell
                rests on — read a cell of 2 as a hint, not a verdict.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0.5 text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className="sticky left-0 bg-card px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                        Student
                      </th>
                      {report.units.map((unit) => (
                        <th key={unit.id} scope="col" className="min-w-24 px-2 py-2 text-left align-bottom text-xs font-medium text-muted-foreground">
                          {unit.name}
                        </th>
                      ))}
                      <th scope="col" className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                        Overall
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.students.map((student) => {
                      const cells = report.heatmap.get(student.id);
                      const overall = report.studentOverall.get(student.id);
                      return (
                        <tr key={student.id}>
                          <th scope="row" className="sticky left-0 bg-card px-2 py-1.5 text-left font-medium whitespace-nowrap">
                            <Link href={`/t/students/${student.id}/progress`} className="hover:underline">
                              {student.name}
                            </Link>
                          </th>
                          {report.units.map((unit) => {
                            const cell = cells?.get(unit.id);
                            const step = heatStep(cell?.accuracy ?? null);
                            return (
                              <td
                                key={unit.id}
                                data-heat={step ?? undefined}
                                className="rounded-md px-2 py-1.5 tabular-nums"
                                title={cell ? `${student.name} · ${unit.name}: ${cell.accuracy}% on ${cell.questions} questions` : undefined}
                              >
                                {cell ? (
                                  <>
                                    <span className="font-medium">{cell.accuracy}%</span>
                                    <span className="ml-1 text-[0.7rem] opacity-75">{cell.questions}</span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                            {formatPercent(overall?.accuracy ?? null)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <th scope="row" className="sticky left-0 bg-card px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                        Class
                      </th>
                      {report.units.map((unit) => (
                        <td key={unit.id} className="px-2 py-2 text-xs font-semibold tabular-nums">
                          {formatPercent(report.unitOverall.get(unit.id)?.accuracy ?? null)}
                        </td>
                      ))}
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Class average by month</CardTitle>
                <CardDescription>Mean test score of attempts finished each month. Past-paper practice is left out.</CardDescription>
              </CardHeader>
              <CardContent>
                {report.timeline.length < 2 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">A trend appears once there are results in two months.</p>
                ) : (
                  <>
                    <TrendChart
                      ariaLabel="Class average by month"
                      points={report.timeline.map((point) => ({
                        label: monthLabel(point.month, 'en'),
                        value: point.average,
                        detail: `${point.attempts} attempts`,
                      }))}
                    />
                    <table className="sr-only">
                      <tbody>
                        {report.timeline.map((point) => (
                          <tr key={point.month}>
                            <th scope="row">{monthLabel(point.month, 'en')}</th>
                            <td>{point.average}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Weakest topics</CardTitle>
                <CardDescription>Under 60% across the class, on at least 10 answered questions.</CardDescription>
              </CardHeader>
              <CardContent>
                {report.weak.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No topic falls below the line on enough evidence.</p>
                ) : (
                  <ol className="space-y-3">
                    {report.weak.map((topic) => (
                      <li key={topic.topicId} className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                        <div>
                          <p className="font-medium">{topic.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPercent(topic.accuracy)} · {topic.questions} questions answered
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Questions worth a second look</CardTitle>
              <CardDescription>
                Flagged after at least {MIN_ATTEMPTS_FOR_FLAGS} attempts: answered fully correctly by 90%+ (too easy),
                by 25% or fewer (too hard), skipped by a quarter, or answered wrongly by most who tried.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing flagged in this view.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Question</TableHead>
                        <TableHead className="text-right">Attempts</TableHead>
                        <TableHead className="text-right">Fully correct</TableHead>
                        <TableHead className="text-right">Skipped</TableHead>
                        <TableHead>Flags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.questions.map((question) => (
                        <TableRow key={question.questionId}>
                          <TableCell className="max-w-sm">
                            <Link href={`/t/questions/${question.questionId}`} className="font-medium hover:underline">
                              {question.code}
                            </Link>{' '}
                            <span className="text-sm text-muted-foreground">{question.title}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{question.attempts}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPercent(question.correctRate)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPercent(question.skipRate)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {question.flags.map((flag) => (
                                <Badge key={flag} variant="outline" className="font-normal">
                                  {FLAG_LABELS[flag]}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
