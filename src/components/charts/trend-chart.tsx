'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface TrendPoint {
  label: string;
  value: number;
  /** Shown in the tooltip as the sample behind the point. */
  detail?: string;
}

/**
 * A single series over time, on one 0–100% axis.
 *
 * One series, so no legend: the card title names it. Every point carries
 * a tooltip with its value and sample size, and the caller renders the
 * same numbers as a table for screen readers.
 */
export function TrendChart({ points, ariaLabel }: { points: TrendPoint[]; ariaLabel: string }) {
  return (
    <div className="h-56 w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--viz-axis)', fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--viz-axis)', fontSize: 12 }}
            tickFormatter={(value: number) => `${value}%`}
          />
          <Tooltip
            cursor={{ stroke: 'var(--viz-axis)', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as TrendPoint | undefined;
              if (!active || !point) return null;
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                  <p className="font-medium">{point.label}</p>
                  <p className="tabular-nums">{point.value}%</p>
                  {point.detail ? <p className="text-muted-foreground">{point.detail}</p> : null}
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--viz-series)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--viz-series)', stroke: 'var(--background)', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'var(--viz-series)', stroke: 'var(--background)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
