'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { idleAction, type ActionState } from '@/lib/action';

interface UseActionFormOptions<T> {
  /** Runs after a successful submit — close a dialog, navigate, reset a form. */
  onSuccess?: (result: { data?: T; message: string }) => void;
  /** Set to false where the form renders its own success message instead. */
  toastOnSuccess?: boolean;
}

/**
 * Drives a Server Action from a form and exposes its result.
 *
 * Deliberately not `useActionState` + `useEffect`: reacting to a result inside
 * an effect means closing a dialog or navigating happens a render *after* the
 * state lands, which cascades renders and trips `react-hooks/set-state-in-effect`.
 * Handling the result where it arrives — in the submit transition — keeps the
 * flow readable and the render pass clean.
 *
 * `useFormStatus` still works inside the returned `formAction`, so SubmitButton
 * shows its pending state unchanged.
 */
export function useActionForm<T = undefined>(
  action: (previous: ActionState<T>, formData: FormData) => Promise<ActionState<T>>,
  options: UseActionFormOptions<T> = {},
) {
  const [state, setState] = useState<ActionState<T>>(idleAction);
  const [isPending, startTransition] = useTransition();

  const formAction = (formData: FormData) => {
    startTransition(async () => {
      const result = await action(state, formData);
      setState(result);

      if (result.status !== 'success') return;
      if (options.toastOnSuccess !== false) toast.success(result.message);
      options.onSuccess?.({ data: result.data, message: result.message });
    });
  };

  return { state, formAction, isPending };
}
