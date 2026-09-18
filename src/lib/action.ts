import type { z } from 'zod';

/**
 * The single shape every Server Action returns, so forms can render errors
 * uniformly and `useActionState` stays typed.
 */
export type ActionState<TData = undefined> =
  | { status: 'idle' }
  | { status: 'success'; message: string; data?: TData }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string[]> };

export const idleAction: ActionState<never> = { status: 'idle' };

export function actionError(message: string, fieldErrors?: Record<string, string[]>): ActionState<never> {
  return { status: 'error', message, fieldErrors };
}

export function actionSuccess<T = undefined>(message: string, data?: T): ActionState<T> {
  return { status: 'success', message, data };
}

/** Turns a Zod failure into the field-error map the form components expect. */
export function fromZodError(error: z.ZodError): ActionState<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return actionError('Please correct the highlighted fields.', fieldErrors);
}

/** Reads a FormData into a plain object, dropping blank strings to undefined. */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (key.endsWith('[]')) {
      const name = key.slice(0, -2);
      ((result[name] ??= []) as string[]).push(trimmed);
      continue;
    }
    result[key] = trimmed === '' ? undefined : trimmed;
  }
  return result;
}
