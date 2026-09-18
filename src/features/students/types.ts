/**
 * Types shared across the students feature.
 *
 * Kept out of `actions.ts` because a `'use server'` module may only export
 * async functions.
 */

export interface CredentialResult {
  username: string;
  /** What the student actually types to sign in. */
  loginEmail: string;
  password: string;
  /** True when that is their own address, so they can reset it themselves. */
  usesOwnEmail: boolean;
}
