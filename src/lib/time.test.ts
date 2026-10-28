import { describe, expect, it } from 'vitest';

import { formatCountdown, formatDuration, fromLocalInput, toLocalInput } from './time';

describe('Colombo wall-clock conversion', () => {
  it('reads a datetime-local value as Sri Lankan time', () => {
    // 20:00 in Colombo is 14:30 UTC.
    expect(fromLocalInput('2026-10-03T20:00')).toBe('2026-10-03T14:30:00.000Z');
  });

  it('round-trips', () => {
    expect(toLocalInput(fromLocalInput('2026-01-15T07:45'))).toBe('2026-01-15T07:45');
  });

  it('crosses midnight correctly', () => {
    // 02:00 in Colombo on the 1st is still the previous day in UTC.
    expect(fromLocalInput('2026-11-01T02:00')).toBe('2026-10-31T20:30:00.000Z');
    expect(toLocalInput('2026-10-31T20:30:00.000Z')).toBe('2026-11-01T02:00');
  });

  it('rejects blank and malformed input', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput(undefined)).toBeNull();
    expect(fromLocalInput('tomorrow')).toBeNull();
    expect(toLocalInput('not a date')).toBe('');
  });
});

describe('formatCountdown', () => {
  it('formats minutes and hours', () => {
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(3 * 3600 + 7 * 60 + 9)).toBe('3:07:09');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('formatDuration', () => {
  it('formats short and long durations', () => {
    expect(formatDuration(45 * 60)).toBe('45 min');
    expect(formatDuration(90 * 60)).toBe('1 h 30 min');
    expect(formatDuration(120 * 60)).toBe('2 h');
  });
});
