import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Raw Postgres errors are never shown to a user (§57). Everything that can
 * surface in the UI passes through here first.
 */

/** Maps a unique-index name to the sentence a teacher should actually read. */
const UNIQUE_VIOLATION_MESSAGES: Record<string, string> = {
  students_student_code_key: 'A student with this Student ID already exists.',
  students_username_key: 'That username is already taken. Choose another.',
  students_email_key: 'Another student already uses that email address.',
  students_login_email_key: 'Another student already signs in with that email address.',
  students_profile_id_key: 'That login account is already linked to a different student.',
  batches_name_year_key: 'A batch with this name already exists for that A/L year.',
  batches_code_key: 'A batch with this code already exists.',
  syllabus_nodes_sibling_name_key: 'An item with this name already exists at the same level.',
  batch_members_pkey: 'That student is already in this batch.',
};

const CODE_MESSAGES: Record<string, string> = {
  '23503': 'That record is still linked to something else, so it cannot be removed.',
  '23514': 'Some of the values entered are outside the allowed range.',
  '23502': 'A required field was left empty.',
  '22P02': 'One of the values was not in the expected format.',
  '42501': 'You do not have permission to do that.',
  PGRST116: 'That record could not be found.',
};

export function humanizeDatabaseError(error: PostgrestError | null | undefined, fallback: string): string {
  if (!error) return fallback;

  if (error.code === '23505') {
    for (const [constraint, message] of Object.entries(UNIQUE_VIOLATION_MESSAGES)) {
      if (error.message.includes(constraint) || error.details?.includes(constraint)) return message;
    }
    return 'That value is already in use.';
  }

  // Constraint triggers raise check_violation with a message written for humans.
  if (error.code === '23514' && error.message && !error.message.includes('violates')) {
    return error.message;
  }

  return CODE_MESSAGES[error.code] ?? fallback;
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect username or password.',
  email_not_confirmed: 'This account has not been activated yet. Ask your teacher to activate it.',
  over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
  user_already_exists: 'An account already exists for this username.',
  weak_password: 'That password is too weak. Use at least 8 characters.',
};

export function humanizeAuthError(error: { code?: string; message: string } | null, fallback: string): string {
  if (!error) return fallback;
  if (error.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code];
  if (error.message.toLowerCase().includes('invalid login credentials')) {
    return AUTH_MESSAGES.invalid_credentials;
  }
  return fallback;
}
