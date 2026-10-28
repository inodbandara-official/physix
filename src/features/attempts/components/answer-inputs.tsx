'use client';

import { Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { t, tf } from '@/features/language/labels';
import type { SimpleResponse } from '@/features/questions/marking/mark-question';
import { cn } from '@/lib/utils';
import type { ContentLanguage } from '@/types/database';

import type { RunnerInput } from './runner-types';

interface AnswerInputProps {
  /** Unique per question (and part), so radio groups never collide. */
  name: string;
  input: RunnerInput;
  value: SimpleResponse | null;
  onChange: (value: SimpleResponse | null) => void;
  language: ContentLanguage;
  disabled?: boolean;
}

/**
 * One answer control per question kind. Native inputs underneath, so
 * keyboard use, screen readers and a phone's own pickers all work without
 * any help.
 */
export function AnswerInput({ name, input, value, onChange, language, disabled }: AnswerInputProps) {
  switch (input.kind) {
    case 'mcq': {
      const chosen = value?.kind === 'mcq' ? value.optionId : null;
      return (
        <div className="space-y-3">
          <div role="radiogroup" aria-label={t('yourAnswer', language)} className="space-y-2">
            {input.options.map((option) => (
              <ChoiceRow
                key={option.id}
                type="radio"
                name={name}
                letter={option.letter}
                checked={chosen === option.id}
                disabled={disabled}
                onChange={() => onChange({ kind: 'mcq', optionId: option.id })}
              >
                {option.content}
              </ChoiceRow>
            ))}
          </div>
          {chosen ? <ClearButton language={language} onClick={() => onChange(null)} disabled={disabled} /> : null}
        </div>
      );
    }

    case 'multi': {
      const chosen = value?.kind === 'multi' ? value.optionIds : [];
      return (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm text-muted-foreground">{t('selectAll', language)}</legend>
          {input.options.map((option) => (
            <ChoiceRow
              key={option.id}
              type="checkbox"
              name={name}
              letter={option.letter}
              checked={chosen.includes(option.id)}
              disabled={disabled}
              onChange={(checked) => {
                const next = checked ? [...chosen, option.id] : chosen.filter((id) => id !== option.id);
                onChange(next.length > 0 ? { kind: 'multi', optionIds: next } : null);
              }}
            >
              {option.content}
            </ChoiceRow>
          ))}
        </fieldset>
      );
    }

    case 'true_false': {
      const chosen = value?.kind === 'true_false' ? value.value : null;
      return (
        <div className="space-y-3">
          <div role="radiogroup" aria-label={t('yourAnswer', language)} className="grid max-w-md grid-cols-2 gap-2">
            {[true, false].map((option) => (
              <label
                key={String(option)}
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
                  'has-focus-visible:ring-2 has-focus-visible:ring-ring',
                  chosen === option ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/60',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <input
                  type="radio"
                  name={name}
                  className="sr-only"
                  checked={chosen === option}
                  disabled={disabled}
                  onChange={() => onChange({ kind: 'true_false', value: option })}
                />
                {option ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                {option ? t('trueLabel', language) : t('falseLabel', language)}
              </label>
            ))}
          </div>
          {chosen !== null ? <ClearButton language={language} onClick={() => onChange(null)} disabled={disabled} /> : null}
        </div>
      );
    }

    case 'numerical': {
      const text = value?.kind === 'numerical' ? value.text : '';
      return (
        <div className="max-w-md space-y-1.5">
          <label htmlFor={`${name}-input`} className="text-sm font-medium">
            {t('yourAnswer', language)}
          </label>
          <Input
            id={`${name}-input`}
            value={text}
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={120}
            className="h-11 font-mono text-base"
            placeholder="9.8 m s^-2"
            aria-describedby={`${name}-hint`}
            onChange={(event) =>
              onChange(event.target.value === '' ? null : { kind: 'numerical', text: event.target.value })
            }
          />
          <p id={`${name}-hint`} className="text-xs text-muted-foreground">
            {t('numericHint', language)}
          </p>
        </div>
      );
    }

    case 'short_answer': {
      const text = value?.kind === 'short_answer' ? value.text : '';
      return (
        <div className="max-w-xl space-y-1.5">
          <label htmlFor={`${name}-input`} className="text-sm font-medium">
            {t('yourAnswer', language)}
          </label>
          <Input
            id={`${name}-input`}
            value={text}
            disabled={disabled}
            autoComplete="off"
            maxLength={500}
            className="h-11 text-base"
            placeholder={t('shortHint', language)}
            onChange={(event) =>
              onChange(event.target.value === '' ? null : { kind: 'short_answer', text: event.target.value })
            }
          />
        </div>
      );
    }

    case 'essay': {
      const text = value?.kind === 'essay' ? value.text : '';
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      return (
        <div className="space-y-2">
          {input.guidance ? <div className="text-sm text-muted-foreground">{input.guidance}</div> : null}
          <label htmlFor={`${name}-input`} className="sr-only">
            {t('yourAnswer', language)}
          </label>
          <Textarea
            id={`${name}-input`}
            value={text}
            disabled={disabled}
            rows={8}
            maxLength={20000}
            className="text-base"
            placeholder={t('essayHint', language)}
            onChange={(event) =>
              onChange(event.target.value === '' ? null : { kind: 'essay', text: event.target.value })
            }
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {tf('wordCount', language, { n: words })}
            {input.expectedWords ? ` · ${tf('aboutWords', language, { n: input.expectedWords })}` : ''}
          </p>
        </div>
      );
    }
  }
}

function ChoiceRow({
  type,
  name,
  letter,
  checked,
  disabled,
  onChange,
  children,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  letter: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors',
        'has-focus-visible:ring-2 has-focus-visible:ring-ring',
        checked ? 'border-primary bg-primary/8' : 'hover:bg-muted/60',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type={type}
        name={name}
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden
        className={cn(
          'flex size-7 shrink-0 items-center justify-center border text-xs font-semibold',
          type === 'radio' ? 'rounded-full' : 'rounded-md',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
        )}
      >
        {letter}
      </span>
      <span className="min-w-0 flex-1 pt-1">{children}</span>
    </label>
  );
}

function ClearButton({ language, onClick, disabled }: { language: ContentLanguage; onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onClick} disabled={disabled}>
      {t('clearAnswer', language)}
    </Button>
  );
}
