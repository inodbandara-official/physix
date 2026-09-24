'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, type ActionState } from '@/lib/action';
import { requireSession } from '@/lib/auth/session';
import { humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { contentLanguageSchema } from './schema';

/**
 * Switches the reading language for whoever is signed in.
 *
 * Stored on `profiles`, which a person owns, rather than on `students`,
 * which they must not be able to write to — that row carries their status
 * and their login email. The existing profile policy pins `role`, so the
 * worst this can do is change someone's own language.
 */
export async function setLanguageAction(language: string): Promise<ActionState> {
  const session = await requireSession();

  const parsed = contentLanguageSchema.safeParse(language);
  if (!parsed.success) return actionError('That language is not available.');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({ language: parsed.data })
    .eq('id', session.userId);

  if (error) {
    return actionError(humanizeDatabaseError(error, 'Your language could not be changed.'));
  }

  // Language changes what every page renders, so the whole tree is stale.
  revalidatePath('/', 'layout');

  return actionSuccess(parsed.data === 'si' ? 'භාෂාව සිංහල ලෙස වෙනස් කරන ලදී.' : 'Language changed to English.');
}
