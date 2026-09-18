'use client';

import { useRef, useTransition } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addStudentNoteAction, deleteStudentNoteAction } from '@/features/students/actions';
import { runWithToast } from '@/lib/run-action';
import { useActionForm } from '@/lib/use-action-form';
import { formatDate } from '@/lib/format';
import type { StudentNoteRow } from '@/types/database';

/**
 * The teacher's private journal on a student (§35). A note is invisible to the
 * student unless "Share with student" is ticked, which is enforced by RLS, not
 * by this component.
 */
export function StudentNotes({ studentId, notes }: { studentId: string; notes: StudentNoteRow[] }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const { state, formAction } = useActionForm(addStudentNoteAction, {
    onSuccess: () => formRef.current?.reset(),
  });

  return (
    <div className="space-y-5">
      <form ref={formRef} action={formAction} className="space-y-3">
        <FormAlert state={state} />
        <input type="hidden" name="student_id" value={studentId} />
        <Label htmlFor="note-body" className="sr-only">
          New note
        </Label>
        <Textarea
          id="note-body"
          name="body"
          rows={3}
          placeholder="Needs more practice on numerical problems. Improving steadily."
          required
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox name="published" />
            Share this note with the student
          </label>
          <SubmitButton size="sm" pendingLabel="Saving…">
            Add note
          </SubmitButton>
        </div>
      </form>

      {notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Keep a private record of how this student is progressing."
          className="py-8"
        />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border p-3">
              <p className="text-sm whitespace-pre-wrap">{note.body}</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {formatDate(note.created_at)}
                  <Badge variant={note.published ? 'secondary' : 'outline'} className="gap-1 font-normal">
                    {note.published ? <Eye className="size-3" aria-hidden /> : <EyeOff className="size-3" aria-hidden />}
                    {note.published ? 'Shared' : 'Private'}
                  </Badge>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete note"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() => runWithToast(() => deleteStudentNoteAction(note.id, studentId)))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
