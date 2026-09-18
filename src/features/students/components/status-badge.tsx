import { Badge } from '@/components/ui/badge';
import type { AccountStatus } from '@/types/database';

const VARIANTS: Record<AccountStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' },
  inactive: { label: 'Inactive', className: 'bg-muted text-muted-foreground' },
  suspended: { label: 'Suspended', className: 'bg-destructive/12 text-destructive' },
};

export function StatusBadge({ status }: { status: AccountStatus }) {
  const variant = VARIANTS[status];
  return (
    <Badge variant="secondary" className={variant.className}>
      {variant.label}
    </Badge>
  );
}
