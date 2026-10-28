import type { Figure } from '@/features/questions/types';

/** Question figures, rendered on the server from signed URLs. */
export function Figures({
  figures,
  urls,
}: {
  figures: Pick<Figure, 'id' | 'path' | 'alt' | 'caption'>[];
  urls: Map<string, string>;
}) {
  if (figures.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {figures.map((figure) => {
        const url = urls.get(figure.path);
        return (
          <figure key={figure.id} className="space-y-1.5">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed Storage URLs expire, so they are not a stable optimiser input
              <img
                src={url}
                alt={figure.alt}
                className="w-full rounded-lg border bg-white object-contain p-2"
                loading="lazy"
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                {figure.alt || 'Figure'}
              </div>
            )}
            {figure.caption ? <figcaption className="text-xs text-muted-foreground">{figure.caption}</figcaption> : null}
          </figure>
        );
      })}
    </div>
  );
}
