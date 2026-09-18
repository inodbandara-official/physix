'use client';

import { toast } from 'sonner';

import type { ActionState } from '@/lib/action';

/**
 * Runs a Server Action invoked from a button (rather than a form) and reports
 * the outcome as a toast. Keeps the same success/error contract everywhere, so
 * no component has to re-derive it.
 */
export async function runWithToast(action: () => Promise<ActionState<unknown>>): Promise<void> {
  const result = await action();
  if (result.status === 'error') toast.error(result.message);
  else if (result.status === 'success') toast.success(result.message);
}
