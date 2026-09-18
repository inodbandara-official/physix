import Image from 'next/image';

import { cn } from '@/lib/utils';
import type { AppSettingsRow } from '@/types/database';

interface BrandMarkProps {
  brand: Pick<AppSettingsRow, 'lms_name' | 'tagline' | 'logo_url'>;
  className?: string;
  compact?: boolean;
}

export function BrandMark({ brand, className, compact }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {brand.logo_url ? (
        <Image
          src={brand.logo_url}
          alt=""
          width={32}
          height={32}
          className="size-8 rounded-lg object-cover"
          unoptimized
        />
      ) : (
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ background: 'var(--brand-primary)' }}
          aria-hidden
        >
          {brand.lms_name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {!compact ? (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-tight">{brand.lms_name}</span>
          <span className="block truncate text-xs text-muted-foreground">{brand.tagline}</span>
        </span>
      ) : null}
    </div>
  );
}
