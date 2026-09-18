'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { createBatchAction, updateBatchAction } from '@/features/batches/actions';
import { useActionForm } from '@/lib/use-action-form';
import type { BatchRow } from '@/types/database';

interface BatchFormDialogProps {
  batch?: BatchRow;
  trigger?: React.ReactNode;
}

export function BatchFormDialog({ batch, trigger }: BatchFormDialogProps) {
  const [open, setOpen] = useState(false);
  const action = batch ? updateBatchAction : createBatchAction;
  const { state, formAction } = useActionForm(action, { onSuccess: () => setOpen(false) });

  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" aria-hidden />
            New batch
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{batch ? 'Edit batch' : 'New batch'}</DialogTitle>
          <DialogDescription>
            Batches group students by class or intake, for example “Colombo Saturday”.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <FormAlert state={state} />
          {batch ? <input type="hidden" name="id" value={batch.id} /> : null}

          <Field name="name" label="Batch name" errors={errors?.name} required>
            <Input id="name" name="name" defaultValue={batch?.name} placeholder="Colombo Saturday" required />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="al_year" label="A/L year" errors={errors?.al_year}>
              <Input
                id="al_year"
                name="al_year"
                type="number"
                inputMode="numeric"
                min={2000}
                max={2100}
                defaultValue={batch?.al_year ?? ''}
                placeholder="2026"
              />
            </Field>

            <Field name="code" label="Short code" errors={errors?.code}>
              <Input id="code" name="code" defaultValue={batch?.code ?? ''} placeholder="CMB-SAT" />
            </Field>
          </div>

          <Field name="schedule_note" label="Schedule" hint="Shown to students on their dashboard." errors={errors?.schedule_note}>
            <Input
              id="schedule_note"
              name="schedule_note"
              defaultValue={batch?.schedule_note ?? ''}
              placeholder="Saturdays, 8:00 AM"
            />
          </Field>

          <Field name="description" label="Description" errors={errors?.description}>
            <Textarea id="description" name="description" rows={2} defaultValue={batch?.description ?? ''} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>{batch ? 'Save changes' : 'Create batch'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
