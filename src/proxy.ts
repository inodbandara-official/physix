import { NextResponse, type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

const TEACHER_PREFIX = '/t';
const STUDENT_PREFIX = '/s';
// Signed-out only: a signed-in visitor is sent to their own dashboard.
const SIGNED_OUT_PATHS = new Set(['/login', '/forgot-password']);

// Reachable either way. Following a recovery link establishes a session, so
// bouncing a "signed-in" visitor away from it would break the reset flow.
const ALWAYS_PUBLIC = new Set(['/reset-password']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user, role } = await updateSession(request);

  const isSignedOutOnly = SIGNED_OUT_PATHS.has(pathname);
  const isProtected = pathname.startsWith(TEACHER_PREFIX) || pathname.startsWith(STUDENT_PREFIX);

  if (ALWAYS_PUBLIC.has(pathname)) return response;

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && isSignedOutOnly) {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  // Wrong-role access is bounced to the caller's own home rather than to a
  // 403, so a student never learns which teacher routes exist.
  if (user && pathname.startsWith(TEACHER_PREFIX) && role !== 'teacher') {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  if (user && pathname.startsWith(STUDENT_PREFIX) && role !== 'student') {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  return response;
}

function homeFor(role: string | null) {
  if (role === 'teacher') return '/t/dashboard';
  if (role === 'student') return '/s/dashboard';
  return '/login';
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
