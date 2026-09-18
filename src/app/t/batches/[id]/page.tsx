import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PencilLine } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BatchFormDialog } from '@/features/batches/components/batch-form-dialog';
import { BatchMembers } from '@/features/batches/components/batch-members';
import { getBatch, listAssignableStudents, listBatchOptions } from '@/features/batches/queries';
import { requireTeacher } from '@/lib/auth/session';

export async function generateMetadata(props: PageProps<'/t/batches/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const batch = await getBatch(id);
  return { title: batch?.name ?? 'Batch' };
}

export default async function BatchDetailPage(props: PageProps<'/t/batches/[id]'>) {
  await requireTeacher();
  const { id } = await props.params;

  const [batch, assignable, allBatches] = await Promise.all([
    getBatch(id),
    listAssignableStudents(id),
    listBatchOptions(),
  ]);

  if (!batch) notFound();

  const withAccounts = batch.members.filter((member) => member.has_account).length;

  return (
    <>
      <PageHeader
        title={batch.name}
        description={
          [batch.al_year ? `${batch.al_year} A/L` : null, batch.schedule_note, batch.description]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        actions={
          <BatchFormDialog
            batch={batch}
            trigger={
              <Button variant="outline">
                <PencilLine className="size-4" aria-hidden />
                Edit batch
              </Button>
            }
          />
        }
      />

      {batch.archived_at ? <Badge variant="outline">Archived</Badge> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Students" value={batch.member_count} />
        <StatCard label="Active" value={batch.active_member_count} />
        <StatCard
          label="Can sign in"
          value={withAccounts}
          hint={
            withAccounts < batch.member_count
              ? `${batch.member_count - withAccounts} still need login details`
              : 'Everyone has an account'
          }
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Add, remove or move students between batches.</CardDescription>
        </CardHeader>
        <CardContent>
          <BatchMembers
            batchId={batch.id}
            members={batch.members}
            assignable={assignable}
            otherBatches={allBatches.filter((option) => option.id !== batch.id)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Batch performance</CardTitle>
            <CardDescription>Averages, ranking and topic strengths for this batch.</CardDescription>
          </div>
          <Badge variant="secondary">Phase 4</Badge>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No assessment data yet"
            description="Run an assessment with this batch and its results will be summarised here."
          />
        </CardContent>
      </Card>
    </>
  );
}
