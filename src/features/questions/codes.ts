/**
 * Question ID generation.
 *
 * Pure and dependency-free: a `'use server'` module may only export async
 * functions, and these are worth unit testing on their own.
 */

/** The next free `Q-0001`-style code. */
export function suggestQuestionCode(takenCodes: string[]): string {
  const taken = new Set(takenCodes.map((code) => code.toUpperCase()));
  for (let n = 1; n < 100000; n += 1) {
    const candidate = `Q-${String(n).padStart(4, '0')}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `Q-${Date.now().toString().slice(-6)}`;
}

/** `Q-0007` → `Q-0007-COPY`, then `-COPY2`, `-COPY3`, … */
export function nextCopyCode(original: string, taken: string[]): string {
  const used = new Set(taken.map((code) => code.toUpperCase()));
  const base = `${original}-COPY`;
  if (!used.has(base.toUpperCase())) return base;

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}${n}`;
    if (!used.has(candidate.toUpperCase())) return candidate;
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}
