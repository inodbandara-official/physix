'use client';

import { createBrowserClient } from '@supabase/ssr';

import { publicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser client, reused across renders so the auth listener is registered once. */
export function createSupabaseBrowserClient() {
  client ??= createBrowserClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    publicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return client;
}
