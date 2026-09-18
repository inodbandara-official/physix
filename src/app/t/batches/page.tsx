import type { Metadata } from 'next';
import Link from 'next/link';
import { Layers } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { BatchCard } from '@/features/batches/components/batch-card';
import { BatchFormDialog } from '@/features/batches/components/batch-form-dialog';
import { listBatches } from '@/features/batches/queries';
import { requireTeacher } from '@/lib/auth/session';
import { pluralize } from '@/lib/format';

export const metadata: Metadata = { title: 'Batches' };

export default async function BatchesPage(props: PageProps<'/t/batches'>) {
  await requireTeacher();
  const searchParams = await props.searchParams;
  const includeArchived = searchParams.archived === 'true';

  const batches = await listBatches(includeArchived);

  // Grouped by A/L year so the page reads like the intake tree the teacher
  // already has in their head: 2026 A/L > Colombo Saturday, Online, …
  const groups = new Map<string, typeof batches>();
  for (const batch of batches) {
    const key = batch.al_year ? `${batch.al_year} A/L` : 'No year set';
    groups.set(key, [...(groups.get(key) ?? []), batch]);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <PageHeader
        title="Batches"
        description="Group students into the classes you actually teach."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={includeArchived ? '/t/batches' : '/t/batches?archived=true'}>
                {includeArchived ? 'Hide archived' : 'Show archived'}
              </Link>
            </Button>
            <BatchFormDialog />
          </>
        }
      />

      {batches.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No batches yet"
          description="Create your first batch — for example “2026 A/L — Colombo Saturday” — then add students to it."
          action={<BatchFormDialog />}
        />
      ) : (
        <div className="space-y-8">
          {sortedGroups.map(([year, groupBatches]) => (
            <section key={year} className="space-y-3">
              <h2 className="flex items-baseline gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {year}
                <span className="text-xs font-normal normal-case">
                  {pluralize(groupBatches.length, 'batch', 'batches')}
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {groupBatches.map((batch) => (
                  <BatchCard key={batch.id} batch={batch} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
