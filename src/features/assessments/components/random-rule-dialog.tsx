'use client';

import { useState } from 'react';
import { Shuffle } from 'lucide-react';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER, QUESTION_TYPE_LABELS } from '@/features/questions/types';
import { useActionForm } from '@/lib/use-action-form';
import type { DifficultyLevel, QuestionType } from '@/types/database';

import { saveRandomRuleAction } from '../actions';

const ANY = 'any';

export interface RuleValues {
  itemId: string;
  pickCount: number;
  nodeId: string | null;
  difficulties: DifficultyLevel[];
  types: QuestionType[];
  marks: number | null;
}

interface RandomRuleDialogProps {
  assessmentId: string;
  nodes: { id: string; label: string; kind: string }[];
  rule?: RuleValues;
  trigger?: React.ReactNode;
}

/**
 * "Draw 3 medium Electricity questions." The syllabus choice includes
 * everything beneath it, so a rule on a unit spans all of its topics.
 */
export function RandomRuleDialog({ assessmentId, nodes, rule, trigger }: RandomRuleDialogProps) {
  const [open, setOpen] = useState(false);
  const [nodeId, setNodeId] = useState(rule?.nodeId ?? ANY);
  const { state, formAction } = useActionForm(saveRandomRuleAction, { onSuccess: () => setOpen(false) });
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Shuffle className="size-4" aria-hidden />
            Add random rule
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit random rule' : 'Random rule'}</DialogTitle>
          <DialogDescription>
            Each attempt draws its own questions from the published bank, never repeating one within a paper.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5" noValidate>
          <FormAlert state={state} />
          <input type="hidden" name="assessment_id" value={assessmentId} />
          {rule ? <input type="hidden" name="item_id" value={rule.itemId} /> : null}
          <input type="hidden" name="syllabus_node_id" value={nodeId === ANY ? '' : nodeId} />

          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Field name="pick_count" label="Questions" errors={errors?.pick_count} required>
              <Input
                id="pick_count"
                name="pick_count"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                defaultValue={rule?.pickCount ?? 3}
                required
              />
            </Field>
            <Field name="syllabus_node_id" label="From" errors={errors?.syllabus_node_id}>
              <Select value={nodeId} onValueChange={setNodeId}>
                <SelectTrigger id="syllabus_node_id" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={ANY}>The whole syllabus</SelectItem>
                  {nodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Difficulty</legend>
            <p className="text-xs text-muted-foreground">Tick none for any difficulty.</p>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY_ORDER.map((level) => (
                <label key={level} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
                  <Checkbox name="difficulties[]" value={level} defaultChecked={rule?.difficulties.includes(level)} />
                  {DIFFICULTY_LABELS[level]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Question type</legend>
            <p className="text-xs text-muted-foreground">Tick none for any type.</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
                <label key={type} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
                  <Checkbox name="question_types[]" value={type} defaultChecked={rule?.types.includes(type)} />
                  {QUESTION_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            name="marks"
            label="Only questions worth (marks)"
            hint="Optional. Fixing the marks keeps every student's paper worth the same total."
            errors={errors?.marks}
            className="max-w-xs"
          >
            <Input
              id="marks"
              name="marks"
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              defaultValue={rule?.marks ?? ''}
              placeholder="Any"
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">{rule ? 'Save rule' : 'Add rule'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
