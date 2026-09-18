/**
 * Working out which address a student's auth account uses.
 *
 * Two kinds of student exist, and both must be able to sign in:
 *
 * - **With an email.** Their own address is the login identity, which is
 *   what makes self-service password reset and email notifications work.
 * - **Without one.** Many A/L students have no mailbox, so the username the
 *   teacher issued is expanded against a fixed domain that never has to
 *   receive mail. They keep teacher-issued password resets.
 *
 * Which of the two applies is *recorded* on the student as `login_email`
 * when credentials are issued, never recomputed — changing
 * AUTH_EMAIL_DOMAIN later must not silently invalidate existing logins.
 */

/** The fallback address for a student with no email of their own. */
export function usernameLoginEmail(username: string, domain: string): string {
  return `${username.trim().toLowerCase()}@${domain}`;
}

/** The address a new account should be created with. */
export function loginEmailFor(
  student: { username: string; email?: string | null },
  domain: string,
): string {
  const email = student.email?.trim().toLowerCase();
  return email && email !== '' ? email : usernameLoginEmail(student.username, domain);
}

/** True when the identifier typed on the sign-in form is an email address. */
export function looksLikeEmail(identifier: string): boolean {
  return identifier.includes('@');
}
