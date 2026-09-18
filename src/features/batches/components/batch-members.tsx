'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ArrowRightLeft, UserMinus, UserPlus } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
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
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { addStudentsToBatchAction, moveStudentsAction, removeStudentFromBatchAction } from '@/features/batches/actions';
import type { BatchMemberSummary } from '@/features/batches/queries';
import { StatusBadge } from '@/features/students/components/status-badge';
import { runWithToast } from '@/lib/run-action';
import { useActionForm } from '@/lib/use-action-form';

interface Assignable {
  id: string;
  student_code: string;
  full_name: string;
  school: string | null;
}

interface BatchMembersProps {
  batchId: string;
  members: BatchMemberSummary[];
  assignable: Assignable[];
  otherBatches: { id: string; name: string }[];
}

export function BatchMembers({ batchId, members, assignable, otherBatches }: BatchMembersProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {selected.length > 0 ? `${selected.length} selected` : `${members.length} in this batch`}
        </p>
        <div className="flex flex-wrap gap-2">
          {selected.length > 0 && otherBatches.length > 0 ? (
            <MoveStudentsDialog
              fromBatchId={batchId}
              studentIds={selected}
              otherBatches={otherBatches}
              onDone={() => setSelected([])}
            />
          ) : null}
          <AddStudentsDialog batchId={batchId} assignable={assignable} />
        </div>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No students in this batch"
          description="Add students from your roll, or create new ones first."
          action={<AddStudentsDialog batchId={batchId} assignable={assignable} />}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <span className="sr-only">Select</span>
                </TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="hidden sm:table-cell">Student ID</TableHead>
                <TableHead className="hidden md:table-cell">School</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(member.id)}
                      onCheckedChange={() => toggle(member.id)}
                      aria-label={`Select ${member.full_name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={`/t/students/${member.id}`} className="font-medium hover:underline">
                      {member.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">{member.student_code}</TableCell>
                  <TableCell className="hidden max-w-40 truncate text-sm text-muted-foreground md:table-cell">
                    {member.school ?? '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={member.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${member.full_name} from batch`}
                      disabled={isPending}
                      onClick={() =>
                        startTransition(() =>
                          runWithToast(() => removeStudentFromBatchAction(batchId, member.id)),
                        )
                      }
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function AddStudentsDialog({ batchId, assignable }: { batchId: string; assignable: Assignable[] }) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useActionForm(addStudentsToBatchAction, {
    onSuccess: () => setOpen(false),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" aria-hidden />
          Add students
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add students to this batch</DialogTitle>
          <DialogDescription>Only students who are not already in it are listed.</DialogDescription>
        </DialogHeader>

        {assignable.length === 0 ? (
          <EmptyState
            title="Everyone is already here"
            description="Every active student on your roll is already in this batch."
            className="py-8"
          />
        ) : (
          <form action={formAction} className="space-y-4">
            <FormAlert state={state} />
            <input type="hidden" name="batch_id" value={batchId} />
            <ScrollArea className="h-72 rounded-lg border">
              <div className="space-y-1 p-2">
                {assignable.map((student) => (
                  <label
                    key={student.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <Checkbox name="student_ids[]" value={student.id} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{student.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {student.student_code}
                        {student.school ? ` · ${student.school}` : ''}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton>Add selected</SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveStudentsDialog({
  fromBatchId,
  studentIds,
  otherBatches,
  onDone,
}: {
  fromBatchId: string;
  studentIds: string[];
  otherBatches: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(otherBatches[0]?.id ?? '');
  const { state, formAction } = useActionForm(moveStudentsAction, {
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowRightLeft className="size-4" aria-hidden />
          Move
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {studentIds.length} student(s)</DialogTitle>
          <DialogDescription>
            They leave this batch and join the one you pick. Past membership is kept for the record.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <FormAlert state={state} />
          <input type="hidden" name="from_batch_id" value={fromBatchId} />
          <input type="hidden" name="to_batch_id" value={target} />
          {studentIds.map((id) => (
            <input key={id} type="hidden" name="student_ids[]" value={id} />
          ))}

          <div className="space-y-2">
            <Label htmlFor="target-batch">Move into</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="target-batch" className="w-full">
                <SelectValue placeholder="Choose a batch" />
              </SelectTrigger>
              <SelectContent>
                {otherBatches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton disabled={!target}>Move students</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
