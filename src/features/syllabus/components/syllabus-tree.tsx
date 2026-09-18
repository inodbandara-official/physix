'use client';

import { useState, useTransition } from 'react';
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Plus } from 'lucide-react';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  archiveSyllabusNodeAction,
  createSyllabusNodeAction,
  reorderSyllabusNodeAction,
  updateSyllabusNodeAction,
} from '@/features/syllabus/actions';
import type { SyllabusNode } from '@/features/syllabus/queries';
import type { ActionState } from '@/lib/action';
import { runWithToast } from '@/lib/run-action';
import { useActionForm } from '@/lib/use-action-form';
import type { SyllabusKind } from '@/types/database';

const CHILD_KIND: Record<SyllabusKind, SyllabusKind | null> = {
  unit: 'topic',
  topic: 'subtopic',
  subtopic: null,
};

type DialogState =
  | { mode: 'create'; kind: SyllabusKind; parentId: string | null; parentName?: string }
  | { mode: 'edit'; node: SyllabusNode }
  | null;

/**
 * The syllabus is the spine everything else hangs off, so it is editable in
 * place rather than behind a wizard. Archiving hides a branch without deleting
 * it, which keeps questions written against an old topic valid.
 */
export function SyllabusTree({ tree }: { tree: SyllabusNode[] }) {
  const [dialog, setDialog] = useState<DialogState>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ mode: 'create', kind: 'unit', parentId: null })}>
          <Plus className="size-4" aria-hidden />
          Add unit
        </Button>
      </div>

      <ul className="space-y-3">
        {tree.map((unit) => (
          <NodeRow key={unit.id} node={unit} depth={0} onDialog={setDialog} />
        ))}
      </ul>

      <SyllabusDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function NodeRow({
  node,
  depth,
  onDialog,
}: {
  node: SyllabusNode;
  depth: number;
  onDialog: (state: DialogState) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const childKind = CHILD_KIND[node.kind];
  const archived = node.archived_at !== null;

  const run = (action: () => Promise<ActionState>) => startTransition(() => runWithToast(action));

  return (
    <li className={depth === 0 ? 'rounded-xl border bg-background p-4' : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onDialog({ mode: 'edit', node })}
          className="text-left font-medium hover:underline"
        >
          {node.name}
        </button>
        {node.code ? <span className="font-mono text-xs text-muted-foreground">{node.code}</span> : null}
        <Badge variant="outline" className="font-normal capitalize">
          {node.kind}
        </Badge>
        {archived ? <Badge variant="secondary">Archived</Badge> : null}

        <span className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move ${node.name} up`}
            disabled={isPending}
            onClick={() => run(() => reorderSyllabusNodeAction(node.id, 'up'))}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move ${node.name} down`}
            disabled={isPending}
            onClick={() => run(() => reorderSyllabusNodeAction(node.id, 'down'))}
          >
            <ChevronDown className="size-4" />
          </Button>
          {childKind ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onDialog({ mode: 'create', kind: childKind, parentId: node.id, parentName: node.name })
              }
            >
              <Plus className="size-4" aria-hidden />
              {childKind}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label={archived ? `Restore ${node.name}` : `Archive ${node.name}`}
            disabled={isPending}
            onClick={() => run(() => archiveSyllabusNodeAction(node.id, !archived))}
          >
            {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          </Button>
        </span>
      </div>

      {node.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{node.description}</p>
      ) : null}

      {node.children.length > 0 ? (
        <ul className="mt-3 space-y-2 border-l pl-4">
          {node.children.map((child) => (
            <NodeRow key={child.id} node={child} depth={depth + 1} onDialog={onDialog} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SyllabusDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const isEdit = state?.mode === 'edit';
  const action = isEdit ? updateSyllabusNodeAction : createSyllabusNodeAction;
  const { state: formState, formAction } = useActionForm(action, { onSuccess: onClose });

  const errors = formState.status === 'error' ? formState.fieldErrors : undefined;
  const node = state?.mode === 'edit' ? state.node : undefined;
  const kind = state?.mode === 'create' ? state.kind : node?.kind;

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {isEdit ? `Edit ${kind}` : `New ${kind}`}
          </DialogTitle>
          <DialogDescription>
            {state?.mode === 'create' && state.parentName
              ? `Inside “${state.parentName}”.`
              : 'Units sit at the top of the syllabus; topics and subtopics nest inside them.'}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate key={node?.id ?? `${kind}-new`}>
          <FormAlert state={formState} />

          {isEdit ? (
            <input type="hidden" name="id" value={node!.id} />
          ) : (
            <>
              <input type="hidden" name="kind" value={kind} />
              {state?.mode === 'create' && state.parentId ? (
                <input type="hidden" name="parent_id" value={state.parentId} />
              ) : null}
            </>
          )}

          <Field name="name" label="Name" errors={errors?.name} required>
            <Input id="name" name="name" defaultValue={node?.name} placeholder="Mechanics" required />
          </Field>

          <Field name="code" label="Code" hint="Optional short reference." errors={errors?.code}>
            <Input id="code" name="code" defaultValue={node?.code ?? ''} placeholder="U1" />
          </Field>

          <Field name="description" label="Description" errors={errors?.description}>
            <Textarea id="description" name="description" rows={2} defaultValue={node?.description ?? ''} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton>{isEdit ? 'Save' : 'Add'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
