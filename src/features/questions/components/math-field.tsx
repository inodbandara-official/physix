'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff, Sigma } from 'lucide-react';

import { MathText } from '@/components/math-text';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * A textarea that can show what the LaTeX in it will look like.
 *
 * The preview is opt-in rather than always-on: a teacher typing a long
 * question does not want the layout shifting under them on every keystroke.
 */

const SNIPPETS: { label: string; insert: string; title: string }[] = [
  { label: 'x²', insert: '$x^2$', title: 'Superscript' },
  { label: 'xᵢ', insert: '$x_i$', title: 'Subscript' },
  { label: '½', insert: '$\\frac{1}{2}$', title: 'Fraction' },
  { label: '√', insert: '$\\sqrt{x}$', title: 'Square root' },
  { label: 'θ', insert: '$\\theta$', title: 'Greek letter' },
  { label: 'v⃗', insert: '$\\vec{v}$', title: 'Vector' },
  { label: '×10ⁿ', insert: '$1.6 \\times 10^{-19}$', title: 'Scientific notation' },
  { label: 'Σ', insert: '$$\\sum_{i=1}^{n} x_i$$', title: 'Display formula' },
];

interface MathFieldProps {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
  errors?: string[];
  required?: boolean;
  className?: string;
}

export function MathField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  hint,
  errors,
  required,
  className,
}: MathFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [showPreview, setShowPreview] = useState(false);
  const hasError = Boolean(errors?.length);

  const insert = (snippet: string) => {
    const field = document.getElementById(fieldId) as HTMLTextAreaElement | null;
    if (!field) {
      onChange(`${value}${snippet}`);
      return;
    }
    const start = field.selectionStart ?? value.length;
    const end = field.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
    onChange(next);
    // Put the caret after the inserted snippet once React has re-rendered.
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={fieldId} className="flex items-center gap-1">
            {label}
            {required ? (
              <span className="text-destructive" aria-hidden>
                *
              </span>
            ) : null}
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setShowPreview((current) => !current)}
            aria-pressed={showPreview}
          >
            {showPreview ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
            Preview
          </Button>
        </div>
      ) : null}

      <Textarea
        id={fieldId}
        name={name}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={hasError || undefined}
        className="font-mono text-sm"
      />

      <div className="flex flex-wrap items-center gap-1">
        <Sigma className="size-3.5 text-muted-foreground" aria-hidden />
        {SNIPPETS.map((snippet) => (
          <Button
            key={snippet.label}
            type="button"
            variant="outline"
            size="xs"
            title={`${snippet.title} — inserts ${snippet.insert}`}
            onClick={() => insert(snippet.insert)}
          >
            {snippet.label}
          </Button>
        ))}
      </div>

      {showPreview ? (
        <div className="rounded-lg border bg-muted/40 p-3">
          {value.trim() === '' ? (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          ) : (
            <MathText className="text-sm">{value}</MathText>
          )}
        </div>
      ) : null}

      {hint && !hasError ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {hasError ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {errors!.join(' ')}
        </p>
      ) : null}
    </div>
  );
}
