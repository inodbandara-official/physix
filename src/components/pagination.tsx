import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  /** Current query string without the `page` key, e.g. `q=nimal&status=active`. */
  baseQuery: string;
  basePath: string;
}

export function Pagination({ page, pageCount, total, perPage, baseQuery, basePath }: PaginationProps) {
  if (total === 0) return null;

  const href = (target: number) => {
    const params = new URLSearchParams(baseQuery);
    params.set('page', String(target));
    return `${basePath}?${params.toString()}`;
  };

  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing <span className="font-medium text-foreground">{first}</span>–
        <span className="font-medium text-foreground">{last}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev">
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Link>
          ) : (
            <span>
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </span>
          )}
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {page} / {pageCount}
        </span>
        <Button variant="outline" size="sm" asChild={page < pageCount} disabled={page >= pageCount}>
          {page < pageCount ? (
            <Link href={href(page + 1)} rel="next">
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span>
              Next
              <ChevronRight className="size-4" aria-hidden />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
