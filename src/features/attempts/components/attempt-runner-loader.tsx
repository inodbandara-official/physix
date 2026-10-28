'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';

import type { RunnerProps } from './runner-types';

/**
 * The runner renders in the browser only. It restores answers the device
 * has not yet sent, which exist only in localStorage; rendering it on the
 * server as well would produce markup the browser then contradicts.
 */
const AttemptRunner = dynamic(() => import('./attempt-runner').then((module) => module.AttemptRunner), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  ),
});

export function AttemptRunnerLoader(props: RunnerProps) {
  return <AttemptRunner {...props} />;
}
