import { describe, expect, it } from 'vitest';

import { USERNAME_PATTERN } from './schema';
import { generatePassword, suggestStudentCode, suggestUsername } from './credentials';

describe('generatePassword', () => {
  it('produces a password long enough to satisfy the auth policy', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generatePassword().length).toBeGreaterThanOrEqual(8);
    }
  });

  it('does not repeat itself across calls', () => {
    const generated = new Set(Array.from({ length: 100 }, () => generatePassword()));
    expect(generated.size).toBeGreaterThan(80);
  });
});

describe('suggestStudentCode', () => {
  it('starts at 001 for an empty roll', () => {
    expect(suggestStudentCode(2026, [])).toBe('PHY-2026-001');
  });

  it('skips codes already in use', () => {
    expect(suggestStudentCode(2026, ['PHY-2026-001', 'PHY-2026-002'])).toBe('PHY-2026-003');
  });

  it('ignores case when checking which codes are taken', () => {
    expect(suggestStudentCode(2026, ['phy-2026-001'])).toBe('PHY-2026-002');
  });

  it('does not collide with codes from a different year', () => {
    expect(suggestStudentCode(2027, ['PHY-2026-001'])).toBe('PHY-2027-001');
  });
});

describe('suggestUsername', () => {
  it('builds a username from the name and code', () => {
    expect(suggestUsername('Nimal Perera', 'PHY-2026-007')).toBe('nimalperera007');
  });

  it('strips accents and punctuation', () => {
    expect(suggestUsername("D'Silva Fernández", 'PHY-2026-012')).toBe('dsilvafernandez012');
  });

  it('always produces something the username rule accepts', () => {
    for (const name of ['Nimal Perera', 'A', '???', 'Ruwan Bandara Wickramasinghe']) {
      expect(USERNAME_PATTERN.test(suggestUsername(name, 'PHY-2026-001'))).toBe(true);
    }
  });
});
