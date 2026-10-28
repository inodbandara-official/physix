/**
 * Wall-clock time for a Sri Lankan classroom.
 *
 * The server runs in UTC on Vercel, and a student's phone may be set to
 * anything, so "the test closes at 8 pm" has to mean 8 pm in Colombo no
 * matter where the code runs. Sri Lanka has kept a fixed +05:30 offset
 * with no daylight saving since 2006, which is what makes the conversions
 * below exact rather than approximate.
 */

export const APP_TIME_ZONE = 'Asia/Colombo';
const OFFSET = '+05:30';

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Reads the value of an `<input type="datetime-local">` as Colombo time.
 * Returns an ISO string, or null for a blank or malformed value.
 */
export function fromLocalInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 16);
  if (!LOCAL_INPUT.test(trimmed)) return null;

  const date = new Date(`${trimmed}:00${OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The reverse: an instant, shown as Colombo wall-clock time for a datetime-local input. */
export function toLocalInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';

  const parts = partsInZone(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function partsInZone(date: Date): Record<'year' | 'month' | 'day' | 'hour' | 'minute', string> {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const out: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) out[part.type] = part.value;
  return out as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;
}

/** "3 Oct 2026, 20:00" in Colombo time. */
export function formatInZone(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/** Minutes and seconds, for a countdown: "1:05:09" or "4:07". */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "45 min", "1 h 30 min". */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
