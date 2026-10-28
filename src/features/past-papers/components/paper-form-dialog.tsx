'use client';

import { useRouter } from 'next/navigation';
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
import { useActionForm } from '@/lib/use-action-form';
import type { PastPaperRow } from '@/types/database';

import { createPastPaperAction, updatePastPaperAction } from '../actions';

export function PaperFormDialog({ paper, trigger }: { paper?: PastPaperRow; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { state, formAction } = useActionForm(paper ? updatePastPaperAction : createPastPaperAction, {
    onSuccess: ({ data }) => {
      setOpen(false);
      if (!paper && data) router.push(`/t/past-papers/${data.id}`);
    },
  });
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" aria-hidden />
            New past paper
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{paper ? 'Edit paper' : 'New past paper'}</DialogTitle>
          <DialogDescription>
            The paper groups questions from your bank and records where each appeared. The questions themselves —
            answers, solutions, topics — stay in the bank.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <FormAlert state={state} />
          {paper ? <input type="hidden" name="id" value={paper.id} /> : null}
          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
            <Field name="year" label="Year" errors={errors?.year} required>
              <Input
                id="year"
                name="year"
                type="number"
                inputMode="numeric"
                min={1950}
                max={2100}
                defaultValue={paper?.year ?? new Date().getFullYear() - 1}
                required
              />
            </Field>
            <Field name="title" label="Paper" errors={errors?.title} required>
              <Input id="title" name="title" defaultValue={paper?.title} placeholder="Physics Paper II" required />
            </Field>
          </div>
          <Field name="description" label="Note" hint="Optional, shown to students — e.g. “Structured and essay”." errors={errors?.description}>
            <Textarea id="description" name="description" rows={2} defaultValue={paper?.description ?? ''} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">{paper ? 'Save' : 'Create paper'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
