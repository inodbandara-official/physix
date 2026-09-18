'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The real error stays server-side; the user only ever sees the message below.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            The page could not be loaded. Try again — if it keeps happening, let your teacher know.
          </p>
        </div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
