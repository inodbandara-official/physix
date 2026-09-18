import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-lg font-semibold">We couldn’t find that page</h1>
        <p className="text-sm text-muted-foreground">
          It may have been archived, or the link may be out of date.
        </p>
        <Button asChild>
          <Link href="/">Back to your dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
