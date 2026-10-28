import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface AccuracyRow {
  key: string;
  label: string;
  accuracy: number | null;
  /** Sample size, always shown: 3 questions is not 300. */
  questions: number;
  /** Below the weak threshold with enough evidence. Marked with an icon, never colour alone. */
  weak?: boolean;
}

/**
 * Labelled horizontal bars on a shared 0–100 scale. Plain HTML: every
 * value is printed beside its bar, so the chart is its own table.
 */
export function AccuracyBars({ rows, basedOnLabel }: { rows: AccuracyRow[]; basedOnLabel: (n: number) => string }) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 font-medium">
              {row.weak ? <AlertTriangle className="size-3.5 shrink-0 text-amber-600" aria-label="Needs attention" /> : null}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {row.accuracy === null ? '—' : `${row.accuracy}%`}
              <span className="ml-2 text-xs text-muted-foreground">{basedOnLabel(row.questions)}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className={cn('h-full rounded-full')}
              style={{ width: `${Math.max(0, Math.min(100, row.accuracy ?? 0))}%`, background: 'var(--viz-series)' }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Which ramp step a 0–100 value falls on, for heat cells. */
export function heatStep(value: number | null): number | null {
  if (value === null) return null;
  return Math.min(6, Math.max(0, Math.floor(value / (100 / 7))));
}
