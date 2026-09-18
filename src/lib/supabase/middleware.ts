import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { publicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Refreshes the Supabase session cookie on every request and reports who the
 * caller is. Middleware runs on the edge and must never be the *only* place a
 * role is checked — every page and Server Action re-checks server-side.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    publicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: Database['public']['Enums']['user_role'] | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    role = data?.role ?? null;
  }

  return { response, user, role };
}
