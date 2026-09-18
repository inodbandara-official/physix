import { randomInt } from 'node:crypto';

/**
 * Passwords are generated here and shown to the teacher exactly once, at the
 * moment of creation or reset. They are never stored in our tables and never
 * written to the audit log — Supabase Auth holds the only (hashed) copy.
 *
 * The word list is deliberately plain and unambiguous: these get read aloud
 * in a classroom and typed on a phone keyboard.
 */
const WORDS = [
  'amber', 'atom', 'basalt', 'carbon', 'cobalt', 'comet', 'copper', 'crater',
  'delta', 'ember', 'field', 'flux', 'gamma', 'granite', 'helix', 'ion',
  'joule', 'kelvin', 'laser', 'lumen', 'mica', 'newton', 'ohm', 'orbit',
  'photon', 'prism', 'quartz', 'quasar', 'radian', 'signal', 'solar', 'tesla',
  'torque', 'vector', 'volt', 'watt', 'xenon', 'zenith',
];

export function generatePassword(): string {
  const first = WORDS[randomInt(WORDS.length)];
  const second = WORDS[randomInt(WORDS.length)];
  const digits = String(randomInt(10, 100));
  return `${first}-${second}-${digits}`;
}

/** Suggests the next free student code in the `PHY-<year>-<nnn>` family. */
export function suggestStudentCode(alYear: number | null, takenCodes: string[]): string {
  const year = alYear ?? new Date().getFullYear() + 1;
  const prefix = `PHY-${year}-`;
  const taken = new Set(takenCodes.map((code) => code.toUpperCase()));
  for (let n = 1; n < 1000; n += 1) {
    const candidate = `${prefix}${String(n).padStart(3, '0')}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${prefix}${Date.now().toString().slice(-4)}`;
}

/** Turns a full name into a username stem, e.g. "Nimal Perera" -> "nimalperera". */
export function suggestUsername(fullName: string, studentCode: string): string {
  const stem = fullName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
  const suffix = studentCode.replace(/[^A-Za-z0-9]/g, '').slice(-3).toLowerCase();
  const candidate = `${stem}${suffix}`;
  return candidate.length >= 3 ? candidate : `student${suffix || '001'}`;
}
