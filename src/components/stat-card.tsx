import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  /** Shown instead of a value when the underlying feature has no data yet. */
  pending?: boolean;
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, pending, className }: StatCardProps) {
  return (
    <Card className={cn('h-full', className)}>
      <CardContent className="flex h-full items-start gap-4 p-5">
        {Icon ? (
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4.5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              'text-2xl font-semibold tabular-nums tracking-tight',
              pending && 'text-xl font-normal text-muted-foreground',
            )}
          >
            {pending ? 'Not yet available' : value}
          </p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
