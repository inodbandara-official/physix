-- =====================================================================
-- PHYSIX LMS — Migration 0002: Question bank
--
-- Phase 2. The central design decision is the split between `questions`
-- (stable identity) and `question_versions` (immutable content).
--
-- Editing a published question writes a NEW version rather than mutating
-- the old one. From Phase 3, an attempt stores the `question_version_id`
-- it was served, so a completed assessment can always be replayed exactly
-- as the student saw it — and correcting a question next term cannot
-- silently rewrite last term's marks.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.question_type as enum (
    'mcq',           -- multiple choice, one correct answer
    'multi',         -- multiple response, several correct answers
    'true_false',
    'numerical',     -- value + tolerance + units
    'short_answer',
    'structured',    -- multi-part problem, each part marked separately
    'essay'          -- manually marked
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.difficulty_level as enum ('very_easy', 'easy', 'medium', 'hard', 'very_hard');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- questions — identity, curation state, pointer to the live version.
-- Deliberately holds no content: everything a student can see lives on a
-- version, so content is immutable once used.
-- ---------------------------------------------------------------------
-- The `current_*` columns are a denormalised snapshot of whatever version
-- `current_version_id` points at, maintained by trigger. They exist so the
-- bank can be searched and filtered — and, from Phase 3, random questions
-- selected by topic and difficulty — with one indexed scan of this table
-- instead of a join whose two foreign keys to `question_versions` would
-- need disambiguating on every query.
create table if not exists public.questions (
  id                     uuid primary key default gen_random_uuid(),
  question_code          text not null,
  status                 public.question_status not null default 'draft',
  current_version_id     uuid,
  created_by             uuid references public.profiles (id) on delete set null,
  archived_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  current_version_number integer,
  current_type           public.question_type,
  current_title          text,
  current_stem           text,
  current_marks          numeric(6, 2),
  current_difficulty     public.difficulty_level,
  current_node_id        uuid,
  current_unit_id        uuid,
  current_year           integer,
  current_seconds        integer
);

create unique index if not exists questions_code_key on public.questions (lower(question_code));
create index if not exists questions_status_idx on public.questions (status);
create index if not exists questions_archived_idx on public.questions (archived_at);
create index if not exists questions_updated_idx on public.questions (updated_at desc);
create index if not exists questions_current_type_idx on public.questions (current_type);
create index if not exists questions_current_difficulty_idx on public.questions (current_difficulty);
create index if not exists questions_current_unit_idx on public.questions (current_unit_id);
create index if not exists questions_current_node_idx on public.questions (current_node_id);
create index if not exists questions_current_year_idx on public.questions (current_year);
-- The index Phase 3 will lean on when drawing random questions.
create index if not exists questions_selection_idx
  on public.questions (status, current_unit_id, current_difficulty)
  where archived_at is null;
create index if not exists questions_stem_trgm_idx
  on public.questions using gin (current_stem gin_trgm_ops);
create index if not exists questions_title_trgm_idx
  on public.questions using gin (current_title gin_trgm_ops);

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- question_versions — immutable content.
--
-- `body` carries the type-specific payload (options, parts, numerical
-- answer specifications). It is JSONB rather than a set of side tables
-- because the shape genuinely differs per question type, it is always
-- read whole, and it is never queried field-by-field. The TypeScript
-- discriminated union in src/features/questions/types.ts is the contract,
-- and every write is validated by Zod before it reaches this column.
--
-- Nothing in this table is ever updated after a version is superseded;
-- see the trigger below.
-- ---------------------------------------------------------------------
create table if not exists public.question_versions (
  id                uuid primary key default gen_random_uuid(),
  question_id       uuid not null references public.questions (id) on delete cascade,
  version_number    integer not null,
  type              public.question_type not null,
  title             text not null default '',
  stem              text not null,
  body              jsonb not null default '{}'::jsonb,
  marks             numeric(6, 2) not null default 1,
  difficulty        public.difficulty_level not null default 'medium',
  estimated_seconds integer,
  -- The most specific syllabus node the teacher chose. `unit_id` is its
  -- top-level ancestor, denormalised so unit filtering is one index hit
  -- instead of a recursive walk.
  syllabus_node_id  uuid references public.syllabus_nodes (id) on delete set null,
  unit_id           uuid references public.syllabus_nodes (id) on delete set null,
  source            text,
  source_year       integer,
  paper_reference   text,
  explanation       text,
  solution          text,
  common_mistake    text,
  hint              text,
  teacher_notes     text,
  figures           jsonb not null default '[]'::jsonb,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint question_versions_marks_positive check (marks > 0),
  constraint question_versions_year_range
    check (source_year is null or source_year between 1950 and 2100),
  constraint question_versions_estimate_range
    check (estimated_seconds is null or estimated_seconds between 5 and 7200)
);

create unique index if not exists question_versions_number_key
  on public.question_versions (question_id, version_number);
create index if not exists question_versions_question_idx
  on public.question_versions (question_id, version_number desc);
create index if not exists question_versions_node_idx on public.question_versions (syllabus_node_id);
create index if not exists question_versions_unit_idx on public.question_versions (unit_id);
create index if not exists question_versions_type_idx on public.question_versions (type);
create index if not exists question_versions_difficulty_idx on public.question_versions (difficulty);
create index if not exists question_versions_year_idx on public.question_versions (source_year);
-- Free-text search runs against questions.current_stem, so superseded
-- versions carry no trigram index: they are read by id, never searched.

alter table public.questions
  drop constraint if exists questions_current_version_fk;
alter table public.questions
  add constraint questions_current_version_fk
  foreign key (current_version_id) references public.question_versions (id) on delete set null;

-- ---------------------------------------------------------------------
-- Immutability guard.
--
-- A version that is no longer the current one is frozen: the application
-- edits drafts in place (cheap, no history worth keeping) and creates a
-- new version for anything published. Should a bug ever try to rewrite a
-- superseded version, the database refuses rather than corrupting the
-- record of what a student actually sat.
-- ---------------------------------------------------------------------
create or replace function public.guard_question_version_immutable()
returns trigger
language plpgsql
as $$
declare
  is_current boolean;
begin
  select q.current_version_id = old.id into is_current
  from public.questions q
  where q.id = old.question_id;

  if coalesce(is_current, false) then
    return new;
  end if;

  raise exception 'Question version % is superseded and cannot be changed. Create a new version instead.',
    old.version_number
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists question_versions_immutable on public.question_versions;
create trigger question_versions_immutable
  before update on public.question_versions
  for each row execute function public.guard_question_version_immutable();

-- Superseded versions are never deleted either: they are the only record
-- of what a past assessment contained.
create or replace function public.guard_question_version_delete()
returns trigger
language plpgsql
as $$
declare
  is_current boolean;
begin
  select q.current_version_id = old.id into is_current
  from public.questions q
  where q.id = old.question_id;

  if coalesce(is_current, false) then
    return old;
  end if;

  raise exception 'Question version % is part of the historical record and cannot be deleted.',
    old.version_number
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists question_versions_no_delete on public.question_versions;
create trigger question_versions_no_delete
  before delete on public.question_versions
  for each row execute function public.guard_question_version_delete();

-- ---------------------------------------------------------------------
-- Current-version snapshot
--
-- Two triggers keep `questions.current_*` in step with the version that
-- `current_version_id` points at:
--
--   * repointing `current_version_id` (publishing a new version) is caught
--     BEFORE the write on `questions`, so no second UPDATE is needed
--   * editing a draft in place is caught AFTER the write on
--     `question_versions`, and only for the row that is actually current
-- ---------------------------------------------------------------------
create or replace function public.sync_question_snapshot()
returns trigger
language plpgsql
as $$
declare
  v public.question_versions%rowtype;
begin
  if new.current_version_id is null then
    new.current_version_number := null;
    new.current_type := null;
    new.current_title := null;
    new.current_stem := null;
    new.current_marks := null;
    new.current_difficulty := null;
    new.current_node_id := null;
    new.current_unit_id := null;
    new.current_year := null;
    new.current_seconds := null;
    return new;
  end if;

  select * into v from public.question_versions where id = new.current_version_id;
  if not found then
    return new;
  end if;

  new.current_version_number := v.version_number;
  new.current_type := v.type;
  new.current_title := v.title;
  new.current_stem := v.stem;
  new.current_marks := v.marks;
  new.current_difficulty := v.difficulty;
  new.current_node_id := v.syllabus_node_id;
  new.current_unit_id := v.unit_id;
  new.current_year := v.source_year;
  new.current_seconds := v.estimated_seconds;
  return new;
end;
$$;

drop trigger if exists questions_sync_snapshot on public.questions;
create trigger questions_sync_snapshot
  before insert or update of current_version_id on public.questions
  for each row execute function public.sync_question_snapshot();

create or replace function public.refresh_question_snapshot()
returns trigger
language plpgsql
as $$
begin
  update public.questions q
     set current_version_number = new.version_number,
         current_type           = new.type,
         current_title          = new.title,
         current_stem           = new.stem,
         current_marks          = new.marks,
         current_difficulty     = new.difficulty,
         current_node_id        = new.syllabus_node_id,
         current_unit_id        = new.unit_id,
         current_year           = new.source_year,
         current_seconds        = new.estimated_seconds
   where q.id = new.question_id
     and q.current_version_id = new.id;
  return null;
end;
$$;

drop trigger if exists question_versions_refresh_snapshot on public.question_versions;
create trigger question_versions_refresh_snapshot
  after insert or update on public.question_versions
  for each row execute function public.refresh_question_snapshot();

-- ---------------------------------------------------------------------
-- question_tags — free-form curation labels (#past-paper, #tricky).
-- Tags belong to the question, not to a version: relabelling is not a
-- content change and must not create a new version.
-- ---------------------------------------------------------------------
create table if not exists public.question_tags (
  question_id uuid not null references public.questions (id) on delete cascade,
  tag         text not null,
  created_at  timestamptz not null default now(),
  primary key (question_id, tag),
  constraint question_tags_format check (tag ~ '^[a-z0-9][a-z0-9-]{0,39}$')
);

create index if not exists question_tags_tag_idx on public.question_tags (tag);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.questions         enable row level security;
alter table public.question_versions enable row level security;
alter table public.question_tags     enable row level security;

drop policy if exists questions_teacher_all on public.questions;
create policy questions_teacher_all on public.questions
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists question_versions_teacher_all on public.question_versions;
create policy question_versions_teacher_all on public.question_versions
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists question_tags_teacher_all on public.question_tags;
create policy question_tags_teacher_all on public.question_tags
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- Students get no policy at all here. They never read the question bank
-- directly: from Phase 3 they see only the specific question versions
-- served to them through an attempt, which carries its own policies.
-- Correct answers and solutions therefore stay unreachable.

-- ---------------------------------------------------------------------
-- Figure storage
--
-- Private bucket. Reading is teacher-only for now; Phase 3 adds a policy
-- letting a student read a figure belonging to a question in an
-- assessment they have been assigned. Until then the app serves figures
-- through short-lived signed URLs.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-figures',
  'question-figures',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists question_figures_teacher_read on storage.objects;
create policy question_figures_teacher_read on storage.objects
  for select to authenticated
  using (bucket_id = 'question-figures' and public.is_teacher());

drop policy if exists question_figures_teacher_write on storage.objects;
create policy question_figures_teacher_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-figures' and public.is_teacher());

drop policy if exists question_figures_teacher_update on storage.objects;
create policy question_figures_teacher_update on storage.objects
  for update to authenticated
  using (bucket_id = 'question-figures' and public.is_teacher())
  with check (bucket_id = 'question-figures' and public.is_teacher());

drop policy if exists question_figures_teacher_delete on storage.objects;
create policy question_figures_teacher_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-figures' and public.is_teacher());
