import Link from 'next/link';

import { AccuracyBars } from '@/components/charts/accuracy-bars';
import { DistributionChart } from '@/components/charts/distribution-chart';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPercent } from '@/lib/format';

import { FLAG_LABELS, histogram } from '../compute';
import type { AssessmentAnalytics } from '../queries';

/** §28: participation, centre, spread, distribution, topics and questions for one assessment. */
export function AssessmentAnalyticsView({ analytics }: { analytics: AssessmentAnalytics }) {
  const { summary } = analytics;
  if (summary.count === 0) return null;

  const bins = histogram(analytics.percentages);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Score distribution</CardTitle>
            <CardDescription>Each student’s best finished attempt, in ten-point bands.</CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionChart
              ariaLabel="Score distribution"
              bins={bins.map((bin) => ({ label: bin.label, count: bin.count }))}
            />
            <table className="sr-only">
              <tbody>
                {bins.map((bin) => (
                  <tr key={bin.label}>
                    <th scope="row">{bin.label}%</th>
                    <td>{bin.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Stat label="Participation" value={analytics.assigned > 0 ? `${analytics.participated} / ${analytics.assigned}` : String(analytics.participated)} />
              <Stat label="Mean" value={formatPercent(summary.mean)} />
              <Stat label="Median" value={formatPercent(summary.median)} />
              <Stat label="Standard deviation" value={summary.standardDeviation === null ? '—' : `${summary.standardDeviation} pts`} />
              <Stat label="Highest" value={formatPercent(summary.highest)} />
              <Stat label="Lowest" value={formatPercent(summary.lowest)} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>By unit</CardTitle>
            <CardDescription>Weakest first.</CardDescription>
          </CardHeader>
          <CardContent>
            <AccuracyBars
              basedOnLabel={(n) => `${n} answers`}
              rows={analytics.units.map((unit) => ({
                key: unit.id,
                label: unit.name,
                accuracy: unit.accuracy.accuracy,
                questions: unit.accuracy.questions,
              }))}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>By question</CardTitle>
            <CardDescription>Hardest first. Random rules mean not every student met every question.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead className="text-right">Answered by</TableHead>
                    <TableHead className="text-right">Fully correct</TableHead>
                    <TableHead className="text-right">Avg marks</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.questions.map((question) => (
                    <TableRow key={question.questionId}>
                      <TableCell className="max-w-56">
                        <Link href={`/t/questions/${question.questionId}`} className="font-medium hover:underline">
                          {question.code}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{question.title}</p>
                        {question.flags.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {question.flags.map((flag) => (
                              <Badge key={flag} variant="outline" className="font-normal">
                                {FLAG_LABELS[flag]}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{question.attempts}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(question.correctRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {question.averageMarks ?? '—'} / {question.maxMarks}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(question.skipRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
