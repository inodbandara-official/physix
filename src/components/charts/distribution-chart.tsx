'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface DistributionBin {
  label: string;
  count: number;
}

/**
 * How many students scored in each ten-point band. Bars are thin with a
 * gap between them and rounded only at the data end, so the baseline
 * reads as a baseline.
 */
export function DistributionChart({ bins, ariaLabel }: { bins: DistributionBin[]; ariaLabel: string }) {
  const max = Math.max(1, ...bins.map((bin) => bin.count));

  return (
    <div className="h-56 w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="12%">
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--viz-axis)', fontSize: 11 }}
            interval={0}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, max]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--viz-axis)', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--viz-grid)', opacity: 0.5 }}
            content={({ active, payload }) => {
              const bin = payload?.[0]?.payload as DistributionBin | undefined;
              if (!active || !bin) return null;
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                  <p className="font-medium">{bin.label}%</p>
                  <p className="tabular-nums">
                    {bin.count} {bin.count === 1 ? 'student' : 'students'}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" fill="var(--viz-series)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
