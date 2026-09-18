'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import type {
  EssayBody,
  McqBody,
  MultiBody,
  NumericalAnswer,
  NumericalBody,
  ShortAnswerBody,
  SimpleQuestionBody,
  TrueFalseBody,
} from '../../types';
import { MathField } from '../math-field';

/**
 * Answer editors, one per question type.
 *
 * Each takes the body it owns and an `onChange`, so the parent never needs
 * to know the shape of any particular type — adding a question type means
 * adding an editor here and a case in the marking engine, nothing else.
 */

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`);

export function AnswerEditor({
  body,
  onChange,
}: {
  body: SimpleQuestionBody;
  onChange: (body: SimpleQuestionBody) => void;
}) {
  switch (body.kind) {
    case 'mcq':
      return <ChoiceEditor body={body} onChange={onChange} />;
    case 'multi':
      return <ChoiceEditor body={body} onChange={onChange} />;
    case 'true_false':
      return <TrueFalseEditor body={body} onChange={onChange} />;
    case 'numerical':
      return <NumericalEditor body={body} onChange={onChange} />;
    case 'short_answer':
      return <ShortAnswerEditor body={body} onChange={onChange} />;
    case 'essay':
      return <EssayEditor body={body} onChange={onChange} />;
  }
}

function ChoiceEditor({
  body,
  onChange,
}: {
  body: McqBody | MultiBody;
  onChange: (body: SimpleQuestionBody) => void;
}) {
  const multiple = body.kind === 'multi';
  const correctIds = multiple ? new Set(body.correctOptionIds) : new Set([body.correctOptionId]);

  const setOptions = (options: typeof body.options) => {
    if (multiple) {
      const valid = new Set(options.map((option) => option.id));
      onChange({ ...body, options, correctOptionIds: body.correctOptionIds.filter((id) => valid.has(id)) });
    } else {
      const stillThere = options.some((option) => option.id === body.correctOptionId);
      onChange({ ...body, options, correctOptionId: stillThere ? body.correctOptionId : null });
    }
  };

  const toggleCorrect = (optionId: string) => {
    if (multiple) {
      const next = body.correctOptionIds.includes(optionId)
        ? body.correctOptionIds.filter((id) => id !== optionId)
        : [...body.correctOptionIds, optionId];
      onChange({ ...body, correctOptionIds: next });
    } else {
      onChange({ ...body, correctOptionId: optionId });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {multiple ? 'Tick every correct option.' : 'Choose the one correct option.'}
      </p>

      <ul className="space-y-3">
        {body.options.map((option, index) => (
          <li key={option.id} className="flex items-start gap-3 rounded-lg border p-3">
            <span className="mt-2 text-sm font-medium text-muted-foreground">
              {String.fromCharCode(65 + index)}
            </span>

            <span className="mt-2">
              {multiple ? (
                <Checkbox
                  checked={correctIds.has(option.id)}
                  onCheckedChange={() => toggleCorrect(option.id)}
                  aria-label={`Option ${String.fromCharCode(65 + index)} is correct`}
                />
              ) : (
                <input
                  type="radio"
                  name="correct-option"
                  checked={correctIds.has(option.id)}
                  onChange={() => toggleCorrect(option.id)}
                  aria-label={`Option ${String.fromCharCode(65 + index)} is correct`}
                  className="size-4 accent-[var(--brand-primary)]"
                />
              )}
            </span>

            <div className="min-w-0 flex-1 space-y-2">
              <MathField
                value={option.text}
                rows={2}
                placeholder="Option text — LaTeX allowed, e.g. $9.8\\ \\text{m s}^{-2}$"
                onChange={(text) =>
                  setOptions(body.options.map((item) => (item.id === option.id ? { ...item, text } : item)))
                }
              />
              <Input
                value={option.feedback ?? ''}
                placeholder="Why this option is wrong (optional, shown in review)"
                onChange={(event) =>
                  setOptions(
                    body.options.map((item) =>
                      item.id === option.id ? { ...item, feedback: event.target.value || null } : item,
                    ),
                  )
                }
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove option ${String.fromCharCode(65 + index)}`}
              onClick={() => setOptions(body.options.filter((item) => item.id !== option.id))}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={body.options.length >= 12}
          onClick={() => setOptions([...body.options, { id: newId(), text: '', feedback: null }])}
        >
          <Plus className="size-4" aria-hidden />
          Add option
        </Button>

        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={body.shuffleOptions}
            onCheckedChange={(checked) => onChange({ ...body, shuffleOptions: checked })}
          />
          Shuffle options for each student
        </label>

        {multiple ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={body.partialCredit}
              onCheckedChange={(checked) => onChange({ ...body, partialCredit: checked })}
            />
            Award partial marks
          </label>
        ) : null}
      </div>
    </div>
  );
}

function TrueFalseEditor({
  body,
  onChange,
}: {
  body: TrueFalseBody;
  onChange: (body: SimpleQuestionBody) => void;
}) {
  return (
    <div className="space-y-3">
      <Label>Is the statement true or false?</Label>
      <RadioGroup
        value={body.correct === null ? '' : String(body.correct)}
        onValueChange={(value) => onChange({ ...body, correct: value === 'true' })}
        className="flex gap-6"
      >
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="true" id="tf-true" />
          True
        </label>
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="false" id="tf-false" />
          False
        </label>
      </RadioGroup>
    </div>
  );
}

function NumericalEditor({
  body,
  onChange,
}: {
  body: NumericalBody;
  onChange: (body: SimpleQuestionBody) => void;
}) {
  const update = (id: string, patch: Partial<NumericalAnswer>) =>
    onChange({
      ...body,
      answers: body.answers.map((answer) => (answer.id === id ? { ...answer, ...patch } : answer)),
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add each answer you will accept. Units are never converted automatically — if you accept km/h as
        well as m/s, add it as a second answer with its own value.
      </p>

      <ul className="space-y-4">
        {body.answers.map((answer, index) => (
          <li key={answer.id} className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {index === 0 ? 'Accepted answer' : `Alternative ${index}`}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove this accepted answer"
                onClick={() => onChange({ ...body, answers: body.answers.filter((item) => item.id !== answer.id) })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`value-${answer.id}`}>Value</Label>
                <Input
                  id={`value-${answer.id}`}
                  value={answer.value}
                  placeholder="9.81"
                  className="font-mono"
                  onChange={(event) => update(answer.id, { value: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`tolmode-${answer.id}`}>Tolerance</Label>
                <Select
                  value={answer.tolerance.mode}
                  onValueChange={(mode) =>
                    update(answer.id, {
                      tolerance: { mode: mode as NumericalAnswer['tolerance']['mode'], value: answer.tolerance.value },
                    })
                  }
                >
                  <SelectTrigger id={`tolmode-${answer.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact</SelectItem>
                    <SelectItem value="absolute">Absolute ±</SelectItem>
                    <SelectItem value="relative">Relative %</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`tolvalue-${answer.id}`}>
                  {answer.tolerance.mode === 'relative' ? 'Fraction (0.02 = 2%)' : 'Amount'}
                </Label>
                <Input
                  id={`tolvalue-${answer.id}`}
                  value={answer.tolerance.value}
                  disabled={answer.tolerance.mode === 'exact'}
                  placeholder={answer.tolerance.mode === 'relative' ? '0.02' : '0.05'}
                  className="font-mono"
                  onChange={(event) =>
                    update(answer.id, { tolerance: { mode: answer.tolerance.mode, value: event.target.value } })
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`sf-${answer.id}`}>Significant figures</Label>
                <Input
                  id={`sf-${answer.id}`}
                  type="number"
                  min={1}
                  max={10}
                  value={answer.significantFigures ?? ''}
                  placeholder="Any"
                  onChange={(event) =>
                    update(answer.id, {
                      significantFigures: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`units-${answer.id}`}>Accepted units</Label>
                <Input
                  id={`units-${answer.id}`}
                  value={answer.acceptedUnits.join(', ')}
                  placeholder="m s^-1, m/s"
                  className="font-mono"
                  onChange={(event) =>
                    update(answer.id, {
                      acceptedUnits: event.target.value
                        .split(',')
                        .map((unit) => unit.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Comma separated. Case matters: <span className="font-mono">m</span> and{' '}
                  <span className="font-mono">M</span> are different units.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={answer.requireUnit}
                  onCheckedChange={(checked) => update(answer.id, { requireUnit: checked })}
                />
                A unit is required
              </label>

              <div className="flex items-center gap-2">
                <Label htmlFor={`marks-${answer.id}`} className="text-sm font-normal">
                  Marks
                </Label>
                <Input
                  id={`marks-${answer.id}`}
                  type="number"
                  min={0}
                  step="0.5"
                  value={answer.marks ?? ''}
                  placeholder="Full"
                  className="w-24"
                  onChange={(event) =>
                    update(answer.id, { marks: event.target.value === '' ? null : Number(event.target.value) })
                  }
                />
              </div>
            </div>

            <Input
              value={answer.note ?? ''}
              placeholder="Note to yourself, e.g. “accepts g = 10” (never shown to students)"
              onChange={(event) => update(answer.id, { note: event.target.value || null })}
            />
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={body.answers.length >= 10}
        onClick={() =>
          onChange({
            ...body,
            answers: [
              ...body.answers,
              {
                id: newId(),
                value: '',
                tolerance: { mode: 'absolute', value: '0.01' },
                significantFigures: null,
                requireUnit: false,
                acceptedUnits: [],
                marks: null,
                note: null,
              },
            ],
          })
        }
      >
        <Plus className="size-4" aria-hidden />
        {body.answers.length === 0 ? 'Add accepted answer' : 'Add alternative answer'}
      </Button>
    </div>
  );
}

function ShortAnswerEditor({
  body,
  onChange,
}: {
  body: ShortAnswerBody;
  onChange: (body: SimpleQuestionBody) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        List every wording you will accept. Anything not listed is marked wrong, so prefer an essay
        question when the answer is open-ended.
      </p>

      <ul className="space-y-3">
        {body.answers.map((answer) => (
          <li key={answer.id} className="flex items-start gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Input
                value={answer.text}
                placeholder="acceleration"
                onChange={(event) =>
                  onChange({
                    ...body,
                    answers: body.answers.map((item) =>
                      item.id === answer.id ? { ...item, text: event.target.value } : item,
                    ),
                  })
                }
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={answer.caseSensitive}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...body,
                      answers: body.answers.map((item) =>
                        item.id === answer.id ? { ...item, caseSensitive: checked === true } : item,
                      ),
                    })
                  }
                />
                Case matters (for symbols such as N and n)
              </label>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove accepted answer"
              onClick={() =>
                onChange({ ...body, answers: body.answers.filter((item) => item.id !== answer.id) })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={body.answers.length >= 20}
          onClick={() =>
            onChange({
              ...body,
              answers: [...body.answers, { id: newId(), text: '', caseSensitive: false }],
            })
          }
        >
          <Plus className="size-4" aria-hidden />
          Add accepted answer
        </Button>

        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={body.normalizeWhitespace}
            onCheckedChange={(checked) => onChange({ ...body, normalizeWhitespace: checked })}
          />
          Ignore extra spacing
        </label>
      </div>
    </div>
  );
}

function EssayEditor({ body, onChange }: { body: EssayBody; onChange: (body: SimpleQuestionBody) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Essay answers are always marked by hand. The marking guide below is for you, and is shown to
        students only if you enable explanations on the assessment.
      </p>

      <MathField
        label="Marking guide"
        value={body.rubric ?? ''}
        rows={5}
        placeholder={'1 mark — states Newton’s third law\n2 marks — applies it to the pair of forces\n…'}
        onChange={(rubric) => onChange({ ...body, rubric: rubric || null })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="essay-words">Expected length (words)</Label>
          <Input
            id="essay-words"
            type="number"
            min={10}
            max={5000}
            value={body.expectedWords ?? ''}
            placeholder="150"
            onChange={(event) =>
              onChange({ ...body, expectedWords: event.target.value === '' ? null : Number(event.target.value) })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="essay-guidance">Guidance shown with the question</Label>
          <Textarea
            id="essay-guidance"
            rows={3}
            value={body.guidance ?? ''}
            placeholder="Refer to the diagram in your answer."
            onChange={(event) => onChange({ ...body, guidance: event.target.value || null })}
          />
        </div>
      </div>
    </div>
  );
}
