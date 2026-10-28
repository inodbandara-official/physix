'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { runWithToast } from '@/lib/run-action';

import { deletePastPaperAction, setPastPaperPublishedAction } from '../actions';

export function PaperLifecycle({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <Button
        variant={published ? 'outline' : 'default'}
        disabled={isPending}
        onClick={() => startTransition(() => runWithToast(() => setPastPaperPublishedAction(id, !published)))}
      >
        {published ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        {published ? 'Hide from students' : 'Publish'}
      </Button>
      <Button variant="ghost" size="icon" aria-label="Delete paper" disabled={isPending} onClick={() => setConfirm(true)}>
        <Trash2 className="size-4" />
      </Button>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this paper?</AlertDialogTitle>
            <AlertDialogDescription>
              The questions stay in your bank and every practice already done keeps its marks. Only the paper’s grouping
              and numbering are removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const result = await deletePastPaperAction(id);
                  if (result.status === 'success') {
                    toast.success(result.message);
                    router.push('/t/past-papers');
                  } else if (result.status === 'error') toast.error(result.message);
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
