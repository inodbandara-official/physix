import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ProfileRow, StudentRow, UserRole } from '@/types/database';

export interface Session {
  userId: string;
  email: string;
  profile: ProfileRow;
}

/**
 * The authoritative identity check. Middleware is a convenience redirect;
 * this is the gate. Every page, loader and Server Action calls one of the
 * `require*` helpers below before touching data.
 *
 * `cache` dedupes the lookup within a single request, so a page that renders
 * six server components still makes one auth round-trip.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) return null;

  return { userId: user.id, email: user.email ?? profile.email, profile };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireRole(role: UserRole): Promise<Session> {
  const session = await requireSession();
  if (session.profile.role !== role) {
    redirect(session.profile.role === 'teacher' ? '/t/dashboard' : '/s/dashboard');
  }
  return session;
}

export const requireTeacher = () => requireRole('teacher');

/** A student session plus the student record it is attached to. */
export const requireStudent = cache(async (): Promise<Session & { student: StudentRow }> => {
  const session = await requireRole('student');
  const supabase = await createSupabaseServerClient();

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('profile_id', session.userId)
    .maybeSingle();

  // A profile with role 'student' but no student record means the account was
  // created outside the normal flow. Treat it as unauthenticated rather than
  // guessing which records it may read.
  if (!student) redirect('/login?error=no-student-record');

  return { ...session, student };
});
