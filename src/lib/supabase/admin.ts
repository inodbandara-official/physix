import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { publicEnv, serverEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Service-role client. Bypasses Row Level Security completely.
 *
 * Used for exactly three things:
 *
 * 1. Creating, updating and deleting auth users, which the Supabase Auth
 *    admin API requires.
 * 2. The assessment pipeline in `src/features/attempts/privileged.ts`:
 *    reading the answer key a student may not see, and recording marks a
 *    student may not write. Each call there is made only after the
 *    caller's own RLS-bound client has proved access.
 * 3. A student's ranking (`src/features/rankings/queries.ts`), which needs
 *    classmates' totals. It runs only for batches the student's own client
 *    shows they belong to, and returns what the teacher's privacy setting
 *    allows — never another student's answers.
 *
 * Never use it anywhere else to read or write application data on behalf
 * of a request — that would silently defeat every RLS policy.
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
