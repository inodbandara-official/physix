'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Eye, Sigma } from 'lucide-react';

import { MathText } from '@/components/math-text';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useActionForm } from '@/lib/use-action-form';

import { saveTranslationAction } from '../translation-actions';
import {
  TRANSLATABLE_FIELDS,
  localizeQuestion,
  translatableIds,
  type QuestionTranslation,
} from '../translation';
import type { Figure, QuestionBody } from '../types';
import { QuestionPreview } from './question-preview';

interface TranslationEditorProps {
  questionId: string;
  questionCode: string;
  source: {
    title: string;
    stem: string;
    explanation: string | null;
    solution: string | null;
    hint: string | null;
    common_mistake: string | null;
    body: QuestionBody;
    figures: Figure[];
    marks: number;
  };
  initial: QuestionTranslation;
  figureUrls: Record<string, string>;
}

/**
 * Side-by-side translation.
 *
 * English on the left, Sinhala on the right, field by field. The teacher
 * is never asked to retype maths: "Copy English across" fills the Sinhala
 * side with the original so only the words need changing, and every
 * `$…$` survives untouched.
 */
export function TranslationEditor({
  questionId,
  questionCode,
  source,
  initial,
  figureUrls,
}: TranslationEditorProps) {
  const router = useRouter();
  const [translation, setTranslation] = useState<QuestionTranslation>(initial);
  const [showPreview, setShowPreview] = useState(false);

  const { state, formAction } = useActionForm(saveTranslationAction, {
    onSuccess: () => router.refresh(),
  });

  const ids = translatableIds(source.body);

  const set = (patch: Partial<QuestionTranslation>) =>
    setTranslation((current) => ({ ...current, ...patch }));

  /**
   * Pre-fills every empty Sinhala field with the English text. Nothing is
   * machine translated — this only saves retyping formulas and numbers,
   * and the result is explicitly an unreviewed draft.
   */
  const copyEnglishAcross = () => {
    setTranslation((current) => ({
      ...current,
      title: current.title || source.title,
      stem: current.stem || source.stem,
      explanation: current.explanation || source.explanation || undefined,
      solution: current.solution || source.solution || undefined,
      hint: current.hint || source.hint || undefined,
      commonMistake: current.commonMistake || source.common_mistake || undefined,
      options: {
        ...Object.fromEntries(ids.options.map((option) => [option.id, option.source])),
        ...current.options,
      },
      parts: {
        ...Object.fromEntries(
          ids.parts.map((part) => [
            part.id,
            { prompt: part.prompt, explanation: part.explanation ?? undefined },
          ]),
        ),
        ...current.parts,
      },
      reviewed: false,
    }));
  };

  const preview = localizeQuestion(source, { si: translation }, 'si', { includeUnreviewed: true });
  const stemFilled = Boolean(translation.stem?.trim());

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="question_id" value={questionId} />
      <input type="hidden" name="language" value="si" />
      <input type="hidden" name="translation" value={JSON.stringify(translation)} />

      <FormAlert state={state} />

      <Alert>
        <AlertTriangle className="size-4" aria-hidden />
        <AlertDescription>
          Only the wording is translated. The answer key, marks, tolerances and units are shared with the
          English version, so a question can never mark differently depending on the language it is read in.
          Leave every <span className="font-mono">$…$</span> exactly as it is.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {questionCode}
          </Badge>
          {translation.reviewed ? (
            <Badge variant="secondary" className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
              Published in Sinhala
            </Badge>
          ) : (
            <Badge variant="secondary">Draft — students still see English</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyEnglishAcross}>
            <ArrowLeftRight className="size-4" aria-hidden />
            Copy English across
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((value) => !value)}
            aria-pressed={showPreview}
          >
            <Eye className="size-4" aria-hidden />
            Preview
          </Button>
        </div>
      </div>

      {showPreview ? (
        <Card>
          <CardHeader>
            <CardTitle>As a Sinhala reader sees it</CardTitle>
            <CardDescription>Untranslated fields fall back to English.</CardDescription>
          </CardHeader>
          <CardContent>
            <QuestionPreview
              stem={preview.stem}
              body={preview.body}
              marks={source.marks}
              figures={preview.figures}
              figureUrls={new Map(Object.entries(figureUrls))}
              revealAnswers
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>The question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {TRANSLATABLE_FIELDS.map((field) => {
            const english =
              field.key === 'commonMistake' ? source.common_mistake : (source[field.key] ?? null);
            if (!english && field.key !== 'stem') return null;

            return (
              <TranslationRow
                key={field.key}
                label={field.label}
                english={english ?? ''}
                value={translation[field.key] ?? ''}
                rows={field.rows}
                required={field.key === 'stem'}
                onChange={(value) => set({ [field.key]: value || undefined })}
              />
            );
          })}
        </CardContent>
      </Card>

      {ids.parts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Parts</CardTitle>
            <CardDescription>Marks and answers stay as they are; only the wording changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {ids.parts.map((part) => (
              <div key={part.id} className="space-y-5 rounded-lg border p-4">
                <p className="text-sm font-medium">Part ({part.label})</p>
                <TranslationRow
                  label="Prompt"
                  english={part.prompt}
                  value={translation.parts?.[part.id]?.prompt ?? ''}
                  rows={2}
                  onChange={(value) =>
                    set({
                      parts: {
                        ...translation.parts,
                        [part.id]: { ...translation.parts?.[part.id], prompt: value || undefined },
                      },
                    })
                  }
                />
                {part.explanation ? (
                  <TranslationRow
                    label="Explanation"
                    english={part.explanation}
                    value={translation.parts?.[part.id]?.explanation ?? ''}
                    rows={2}
                    onChange={(value) =>
                      set({
                        parts: {
                          ...translation.parts,
                          [part.id]: {
                            ...translation.parts?.[part.id],
                            explanation: value || undefined,
                          },
                        },
                      })
                    }
                  />
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {ids.options.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>
            <CardDescription>
              Option order and the correct answer are shared, so translating cannot change which one is right.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {ids.options.map((option, index) => (
              <TranslationRow
                key={option.id}
                label={`${option.partLabel ? `(${option.partLabel}) ` : ''}Option ${String.fromCharCode(65 + index)}`}
                english={option.source}
                value={translation.options?.[option.id] ?? ''}
                rows={2}
                onChange={(value) =>
                  set({ options: { ...translation.options, [option.id]: value } })
                }
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Publish</CardTitle>
          <CardDescription>
            Students reading Sinhala see English until you mark this reviewed. An unchecked translation is
            never shown as an exam question.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3 text-sm">
            <Switch
              checked={translation.reviewed ?? false}
              disabled={!stemFilled}
              onCheckedChange={(checked) => set({ reviewed: checked })}
            />
            <span>
              I have read this translation and it says the same thing as the English.
              {!stemFilled ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Translate the question text first.
                </span>
              ) : null}
            </span>
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">Save translation</SubmitButton>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function TranslationRow({
  label,
  english,
  value,
  rows,
  required,
  onChange,
}: {
  label: string;
  english: string;
  value: string;
  rows: number;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const hasMaths = /\$[^$]+\$/.test(english);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs tracking-wide text-muted-foreground uppercase">
          {label} — English
          {hasMaths ? (
            <span className="flex items-center gap-1 normal-case" title="Contains maths: copy it across unchanged">
              <Sigma className="size-3" aria-hidden />
              maths
            </span>
          ) : null}
        </Label>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <MathText>{english}</MathText>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs tracking-wide text-muted-foreground uppercase">
          {label} — සිංහල
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
        <Textarea
          value={value}
          rows={rows}
          lang="si"
          placeholder="සිංහල පරිවර්තනය…"
          onChange={(event) => onChange(event.target.value)}
          className="text-sm"
        />
      </div>
    </div>
  );
}
