import { describe, expect, it } from 'vitest';

import { studentFiltersSchema, studentSchema } from './schema';

const valid = {
  student_code: 'PHY-2026-001',
  username: 'nimalperera001',
  full_name: 'Nimal Perera',
};

describe('studentSchema', () => {
  it('accepts a minimal record', () => {
    const result = studentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('active');
      expect(result.data.batch_ids).toEqual([]);
    }
  });

  it('rejects a student code with spaces', () => {
    const result = studentSchema.safeParse({ ...valid, student_code: 'PHY 2026 001' });
    expect(result.success).toBe(false);
  });

  it('lowercases the username so logins are case-insensitive', () => {
    const result = studentSchema.safeParse({ ...valid, username: 'NimalPerera001' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.username).toBe('nimalperera001');
  });

  it.each(['ab', 'has space', '.leadingdot', 'UPPER'])('rejects invalid username %s', (username) => {
    // 'UPPER' is normalised to lowercase first, so it is accepted; the rest are not.
    const result = studentSchema.safeParse({ ...valid, username });
    expect(result.success).toBe(username === 'UPPER');
  });

  it('treats an empty email as absent rather than invalid', () => {
    const result = studentSchema.safeParse({ ...valid, email: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBeUndefined();
  });

  it('rejects a malformed email', () => {
    const result = studentSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects an A/L year outside the allowed range', () => {
    expect(studentSchema.safeParse({ ...valid, al_year: 1999 }).success).toBe(false);
    expect(studentSchema.safeParse({ ...valid, al_year: 2026 }).success).toBe(true);
  });
});

describe('studentFiltersSchema', () => {
  it('falls back to sensible defaults for an empty query string', () => {
    const filters = studentFiltersSchema.parse({});
    expect(filters).toMatchObject({ archived: 'active', page: 1, perPage: 25 });
  });

  it('coerces numeric query parameters', () => {
    const filters = studentFiltersSchema.parse({ page: '3', perPage: '50' });
    expect(filters.page).toBe(3);
    expect(filters.perPage).toBe(50);
  });

  it('refuses a page size large enough to be a denial-of-service lever', () => {
    expect(studentFiltersSchema.safeParse({ perPage: '5000' }).success).toBe(false);
  });
});
