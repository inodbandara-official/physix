import { z } from 'zod';

/**
 * Environment access is validated and cached, but evaluated lazily — on first
 * use, not at import time. A production build therefore succeeds without a
 * live Supabase project, while a misconfigured *deployment* fails on its first
 * request with a message that names the missing variable.
 *
 * Only NEXT_PUBLIC_* values reach the browser bundle. `serverEnv()` is a
 * separate function so nothing in the client graph can pull a secret in.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  AUTH_EMAIL_DOMAIN: z.string().min(3).default('physix.local'),
});

let cachedPublicEnv: z.infer<typeof publicSchema> | null = null;
let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

export function publicEnv(): z.infer<typeof publicSchema> {
  // The two reads below must stay written out in full: Next.js inlines
  // `process.env.NEXT_PUBLIC_*` only when it sees the literal expression.
  cachedPublicEnv ??= publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return cachedPublicEnv;
}

export function serverEnv(): z.infer<typeof serverSchema> {
  cachedServerEnv ??= serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AUTH_EMAIL_DOMAIN: process.env.AUTH_EMAIL_DOMAIN,
  });
  return cachedServerEnv;
}
