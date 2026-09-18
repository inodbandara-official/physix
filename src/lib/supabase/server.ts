import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { publicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Request-scoped Supabase client carrying the caller's session.
 *
 * Every query made through this client is subject to Row Level Security, so
 * it is the only client that should ever touch user data.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    publicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled by middleware instead.
          }
        },
      },
    },
  );
}
