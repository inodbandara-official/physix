'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { Archive, ArchiveRestore, CalendarClock, MoreHorizontal, PencilLine, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { archiveBatchAction } from '@/features/batches/actions';
import type { BatchWithCounts } from '@/features/batches/queries';
import { pluralize } from '@/lib/format';
import { runWithToast } from '@/lib/run-action';

import { BatchFormDialog } from './batch-form-dialog';

export function BatchCard({ batch }: { batch: BatchWithCounts }) {
  const [isPending, startTransition] = useTransition();
  const archived = batch.archived_at !== null;

  return (
    <Card className={archived ? 'opacity-70' : undefined}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/t/batches/${batch.id}`} className="font-medium hover:underline">
              {batch.name}
            </Link>
            <p className="text-xs text-muted-foreground">
              {batch.al_year ? `${batch.al_year} A/L` : 'No year set'}
              {batch.code ? ` · ${batch.code}` : ''}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isPending} aria-label={`Actions for ${batch.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <BatchFormDialog
                batch={batch}
                trigger={
                  <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                    <PencilLine className="size-4" aria-hidden />
                    Edit batch
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuItem
                variant={archived ? 'default' : 'destructive'}
                onSelect={() =>
                  startTransition(() => runWithToast(() => archiveBatchAction(batch.id, !archived)))
                }
              >
                {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
                {archived ? 'Restore batch' : 'Archive batch'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="size-4" aria-hidden />
            {pluralize(batch.member_count, 'student')}
          </span>
          {batch.schedule_note ? (
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-4" aria-hidden />
              {batch.schedule_note}
            </span>
          ) : null}
          {archived ? <Badge variant="outline">Archived</Badge> : null}
        </div>
      </CardContent>
    </Card>
  );
}
