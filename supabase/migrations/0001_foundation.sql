-- =====================================================================
-- PHYSIX LMS — Migration 0001: Foundation
-- Phase 1: identity, roles, students, batches, syllabus, settings, audit
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('teacher', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('active', 'inactive', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.syllabus_kind as enum ('unit', 'topic', 'subtopic');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles — one row per auth user. Role lives here.
--
-- SECURITY: role is seeded from raw_app_meta_data (writable only by the
-- service role), never from raw_user_meta_data (writable by the client).
-- A self-signup therefore cannot mint a teacher account.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  role           public.user_role not null default 'student',
  full_name      text not null default '',
  preferred_name text,
  email          text not null default '',
  avatar_url     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'student'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Authorisation helpers.
--
-- SECURITY DEFINER so that policies on `profiles` do not recurse into
-- themselves. Both are STABLE, so the planner evaluates them once per
-- statement rather than once per row.
-- ---------------------------------------------------------------------
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
  );
$$;

-- ---------------------------------------------------------------------
-- students
--
-- A student record may exist before a login account does; profile_id is
-- therefore nullable. `username` is the login identity — the auth email
-- is derived as username@<AUTH_EMAIL_DOMAIN>, because many A/L students
-- have no personal email address. `email` below is a *contact* address.
-- ---------------------------------------------------------------------
create table if not exists public.students (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid unique references public.profiles (id) on delete set null,
  student_code   text not null,
  username       text not null,
  full_name      text not null,
  preferred_name text,
  email          text,
  phone          text,
  guardian_name  text,
  guardian_phone text,
  school         text,
  district       text,
  al_year        integer,
  status         public.account_status not null default 'active',
  joined_on      date not null default current_date,
  notes          text,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint students_al_year_range check (al_year is null or al_year between 2000 and 2100)
);

create unique index if not exists students_student_code_key
  on public.students (lower(student_code));
create unique index if not exists students_username_key
  on public.students (lower(username));
create index if not exists students_status_idx on public.students (status);
create index if not exists students_al_year_idx on public.students (al_year);
create index if not exists students_archived_idx on public.students (archived_at);
create index if not exists students_name_trgm_idx
  on public.students using gin (full_name gin_trgm_ops);
create index if not exists students_code_trgm_idx
  on public.students using gin (student_code gin_trgm_ops);

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id from public.students s where s.profile_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- batches + membership
-- ---------------------------------------------------------------------
create table if not exists public.batches (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  code          text,
  al_year       integer,
  description   text,
  schedule_note text,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint batches_al_year_range check (al_year is null or al_year between 2000 and 2100)
);

create unique index if not exists batches_name_year_key
  on public.batches (lower(name), coalesce(al_year, -1));
create unique index if not exists batches_code_key
  on public.batches (lower(code)) where code is not null;
create index if not exists batches_archived_idx on public.batches (archived_at);

drop trigger if exists batches_set_updated_at on public.batches;
create trigger batches_set_updated_at
  before update on public.batches
  for each row execute function public.set_updated_at();

create table if not exists public.batch_members (
  batch_id   uuid not null references public.batches (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  primary key (batch_id, student_id)
);

create index if not exists batch_members_student_idx on public.batch_members (student_id);
create index if not exists batch_members_active_idx
  on public.batch_members (batch_id) where left_at is null;

-- ---------------------------------------------------------------------
-- syllabus_nodes — one self-referencing tree instead of three tables.
-- unit -> topic -> subtopic, enforced by trigger so the teacher can
-- reorder/rename/archive freely without migrations.
-- ---------------------------------------------------------------------
create table if not exists public.syllabus_nodes (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.syllabus_nodes (id) on delete restrict,
  kind        public.syllabus_kind not null,
  name        text not null,
  code        text,
  description text,
  sort_order  integer not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists syllabus_nodes_parent_idx
  on public.syllabus_nodes (parent_id, sort_order);
create index if not exists syllabus_nodes_kind_idx on public.syllabus_nodes (kind);
create unique index if not exists syllabus_nodes_sibling_name_key
  on public.syllabus_nodes (
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

create or replace function public.check_syllabus_hierarchy()
returns trigger
language plpgsql
as $$
declare
  parent_kind public.syllabus_kind;
begin
  if new.parent_id is null then
    if new.kind <> 'unit' then
      raise exception 'Only a unit can sit at the top of the syllabus.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A syllabus node cannot be its own parent.'
      using errcode = 'check_violation';
  end if;

  select kind into parent_kind from public.syllabus_nodes where id = new.parent_id;

  if new.kind = 'unit'
     or (new.kind = 'topic' and parent_kind <> 'unit')
     or (new.kind = 'subtopic' and parent_kind <> 'topic') then
    raise exception 'Invalid syllabus nesting: % cannot sit inside %.', new.kind, parent_kind
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists syllabus_nodes_check_hierarchy on public.syllabus_nodes;
create trigger syllabus_nodes_check_hierarchy
  before insert or update of parent_id, kind on public.syllabus_nodes
  for each row execute function public.check_syllabus_hierarchy();

drop trigger if exists syllabus_nodes_set_updated_at on public.syllabus_nodes;
create trigger syllabus_nodes_set_updated_at
  before update on public.syllabus_nodes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- student_notes — the teacher's private journal (never student-visible
-- unless explicitly published).
-- ---------------------------------------------------------------------
create table if not exists public.student_notes (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null,
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_notes_student_idx
  on public.student_notes (student_id, created_at desc);

drop trigger if exists student_notes_set_updated_at on public.student_notes;
create trigger student_notes_set_updated_at
  before update on public.student_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- app_settings — singleton branding row, so the LMS is rebrandable
-- without touching source code.
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id               boolean primary key default true,
  lms_name         text not null default 'PHYSIX',
  tagline          text not null default 'Advanced Level Physics',
  teacher_name     text,
  logo_url         text,
  primary_color    text not null default '#2f6bff',
  secondary_color  text not null default '#12b3a6',
  contact_email    text,
  contact_phone    text,
  updated_at       timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- audit_logs — append-only record of consequential actions.
-- No credentials or answer content is ever written here.
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_role  public.user_role,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  summary     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);

-- =====================================================================
-- Row Level Security
--
-- Rule of thumb: the teacher sees everything in their LMS; a student
-- sees only rows that belong to them. No policy grants a student any
-- write access to another person's data.
-- =====================================================================

alter table public.profiles       enable row level security;
alter table public.students       enable row level security;
alter table public.batches        enable row level security;
alter table public.batch_members  enable row level security;
alter table public.syllabus_nodes enable row level security;
alter table public.student_notes  enable row level security;
alter table public.app_settings   enable row level security;
alter table public.audit_logs     enable row level security;

-- profiles ------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_teacher());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

drop policy if exists profiles_teacher_write on public.profiles;
create policy profiles_teacher_write on public.profiles
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- students ------------------------------------------------------------
drop policy if exists students_teacher_all on public.students;
create policy students_teacher_all on public.students
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists students_read_self on public.students;
create policy students_read_self on public.students
  for select to authenticated
  using (profile_id = auth.uid());

-- batches -------------------------------------------------------------
drop policy if exists batches_teacher_all on public.batches;
create policy batches_teacher_all on public.batches
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists batches_read_own on public.batches;
create policy batches_read_own on public.batches
  for select to authenticated
  using (exists (
    select 1 from public.batch_members bm
    where bm.batch_id = batches.id
      and bm.student_id = public.current_student_id()
      and bm.left_at is null
  ));

-- batch_members -------------------------------------------------------
drop policy if exists batch_members_teacher_all on public.batch_members;
create policy batch_members_teacher_all on public.batch_members
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists batch_members_read_own on public.batch_members;
create policy batch_members_read_own on public.batch_members
  for select to authenticated
  using (student_id = public.current_student_id());

-- syllabus_nodes ------------------------------------------------------
drop policy if exists syllabus_teacher_all on public.syllabus_nodes;
create policy syllabus_teacher_all on public.syllabus_nodes
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists syllabus_read_active on public.syllabus_nodes;
create policy syllabus_read_active on public.syllabus_nodes
  for select to authenticated
  using (archived_at is null);

-- student_notes -------------------------------------------------------
drop policy if exists student_notes_teacher_all on public.student_notes;
create policy student_notes_teacher_all on public.student_notes
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists student_notes_read_published on public.student_notes;
create policy student_notes_read_published on public.student_notes
  for select to authenticated
  using (published and student_id = public.current_student_id());

-- app_settings --------------------------------------------------------
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_teacher_write on public.app_settings;
create policy app_settings_teacher_write on public.app_settings
  for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- audit_logs ----------------------------------------------------------
drop policy if exists audit_logs_teacher_read on public.audit_logs;
create policy audit_logs_teacher_read on public.audit_logs
  for select to authenticated
  using (public.is_teacher());

drop policy if exists audit_logs_insert_self on public.audit_logs;
create policy audit_logs_insert_self on public.audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid());

-- Audit rows are immutable: no update or delete policy exists, so both
-- are denied for every role except the service role.
