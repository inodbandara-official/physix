import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { publicEnv, serverEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Service-role client. Bypasses Row Level Security completely.
 *
 * Use it for exactly one thing: creating, updating and deleting auth users,
 * which the Supabase Auth admin API requires. Never use it to read or write
 * application data on behalf of a request — that would silently defeat every
 * RLS policy in migration 0001.
 *
 * The `server-only` import above makes it a build error to reach this file
 * from a Client Component.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
