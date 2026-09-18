import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FieldProps {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Wraps a control with its label, hint and server-side error messages.
 * Errors come from the Server Action result, so the same validation that
 * protects the database drives the UI — there is no second client-only schema.
 */
export function Field({ name, label, hint, errors, required, className, children }: FieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const hasError = Boolean(errors?.length);

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={name} className="flex items-center gap-1">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      <div
        data-invalid={hasError || undefined}
        aria-describedby={cn(hint && hintId, hasError && errorId) || undefined}
      >
        {children}
      </div>
      {hint && !hasError ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {errors!.join(' ')}
        </p>
      ) : null}
    </div>
  );
}
