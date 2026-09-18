'use client';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { emptyBody, QUESTION_TYPE_LABELS, type QuestionPart, type SimpleQuestionBody, type StructuredBody } from '../../types';
import { MathField } from '../math-field';
import { AnswerEditor } from './answer-editors';

const PART_TYPES = ['numerical', 'mcq', 'multi', 'true_false', 'short_answer', 'essay'] as const;

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`);

/** (a), (b), (c) … — the next free label in sequence. */
function nextLabel(parts: QuestionPart[]): string {
  const used = new Set(parts.map((part) => part.label.toLowerCase()));
  for (let i = 0; i < 26; i += 1) {
    const label = String.fromCharCode(97 + i);
    if (!used.has(label)) return label;
  }
  return String(parts.length + 1);
}

/**
 * The multi-part Physics problem: one scenario, several questions off it,
 * each carrying its own marks and its own marking rules.
 */
export function StructuredEditor({
  body,
  onChange,
}: {
  body: StructuredBody;
  onChange: (body: StructuredBody) => void;
}) {
  const update = (id: string, patch: Partial<QuestionPart>) =>
    onChange({ ...body, parts: body.parts.map((part) => (part.id === id ? { ...part, ...patch } : part)) });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= body.parts.length) return;
    const parts = [...body.parts];
    [parts[index], parts[target]] = [parts[target], parts[index]];
    onChange({ ...body, parts });
  };

  const total = body.parts.reduce((sum, part) => sum + (Number.isFinite(part.marks) ? part.marks : 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Each part is marked separately. The question is worth the sum of its parts.
        </p>
        <p className="text-sm font-medium tabular-nums">
          Total: {Math.round(total * 100) / 100} marks
        </p>
      </div>

      {body.parts.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No parts yet. Add part (a) to begin.
        </p>
      ) : null}

      <ol className="space-y-5">
        {body.parts.map((part, index) => (
          <li key={part.id} className="space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-20 space-y-2">
                <Label htmlFor={`label-${part.id}`}>Part</Label>
                <Input
                  id={`label-${part.id}`}
                  value={part.label}
                  maxLength={8}
                  onChange={(event) => update(part.id, { label: event.target.value })}
                />
              </div>

              <div className="w-28 space-y-2">
                <Label htmlFor={`marks-${part.id}`}>Marks</Label>
                <Input
                  id={`marks-${part.id}`}
                  type="number"
                  min={0.5}
                  step="0.5"
                  value={part.marks}
                  onChange={(event) => update(part.id, { marks: Number(event.target.value) })}
                />
              </div>

              <div className="min-w-44 flex-1 space-y-2">
                <Label htmlFor={`type-${part.id}`}>Answer type</Label>
                <Select
                  value={part.body.kind}
                  onValueChange={(kind) =>
                    update(part.id, { body: emptyBody(kind as SimpleQuestionBody['kind']) as SimpleQuestionBody })
                  }
                >
                  <SelectTrigger id={`type-${part.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PART_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {QUESTION_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move part ${part.label} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move part ${part.label} down`}
                  disabled={index === body.parts.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove part ${part.label}`}
                  onClick={() => onChange({ ...body, parts: body.parts.filter((item) => item.id !== part.id) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <MathField
              label="Prompt"
              value={part.prompt}
              rows={2}
              placeholder="Calculate the acceleration of the body."
              onChange={(prompt) => update(part.id, { prompt })}
            />

            <div className="rounded-lg bg-muted/40 p-4">
              <AnswerEditor body={part.body} onChange={(nextBody) => update(part.id, { body: nextBody })} />
            </div>

            <MathField
              label="Explanation for this part"
              value={part.explanation ?? ''}
              rows={2}
              placeholder="Using $v = u + at$ with $u = 0$…"
              onChange={(explanation) => update(part.id, { explanation: explanation || null })}
            />
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={body.parts.length >= 20}
        onClick={() =>
          onChange({
            ...body,
            parts: [
              ...body.parts,
              {
                id: newId(),
                label: nextLabel(body.parts),
                prompt: '',
                marks: 2,
                body: emptyBody('numerical') as SimpleQuestionBody,
                explanation: null,
                figures: [],
              },
            ],
          })
        }
      >
        <Plus className="size-4" aria-hidden />
        Add part
      </Button>
    </div>
  );
}
