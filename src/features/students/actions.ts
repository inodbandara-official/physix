'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { requireTeacher } from '@/lib/auth/session';
import { loginEmailFor, usernameLoginEmail } from '@/lib/auth/login-email';
import { serverEnv } from '@/lib/env';
import { humanizeAuthError, humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { generatePassword } from './credentials';
import { createStudentSchema, setPasswordSchema, studentNoteSchema, updateStudentSchema } from './schema';

export interface CredentialResult {
  username: string;
  /** What the student actually types to sign in. */
  loginEmail: string;
  password: string;
  /** True when that is their own address, so they can reset it themselves. */
  usesOwnEmail: boolean;
}

function revalidateStudents(studentId?: string) {
  revalidatePath('/t/students');
  revalidatePath('/t/dashboard');
  if (studentId) revalidatePath(`/t/students/${studentId}`);
}

export async function createStudentAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  const session = await requireTeacher();

  const raw = formDataToObject(formData);
  raw.batch_ids = formData.getAll('batch_ids[]').map(String).filter(Boolean);
  const parsed = createStudentSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { batch_ids: batchIds, ...student } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: inserted, error } = await supabase
    .from('students')
    .insert({ ...student, joined_on: student.joined_on ?? new Date().toISOString().slice(0, 10) })
    .select('id, full_name')
    .single();

  if (error || !inserted) {
    return actionError(humanizeDatabaseError(error, 'The student could not be saved.'));
  }

  const membershipError = await syncBatchMemberships(inserted.id, batchIds);
  if (membershipError) return actionError(membershipError);

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'student.create',
    entityType: 'student',
    entityId: inserted.id,
    summary: `Created student ${student.student_code} (${inserted.full_name}).`,
  });

  revalidateStudents(inserted.id);
  return actionSuccess('Student added.', { id: inserted.id });
}

export async function updateStudentAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  const session = await requireTeacher();

  const raw = formDataToObject(formData);
  raw.batch_ids = formData.getAll('batch_ids[]').map(String).filter(Boolean);
  const parsed = updateStudentSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const { id, batch_ids: batchIds, ...student } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: before } = await supabase
    .from('students')
    .select('profile_id, email, username, login_email')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('students').update(student).eq('id', id);
  if (error) return actionError(humanizeDatabaseError(error, 'The changes could not be saved.'));

  const membershipError = await syncBatchMemberships(id, batchIds);
  if (membershipError) return actionError(membershipError);

  const loginChange = before
    ? await syncLoginEmail(id, before, student.email ?? null, student.username)
    : null;

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'student.update',
    entityType: 'student',
    entityId: id,
    summary: loginChange
      ? `Updated student ${student.student_code}; sign-in address is now ${loginChange}.`
      : `Updated student ${student.student_code}.`,
  });

  revalidateStudents(id);
  return actionSuccess(
    loginChange ? `Changes saved. They now sign in as ${loginChange}.` : 'Changes saved.',
    { id },
  );
}

/**
 * Keeps the Supabase Auth account in step with the student's email address.
 *
 * The record and the auth user must never disagree about what a student
 * types to sign in. Three things can happen when the email is edited:
 *
 * - an address is **added** to a student who was signing in by username —
 *   they move to email sign-in, and gain self-service password reset
 * - an address is **changed** — the auth account moves with it
 * - an address is **removed** — they fall back to the username form rather
 *   than being left with no way in at all
 *
 * Returns the new sign-in address when it changed, so the teacher can be
 * told; `null` when nothing moved.
 */
async function syncLoginEmail(
  studentId: string,
  before: { profile_id: string | null; login_email: string | null },
  nextEmail: string | null,
  username: string,
): Promise<string | null> {
  // No account yet: the address is simply recorded, and whatever it says at
  // the moment credentials are issued is what the account gets.
  if (!before.profile_id) return null;

  const fallback = usernameLoginEmail(username, serverEnv().AUTH_EMAIL_DOMAIN);
  const desired = (nextEmail?.trim().toLowerCase() || fallback);
  const current = before.login_email?.toLowerCase() ?? fallback;

  if (desired === current) return null;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(before.profile_id, {
    email: desired,
    // The teacher made this change deliberately, and a student who cannot
    // sign in until they click a confirmation link is a support call.
    email_confirm: true,
  });

  if (error) {
    console.error('[students] auth email sync failed', error.message);
    return null;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from('students').update({ login_email: desired }).eq('id', studentId);

  return desired;
}

/**
 * Membership is edited as a set: rows the student should no longer be in are
 * closed with `left_at` rather than deleted, so historical batch results stay
 * attributable later on.
 */
async function syncBatchMemberships(studentId: string, batchIds: string[]): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from('batch_members')
    .select('batch_id, left_at')
    .eq('student_id', studentId);

  const current = new Set((existing ?? []).filter((row) => row.left_at === null).map((row) => row.batch_id));
  const wanted = new Set(batchIds);

  const toAdd = [...wanted].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !wanted.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase.from('batch_members').upsert(
      toAdd.map((batchId) => ({ batch_id: batchId, student_id: studentId, joined_at: new Date().toISOString(), left_at: null })),
      { onConflict: 'batch_id,student_id' },
    );
    if (error) return humanizeDatabaseError(error, 'The student was saved, but batch changes failed.');
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('batch_members')
      .update({ left_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .in('batch_id', toRemove);
    if (error) return humanizeDatabaseError(error, 'The student was saved, but batch changes failed.');
  }

  return null;
}

export async function setStudentStatusAction(
  studentId: string,
  status: 'active' | 'inactive' | 'suspended',
): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { data: student, error } = await supabase
    .from('students')
    .update({ status })
    .eq('id', studentId)
    .select('student_code, profile_id')
    .single();

  if (error || !student) {
    return actionError(humanizeDatabaseError(error, 'The status could not be changed.'));
  }

  // A suspended or inactive student keeps their record but loses access: the
  // auth user is banned so an existing session cannot be refreshed.
  if (student.profile_id) {
    const admin = createSupabaseAdminClient();
    await admin.auth.admin.updateUserById(student.profile_id, {
      ban_duration: status === 'active' ? 'none' : '876000h',
    });
  }

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'student.status',
    entityType: 'student',
    entityId: studentId,
    summary: `Set ${student.student_code} to ${status}.`,
    metadata: { status },
  });

  revalidateStudents(studentId);
  return actionSuccess(`Student marked ${status}.`);
}

export async function archiveStudentAction(studentId: string, archived: boolean): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { data: student, error } = await supabase
    .from('students')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', studentId)
    .select('student_code, profile_id, status')
    .single();

  if (error || !student) {
    return actionError(humanizeDatabaseError(error, 'The student could not be archived.'));
  }

  // Archiving takes a student off the roll, so it must also take away access.
  // Restoring only returns access if their status is otherwise active — an
  // archived-then-restored suspended student stays suspended.
  if (student.profile_id) {
    const admin = createSupabaseAdminClient();
    const banned = archived || student.status !== 'active';
    await admin.auth.admin.updateUserById(student.profile_id, {
      ban_duration: banned ? '876000h' : 'none',
    });
  }

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: archived ? 'student.archive' : 'student.restore',
    entityType: 'student',
    entityId: studentId,
    summary: `${archived ? 'Archived' : 'Restored'} student ${student.student_code}.`,
  });

  revalidateStudents(studentId);
  return actionSuccess(archived ? 'Student archived.' : 'Student restored.');
}

/**
 * Creates the login account for an existing student record, or resets the
 * password of one that already has an account. Returns the credentials once;
 * they are not recoverable afterwards.
 */
export async function issueCredentialsAction(
  _prev: ActionState<CredentialResult>,
  formData: FormData,
): Promise<ActionState<CredentialResult>> {
  const session = await requireTeacher();

  const parsed = setPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase
    .from('students')
    .select('id, username, email, login_email, full_name, profile_id, status')
    .eq('id', parsed.data.student_id)
    .maybeSingle();

  if (!student) return actionError('That student could not be found.');

  const password = parsed.data.password ?? generatePassword();
  // Their own address where they have one, so they can reset their own
  // password and receive notifications; the username fallback otherwise.
  const loginEmail = student.login_email ?? loginEmailFor(student, serverEnv().AUTH_EMAIL_DOMAIN);
  const admin = createSupabaseAdminClient();

  if (student.profile_id) {
    const { error } = await admin.auth.admin.updateUserById(student.profile_id, { password });
    if (error) return actionError(humanizeAuthError(error, 'The password could not be reset.'));
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      // The teacher hands the password over in person, so there is nothing to
      // confirm by email before the student can sign in.
      email_confirm: true,
      app_metadata: { role: 'student' },
      user_metadata: { full_name: student.full_name },
    });
    if (error || !created.user) {
      return actionError(humanizeAuthError(error, 'The login account could not be created.'));
    }

    const { error: linkError } = await supabase
      .from('students')
      .update({ profile_id: created.user.id, login_email: loginEmail })
      .eq('id', student.id);

    if (linkError) {
      // Roll the auth user back so a retry is not blocked by a half-created account.
      await admin.auth.admin.deleteUser(created.user.id);
      return actionError(humanizeDatabaseError(linkError, 'The login account could not be linked.'));
    }
  }

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: student.profile_id ? 'student.password_reset' : 'student.account_create',
    entityType: 'student',
    entityId: student.id,
    summary: `${student.profile_id ? 'Reset password for' : 'Created login account for'} ${student.username}.`,
  });

  revalidateStudents(student.id);
  return actionSuccess(
    student.profile_id ? 'Password reset. Share it with the student now.' : 'Account created.',
    { username: student.username, loginEmail, password, usesOwnEmail: Boolean(student.email) },
  );
}

export async function addStudentNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireTeacher();

  const raw = formDataToObject(formData);
  raw.published = formData.get('published') === 'on';
  const parsed = studentNoteSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('student_notes').insert({
    student_id: parsed.data.student_id,
    author_id: session.userId,
    body: parsed.data.body,
    published: parsed.data.published,
  });

  if (error) return actionError(humanizeDatabaseError(error, 'The note could not be saved.'));

  revalidateStudents(parsed.data.student_id);
  return actionSuccess('Note saved.');
}

export async function deleteStudentNoteAction(noteId: string, studentId: string): Promise<ActionState> {
  await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from('student_notes').delete().eq('id', noteId);
  if (error) return actionError(humanizeDatabaseError(error, 'The note could not be deleted.'));

  revalidateStudents(studentId);
  return actionSuccess('Note deleted.');
}
