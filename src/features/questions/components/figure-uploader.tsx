'use client';

import { useRef, useState, useTransition } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { uploadFigureAction } from '../actions';
import type { Figure } from '../types';

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`);

interface FigureUploaderProps {
  figures: Figure[];
  onChange: (figures: Figure[]) => void;
  /** Signed URLs for figures already saved; new uploads preview from the local file. */
  figureUrls: Record<string, string>;
  label?: string;
}

/**
 * Uploads diagrams, graphs and circuit figures into private Storage.
 *
 * The upload happens immediately — a figure exists as soon as it is chosen,
 * so a teacher who abandons the form does not lose the file. Alt text is
 * asked for on the spot, because nobody ever comes back to add it.
 */
export function FigureUploader({ figures, onChange, figureUrls, label = 'Figures' }: FigureUploaderProps) {
  const [isPending, startTransition] = useTransition();
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = (file: File) => {
    const formData = new FormData();
    formData.set('file', file);

    startTransition(async () => {
      const result = await uploadFigureAction({ status: 'idle' }, formData);
      if (result.status !== 'success' || !result.data) {
        toast.error(result.status === 'error' ? result.message : 'The image could not be uploaded.');
        return;
      }

      const figure: Figure = { id: newId(), path: result.data.path, alt: '', caption: null };
      setLocalPreviews((current) => ({ ...current, [figure.path]: URL.createObjectURL(file) }));
      onChange([...figures, figure]);
      toast.success('Image uploaded. Add a short description of what it shows.');
    });
  };

  const update = (id: string, patch: Partial<Figure>) =>
    onChange(figures.map((figure) => (figure.id === id ? { ...figure, ...patch } : figure)));

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      {figures.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {figures.map((figure) => {
            const url = localPreviews[figure.path] ?? figureUrls[figure.path];
            return (
              <li key={figure.id} className="space-y-2 rounded-lg border p-3">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed Storage URLs and blob previews are not optimiser inputs
                  <img src={url} alt="" className="h-32 w-full rounded bg-white object-contain p-1" />
                ) : (
                  <div className="flex h-32 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                    Uploaded
                  </div>
                )}

                <Input
                  value={figure.alt}
                  placeholder="Describe the diagram (for screen readers)"
                  onChange={(event) => update(figure.id, { alt: event.target.value })}
                />
                <Input
                  value={figure.caption ?? ''}
                  placeholder="Caption (optional)"
                  onChange={(event) => update(figure.id, { caption: event.target.value || null })}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(figures.filter((item) => item.id !== figure.id))}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
          event.target.value = '';
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending || figures.length >= 8}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        {isPending ? 'Uploading…' : 'Add figure'}
      </Button>
      <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, GIF or SVG, up to 5 MB.</p>
    </div>
  );
}
