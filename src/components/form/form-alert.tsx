import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ActionState } from '@/lib/action';

export function FormAlert({ state }: { state: ActionState<unknown> }) {
  if (state.status === 'idle') return null;

  const isError = state.status === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <Alert variant={isError ? 'destructive' : 'default'} role={isError ? 'alert' : 'status'}>
      <Icon className="size-4" aria-hidden />
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
