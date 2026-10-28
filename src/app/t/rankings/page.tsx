import type { Metadata } from 'next';
import Link from 'next/link';
import { Info, Settings2, Trophy } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MIN_QUESTIONS } from '@/features/analytics/compute';
import { getClassReport } from '@/features/analytics/queries';
import { listBatchOptions } from '@/features/batches/queries';
import { describeBasis } from '@/features/rankings/engine';
import { getTeacherRanking } from '@/features/rankings/queries';
import { BASIS_LABELS, periodSince, RANKING_PERIODS, VISIBILITY_LABELS, type RankingPeriod } from '@/features/rankings/schema';
import { getSyllabusTree } from '@/features/syllabus/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Rankings' };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function RankingsPage(props: PageProps<'/t/rankings'>) {
  await requireTeacher();
  const searchParams = await props.searchParams;
  const pick = (key: string) => (typeof searchParams[key] === 'string' ? (searchParams[key] as string) : undefined);

  const batches = await listBatchOptions();
  const batchParam = pick('batch');
  const batchId = batchParam && UUID.test(batchParam) ? batchParam : null;
  const period = (Object.keys(RANKING_PERIODS).includes(pick('period') ?? '') ? pick('period') : 'all') as RankingPeriod;
  const unitParam = pick('unit');
  const unitId = unitParam && UUID.test(unitParam) ? unitParam : null;
  const since = periodSince(period);

  const [tree, ranking] = await Promise.all([getSyllabusTree(), getTeacherRanking({ batchId, since })]);
  const units = tree.map((unit) => ({ id: unit.id, name: unit.name }));
  const { settings, rows } = ranking;
  const unitName = unitId ? units.find((unit) => unit.id === unitId)?.name : null;

  // Topic ranking: accuracy in one unit, with enough questions to mean something.
  const topicRows = unitId ? await topicRanking(batchId, since, unitId) : null;

  const selectClass =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30';
  const ranked = rows.filter((row) => row.rank !== null);
  const unranked = rows.filter((row) => row.rank === null);
  const unit = settings.basis === 'total' ? ' marks' : '%';

  return (
    <>
      <PageHeader
        title="Rankings"
        description="Every rule is visible: what counts, how ties are broken, and what students are shown."
        actions={
          <Button asChild variant="outline">
            <Link href="/t/rankings/settings">
              <Settings2 className="size-4" aria-hidden />
              Settings
            </Link>
          </Button>
        }
      />

      <form method="get" className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="batch" className="text-xs text-muted-foreground">
            Batch
          </Label>
          <select id="batch" name="batch" defaultValue={batchId ?? ''} className={selectClass}>
            <option value="">All batches (overall)</option>
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
        <div className="space-y-1.5">
          <Label htmlFor="unit" className="text-xs text-muted-foreground">
            Rank by
          </Label>
          <select id="unit" name="unit" defaultValue={unitId ?? ''} className={selectClass}>
            <option value="">Overall ({BASIS_LABELS[settings.basis].toLowerCase()})</option>
            {units.map((item) => (
              <option key={item.id} value={item.id}>
                Topic: {item.name}
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

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {unitId
            ? `Accuracy in ${unitName} — marks earned over marks available on its questions. Students with fewer than ${MIN_QUESTIONS} questions in it are not ranked.`
            : describeBasis(settings.config)}{' '}
          Equal scores share a rank. Only results students can already see are counted. Students see:{' '}
          {VISIBILITY_LABELS[settings.student_visibility].split(' — ')[0].toLowerCase()}.
        </span>
      </p>

      {topicRows ? (
        topicRows.length === 0 ? (
          <EmptyState icon={Trophy} title="Not enough answers in this topic yet" />
        ) : (
          <RankTable
            rows={topicRows.map((row) => ({ ...row, detail: `${row.questions} questions` }))}
            scoreLabel="Accuracy"
            unit="%"
          />
        )
      ) : ranked.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No one is ranked yet"
          description="Students appear once a counted test (weight above 0) has released results."
        />
      ) : (
        <RankTable
          rows={ranked.map((row) => ({
            studentId: row.studentId,
            rank: row.rank!,
            name: row.name,
            code: row.code,
            score: row.score!,
            detail: `${row.counted} counted${row.missed ? `, ${row.missed} missed` : ''}`,
          }))}
          scoreLabel="Score"
          unit={unit}
        />
      )}

      {!topicRows && unranked.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Not ranked yet ({unranked.length}): {unranked.map((row) => row.name).join(', ')}.
        </p>
      ) : null}
    </>
  );
}

function RankTable({
  rows,
  scoreLabel,
  unit,
}: {
  rows: { studentId: string; rank: number; name: string; code: string; score: number; detail: string }[];
  scoreLabel: string;
  unit: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Student</TableHead>
            <TableHead className="text-right">{scoreLabel}</TableHead>
            <TableHead className="text-right">Based on</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.studentId}>
              <TableCell className="font-semibold tabular-nums">#{row.rank}</TableCell>
              <TableCell>
                <Link href={`/t/students/${row.studentId}/progress`} className="font-medium hover:underline">
                  {row.name}
                </Link>
                <p className="text-xs text-muted-foreground">{row.code}</p>
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {row.score}
                {unit}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">{row.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

async function topicRanking(batchId: string | null, since: string | null, unitId: string) {
  const report = await getClassReport(batchId, since);
  const scored = report.students
    .map((student) => {
      const accuracy = report.heatmap.get(student.id)?.get(unitId);
      return { student, accuracy: accuracy?.accuracy ?? null, questions: accuracy?.questions ?? 0 };
    })
    .filter((row) => row.accuracy !== null && row.questions >= MIN_QUESTIONS)
    .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));

  let previous: number | null = null;
  let previousRank = 0;
  return scored.map((row, index) => {
    const rank: number = previous !== null && row.accuracy === previous ? previousRank : index + 1;
    previous = row.accuracy;
    previousRank = rank;
    return {
      studentId: row.student.id,
      rank,
      name: row.student.name,
      code: row.student.code,
      score: row.accuracy ?? 0,
      questions: row.questions,
    };
  });
}
