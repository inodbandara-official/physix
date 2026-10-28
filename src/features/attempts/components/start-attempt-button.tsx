'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { startAttemptAction } from '../actions';

export function StartAttemptButton({
  assessmentId,
  label,
  size = 'lg',
  className,
}: {
  assessmentId: string;
  label: string;
  size?: 'default' | 'lg' | 'sm';
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size={size}
      className={className}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await startAttemptAction(assessmentId);
          if (result.status === 'success' && result.data) {
            router.push(`/s/attempt/${result.data.attemptId}`);
          } else if (result.status === 'error') {
            toast.error(result.message);
          }
        })
      }
    >
      {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
      {label}
    </Button>
  );
}
