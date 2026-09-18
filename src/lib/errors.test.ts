import { describe, expect, it } from 'vitest';
import type { PostgrestError } from '@supabase/supabase-js';

import { humanizeAuthError, humanizeDatabaseError } from './errors';

function pgError(partial: Partial<PostgrestError>): PostgrestError {
  const base = { name: 'PostgrestError', message: '', details: '', hint: '', code: '', ...partial };
  return { ...base, toJSON: () => base } as PostgrestError;
}

describe('humanizeDatabaseError', () => {
  it('never leaks a raw Postgres error to the user', () => {
    const message = humanizeDatabaseError(
      pgError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "students_student_code_key"',
      }),
      'fallback',
    );

    expect(message).toBe('A student with this Student ID already exists.');
    expect(message).not.toMatch(/23505|constraint|duplicate key/i);
  });

  it('maps each known unique index to its own sentence', () => {
    expect(
      humanizeDatabaseError(pgError({ code: '23505', message: 'students_username_key' }), 'fallback'),
    ).toBe('That username is already taken. Choose another.');

    expect(
      humanizeDatabaseError(pgError({ code: '23505', message: 'batches_name_year_key' }), 'fallback'),
    ).toBe('A batch with this name already exists for that A/L year.');
  });

  it('falls back to a generic sentence for an unknown unique index', () => {
    const message = humanizeDatabaseError(pgError({ code: '23505', message: 'some_other_key' }), 'fallback');
    expect(message).toBe('That value is already in use.');
  });

  it('passes through a trigger message written for humans', () => {
    const message = humanizeDatabaseError(
      pgError({ code: '23514', message: 'Only a unit can sit at the top of the syllabus.' }),
      'fallback',
    );
    expect(message).toBe('Only a unit can sit at the top of the syllabus.');
  });

  it('maps a permission failure without hinting at what exists', () => {
    expect(humanizeDatabaseError(pgError({ code: '42501' }), 'fallback')).toBe(
      'You do not have permission to do that.',
    );
  });

  it('uses the caller’s fallback for an unrecognised code', () => {
    expect(humanizeDatabaseError(pgError({ code: 'XX000' }), 'Could not save.')).toBe('Could not save.');
    expect(humanizeDatabaseError(null, 'Could not save.')).toBe('Could not save.');
  });
});

describe('humanizeAuthError', () => {
  it('gives the same message whether the username or the password was wrong', () => {
    // Distinguishing the two would let an attacker enumerate usernames.
    expect(humanizeAuthError({ message: 'Invalid login credentials' }, 'fallback')).toBe(
      'Incorrect username or password.',
    );
    expect(humanizeAuthError({ code: 'invalid_credentials', message: 'x' }, 'fallback')).toBe(
      'Incorrect username or password.',
    );
  });

  it('falls back when the error is not recognised', () => {
    expect(humanizeAuthError({ message: 'network unreachable' }, 'Try again.')).toBe('Try again.');
  });
});

