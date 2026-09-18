import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

export function formatDate(value: string | Date | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? format(date, 'd MMM yyyy') : fallback;
}

export function formatDateTime(value: string | Date | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? format(date, 'd MMM yyyy, HH:mm') : fallback;
}

export function formatRelative(value: string | Date | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? `${formatDistanceToNowStrict(date)} ago` : fallback;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Percentages are shown to one decimal at most, and never as "NaN%". */
export function formatPercent(value: number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return `${Math.round(value * 10) / 10}%`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
