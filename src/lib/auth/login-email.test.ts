import { describe, expect, it } from 'vitest';

import { loginEmailFor, looksLikeEmail, usernameLoginEmail } from './login-email';

describe('usernameLoginEmail', () => {
  it('expands a username against the configured domain', () => {
    expect(usernameLoginEmail('nimalperera001', 'physix.local')).toBe('nimalperera001@physix.local');
  });

  it('normalises case and whitespace so sign-in is forgiving', () => {
    expect(usernameLoginEmail('  NimalPerera001 ', 'physix.local')).toBe('nimalperera001@physix.local');
  });
});

describe('loginEmailFor', () => {
  it('uses the student’s own address when they have one', () => {
    expect(loginEmailFor({ username: 'nimal001', email: 'nimal@gmail.com' }, 'physix.local')).toBe(
      'nimal@gmail.com',
    );
  });

  it('lowercases the address, because sign-in is case-insensitive', () => {
    expect(loginEmailFor({ username: 'nimal001', email: 'Nimal.Perera@Gmail.com' }, 'physix.local')).toBe(
      'nimal.perera@gmail.com',
    );
  });

  it.each([null, undefined, '', '   '])(
    'falls back to the username form when the email is %s',
    (email) => {
      // A student with no mailbox must still be able to sign in.
      expect(loginEmailFor({ username: 'nimal001', email }, 'physix.local')).toBe('nimal001@physix.local');
    },
  );
});

describe('looksLikeEmail', () => {
  it.each([
    ['nimal@gmail.com', true],
    ['nimal001@physix.local', true],
    ['nimal001', false],
    ['nimal.perera', false],
  ])('%s → %s', (identifier, expected) => {
    expect(looksLikeEmail(identifier)).toBe(expected);
  });
});
