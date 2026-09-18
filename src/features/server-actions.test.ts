import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Next.js requires that a `'use server'` module export *only* async
 * functions. Anything else — a Zod schema, a constant, a helper — fails at
 * runtime with:
 *
 *   A "use server" file can only export async functions, found object.
 *
 * That error surfaces when the route is first requested, not at build or
 * type-check time, so nothing else in the pipeline catches it. This test
 * does, statically, across the whole codebase.
 *
 * It has caught two real regressions: a Zod schema exported from the
 * settings actions, and a pure helper exported from the question actions.
 */

const SRC = path.resolve(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}

function serverActionFiles(): string[] {
  return walk(SRC).filter((file) => {
    const head = readFileSync(file, 'utf8').slice(0, 200);
    return /^\s*['"]use server['"]/.test(head);
  });
}

/** Every `export ...` that is not `export async function`. */
function offendingExports(source: string): string[] {
  const offenders: string[] = [];

  for (const line of source.split('\n')) {
    if (!/^export\b/.test(line)) continue;
    if (/^export async function /.test(line)) continue;
    // `export type` and `export interface` are erased before runtime, but
    // they are still disallowed here to keep the rule simple to apply.
    offenders.push(line.trim());
  }

  return offenders;
}

describe('"use server" modules', () => {
  const files = serverActionFiles();

  it('finds the action modules', () => {
    // A guard on the guard: if the glob silently matched nothing, the tests
    // below would pass while checking nothing at all.
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(SRC, file), file]))(
    '%s exports only async functions',
    (_label, file) => {
      const offenders = offendingExports(readFileSync(file, 'utf8'));
      expect(
        offenders,
        `Move these out of the "use server" file — a schema belongs in schema.ts, ` +
          `a type in types.ts, a pure helper in its own module:\n  ${offenders.join('\n  ')}`,
      ).toEqual([]);
    },
  );
});
