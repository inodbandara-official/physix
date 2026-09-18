'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { looksLikeEmail, usernameLoginEmail } from '@/lib/auth/login-email';
import { serverEnv } from '@/lib/env';
import { humanizeAuthError } from '@/lib/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { changePasswordSchema, requestResetSchema, setNewPasswordSchema, signInSchema } from './schema';

/**
 * Resolves what the visitor typed into the address Supabase Auth knows.
 *
 * An email is used as given. A username is looked up against the students
 * table using the service-role client — server-side only, and the result is
 * never returned to the browser, so this cannot be used to enumerate
 * usernames or discover anyone's email address.
 */
async function resolveLoginEmail(identifier: string): Promise<string> {
  const trimmed = identifier.trim().toLowerCase();
  if (looksLikeEmail(trimmed)) return trimmed;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('students')
    .select('login_email, email, username')
    .ilike('username', trimmed)
    .maybeSingle();

  if (data?.login_email) return data.login_email.toLowerCase();

  // No account issued yet, or a pre-0003 record: fall back to the derived
  // address. Sign-in then fails with the same generic message as a wrong
  // password, which is what we want.
  return usernameLoginEmail(trimmed, serverEnv().AUTH_EMAIL_DOMAIN);
}

/**
 * One sign-in form for everyone. A teacher uses their email; a student uses
 * their own email if they have one, otherwise the username you issued them.
 */
export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { identifier, password, next } = parsed.data;
  const email = await resolveLoginEmail(identifier);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return actionError(humanizeAuthError(error, 'Incorrect username or password.'));
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();

  const destination =
    next && next.startsWith('/') && !next.startsWith('//')
      ? next
      : profile?.role === 'teacher'
        ? '/t/dashboard'
        : '/s/dashboard';

  redirect(destination);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Sends a password reset link.
 *
 * Always reports success, whether or not an account exists. Saying "no such
 * account" would turn this form into a way of testing which of your
 * students' addresses are registered.
 *
 * Only works for someone whose login identity is a real mailbox. A student
 * signing in with a username has no address to send to, and is told to ask
 * their teacher instead.
 */
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestResetSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const email = parsed.data.email.trim().toLowerCase();
  const confirmation = actionSuccess(
    'If that address has an account, a reset link is on its way. Check your inbox and your spam folder.',
  );

  const domain = serverEnv().AUTH_EMAIL_DOMAIN.toLowerCase();
  if (email.endsWith(`@${domain}`)) return confirmation;

  const origin = (await headers()).get('origin');
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin ? `${origin}/reset-password` : undefined,
  });

  // A rate-limit is worth surfacing; anything else is swallowed so the
  // response does not reveal whether the address is known.
  if (error?.code === 'over_email_send_rate_limit') {
    return actionError('Too many reset emails have been requested. Try again in a few minutes.');
  }

  return confirmation;
}

/** Completes a reset: the recovery link has already established a session. */
export async function setNewPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = setNewPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return actionError('This reset link has expired. Request a new one.');
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
  if (error) return actionError(humanizeAuthError(error, 'The password could not be changed.'));

  return actionSuccess('Password changed. You can sign in with it now.');
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = changePasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return actionError('You are not signed in.');

  // Re-authenticate before changing the password, so a walked-away-from session
  // cannot be used to lock the real owner out.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  });
  if (verifyError) return actionError('Your current password is not correct.');

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
  if (error) return actionError(humanizeAuthError(error, 'The password could not be changed.'));

  return actionSuccess('Password changed.');
}
