import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppSettingsRow } from '@/types/database';

/**
 * Brand identity is data, not code (§43). Nothing in the UI hardcodes the
 * teacher's name or the LMS name; both come from the singleton
 * `app_settings` row and can be edited from Settings.
 */
export const DEFAULT_BRAND: AppSettingsRow = {
  id: true,
  lms_name: 'PHYSIX',
  tagline: 'Advanced Level Physics',
  teacher_name: null,
  logo_url: null,
  primary_color: '#2f6bff',
  secondary_color: '#12b3a6',
  contact_email: null,
  contact_phone: null,
  updated_at: new Date(0).toISOString(),
};

export const getBrand = cache(async (): Promise<AppSettingsRow> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('app_settings').select('*').maybeSingle();
  return data ?? DEFAULT_BRAND;
});
