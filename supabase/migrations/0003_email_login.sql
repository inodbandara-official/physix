-- =====================================================================
-- PHYSIX LMS — Migration 0003: Email as the login identity
--
-- Students now sign in with their own email address where they have one,
-- which gives them self-service password reset and gives the teacher an
-- address to send notifications to. Students without an email keep the
-- username@AUTH_EMAIL_DOMAIN fallback, because a student with no mailbox
-- must not be locked out.
--
-- `login_email` records the address the auth account actually uses, so the
-- app never has to guess which of the two applies to a given student.
-- =====================================================================

alter table public.students
  add column if not exists login_email text;

comment on column public.students.email is
  'The student''s own email address. Used for signing in and for notifications. Optional.';
comment on column public.students.login_email is
  'The address the Supabase Auth account uses: the student''s own email when they have one, otherwise username@AUTH_EMAIL_DOMAIN. Written only when credentials are issued.';

-- Two students cannot share an email address, because it is a login
-- identity. Enforced case-insensitively, and only over rows that have one.
create unique index if not exists students_email_key
  on public.students (lower(email))
  where email is not null;

create unique index if not exists students_login_email_key
  on public.students (lower(login_email))
  where login_email is not null;

-- Backfill: every student who already has an account signed up under the
-- synthetic domain, and that is still the address their auth user holds.
-- It is recorded rather than recomputed so a later change to
-- AUTH_EMAIL_DOMAIN cannot silently invalidate existing logins.
update public.students
   set login_email = lower(username) || '@' || coalesce(
     current_setting('app.auth_email_domain', true),
     'physix.local'
   )
 where profile_id is not null
   and login_email is null;
