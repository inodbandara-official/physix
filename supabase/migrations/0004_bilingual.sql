-- =====================================================================
-- PHYSIX LMS — Migration 0004: Sinhala / English content
--
-- Most students here think in Sinhala. They can now read questions and
-- the syllabus in either language and switch at any time.
--
-- The design decision that matters: a translation carries *prose only*.
-- Structure, answer keys, marks, tolerances, accepted units and figures
-- are shared between languages and stored once. A question therefore
-- cannot mark differently depending on which language it is read in —
-- there is only ever one set of correct answers.
-- =====================================================================

do $$ begin
  create type public.content_language as enum ('en', 'si');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- question_versions.translations
--
-- Shape, keyed by language code:
--
--   {
--     "si": {
--       "title": "...", "stem": "...",
--       "explanation": "...", "solution": "...",
--       "hint": "...", "commonMistake": "...",
--       "options": { "<optionId>": "translated text" },
--       "parts":   { "<partId>": { "prompt": "...", "explanation": "..." } },
--       "figures": { "<figureId>": { "alt": "...", "caption": "..." } },
--       "reviewed": true
--     }
--   }
--
-- The inner keys are the ids the English body already uses, so the two
-- languages cannot drift apart structurally: adding an option adds it to
-- both, and a deleted option orphans nothing that is ever displayed.
--
-- `reviewed` stays false for a copy- or machine-assisted draft and turns
-- true once a human has checked it. Only reviewed translations are shown
-- to students.
-- ---------------------------------------------------------------------
alter table public.question_versions
  add column if not exists translations jsonb not null default '{}'::jsonb;

comment on column public.question_versions.translations is
  'Prose translations keyed by language code. Structure, answer keys and marks are language-independent and live in `body`.';

-- Finding what still needs translating is a routine task for the teacher,
-- so it gets an index rather than a table scan.
create index if not exists question_versions_translated_si_idx
  on public.question_versions ((translations ? 'si'));

-- The bank list reads a denormalised snapshot of the current version
-- (migration 0002), so translation status joins that snapshot.
alter table public.questions
  add column if not exists current_languages text[] not null default array['en'];

create index if not exists questions_current_languages_idx
  on public.questions using gin (current_languages);

-- ---------------------------------------------------------------------
-- Syllabus in both languages
-- ---------------------------------------------------------------------
alter table public.syllabus_nodes
  add column if not exists name_si text,
  add column if not exists description_si text;

comment on column public.syllabus_nodes.name_si is
  'Sinhala name. Null means a Sinhala reader sees the English name.';

-- ---------------------------------------------------------------------
-- Who reads what
--
-- The preference lives on `profiles`, not on `students`, and deliberately
-- so. A student already owns their profile row — migration 0001 lets them
-- update it while pinning `role` — whereas letting them write to their
-- `students` row would also hand them `status`, `archived_at` and
-- `email`, which is their login identity. A language toggle is not worth
-- a privilege escalation.
--
-- `app_settings.default_language` decides what a student sees before they
-- have chosen anything.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists language public.content_language not null default 'en';

alter table public.app_settings
  add column if not exists default_language public.content_language not null default 'en';

-- ---------------------------------------------------------------------
-- Keep the snapshot honest about which languages the current version has
-- ---------------------------------------------------------------------
create or replace function public.version_languages(translations jsonb)
returns text[]
language sql
immutable
as $$
  -- English is the source language and always present. A translation
  -- counts only once a human has marked it reviewed.
  select array['en'] || coalesce(
    array(
      select key
      from jsonb_each(translations)
      where value ->> 'reviewed' = 'true'
      order by key
    ),
    array[]::text[]
  );
$$;

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
    new.current_languages := array['en'];
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
  new.current_languages := public.version_languages(v.translations);
  return new;
end;
$$;

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
         current_seconds        = new.estimated_seconds,
         current_languages      = public.version_languages(new.translations)
   where q.id = new.question_id
     and q.current_version_id = new.id;
  return null;
end;
$$;

-- Backfill the snapshot for questions that already exist.
update public.questions q
   set current_languages = public.version_languages(v.translations)
  from public.question_versions v
 where v.id = q.current_version_id;
