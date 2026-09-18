'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StudentFiltersProps {
  batches: { id: string; name: string; al_year: number | null }[];
}

const ANY = 'any';

/**
 * Filters live in the URL, so every list view is shareable, bookmarkable and
 * survives a refresh — and the filtering itself happens in Postgres, not here.
 */
export function StudentFilters({ batches }: StudentFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const term = searchParams.get('q') ?? '';

  const apply = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === ANY) params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    startTransition(() => router.push(`/t/students?${params.toString()}`));
  };

  const hasFilters = ['q', 'batch', 'status', 'archived', 'contact'].some((key) => searchParams.get(key));

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <form
        className="flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          const entered = new FormData(event.currentTarget).get('q');
          apply({ q: String(entered ?? '').trim() || undefined });
        }}
      >
        <Label htmlFor="student-search" className="sr-only">
          Search students
        </Label>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          {/* Uncontrolled, keyed by the URL: navigating (or clearing filters)
              remounts it with the right value, so no effect has to sync it. */}
          <Input
            key={term}
            id="student-search"
            name="q"
            defaultValue={term}
            placeholder="Search by name, Student ID, username or school"
            className="pl-9"
            type="search"
          />
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-batch" className="text-xs text-muted-foreground">
            Batch
          </Label>
          <Select
            value={searchParams.get('batch') ?? ANY}
            onValueChange={(value) => apply({ batch: value })}
          >
            <SelectTrigger id="filter-batch" className="w-full">
              <SelectValue placeholder="All batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All batches</SelectItem>
              {batches.map((batch) => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.al_year ? `${batch.al_year} — ${batch.name}` : batch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-status" className="text-xs text-muted-foreground">
            Status
          </Label>
          <Select
            value={searchParams.get('status') ?? ANY}
            onValueChange={(value) => apply({ status: value })}
          >
            <SelectTrigger id="filter-status" className="w-full">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-contact" className="text-xs text-muted-foreground">
            Email
          </Label>
          <Select
            value={searchParams.get('contact') ?? 'any'}
            onValueChange={(value) => apply({ contact: value === 'any' ? undefined : value })}
          >
            <SelectTrigger id="filter-contact" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="with-email">Has an email</SelectItem>
              <SelectItem value="without-email">No email</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-archived" className="text-xs text-muted-foreground">
            Records
          </Label>
          <Select
            value={searchParams.get('archived') ?? 'active'}
            onValueChange={(value) => apply({ archived: value === 'active' ? undefined : value })}
          >
            <SelectTrigger id="filter-archived" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">On the roll</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">Everyone</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startTransition(() => router.push('/t/students'))}
          disabled={isPending}
        >
          <X className="size-4" aria-hidden />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
