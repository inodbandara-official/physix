-- =====================================================================
-- PHYSIX LMS — Migration 0005: Assessments and attempts
--
-- Phase 3. Four ideas carry the design:
--
-- 1. An assessment is a *recipe*, not a list. Its items are either a
--    fixed question or a random rule ("3 medium Electricity questions"),
--    and the rules are resolved when an attempt starts. Two students — or
--    one student's second attempt — can therefore sit different papers
--    drawn from the same pool.
--
-- 2. An attempt pins the exact `question_version_id` it was served. Editing
--    a question afterwards creates a new version and leaves the attempt
--    untouched, so a result recorded today can always be replayed and
--    re-explained exactly as it was sat (§41).
--
-- 3. Students never read the question bank. Answer keys live in
--    `question_versions.body`, which has no student policy at all; the app
--    reads it with the service role, strips it, and renders only what a
--    student may see. Marking happens on the server, and marks are
--    written through `finalize_attempt`, which only the service role may
--    call. A student can write exactly one thing: their own answers, to
--    their own open attempt, before its deadline.
--
-- 4. Every rule that must hold under concurrency — one open attempt at a
--    time, the attempt limit, no duplicate question within an attempt —
--    is enforced by the database, not by hoping two requests never race.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.assessment_kind as enum (
    'practice', 'class_test', 'unit_test', 'term_test', 'mock_exam', 'revision', 'custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assessment_status as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attempt_status as enum (
    'in_progress',  -- the student is sitting it
    'submitted',    -- handed in; some answers still need the teacher
    'graded'        -- every mark is final
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------
create table if not exists public.assessments (
  id                       uuid primary key default gen_random_uuid(),
  title                    text not null,
  description              text,
  kind                     public.assessment_kind not null default 'class_test',
  status                   public.assessment_status not null default 'draft',
  opens_at                 timestamptz,
  closes_at                timestamptz,
  time_limit_minutes       integer,
  -- Null means unlimited, which is what practice sets usually want.
  max_attempts             integer default 1,
  shuffle_questions        boolean not null default false,
  shuffle_options          boolean not null default true,
  pass_percentage          numeric(5, 2),
  -- Fraction of a question's marks lost for a wrong multiple-choice or
  -- true/false answer. 0 disables it; a blank answer never loses marks.
  negative_marking         numeric(4, 3) not null default 0,
  show_results_immediately boolean not null default true,
  show_correct_answers     boolean not null default true,
  show_explanations        boolean not null default true,
  allow_review             boolean not null default true,
  -- Set when the teacher releases results that were held back.
  results_released_at      timestamptz,
  created_by               uuid references public.profiles (id) on delete set null,
  published_at             timestamptz,
  archived_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint assessments_window check (opens_at is null or closes_at is null or closes_at > opens_at),
  constraint assessments_time_limit check (time_limit_minutes is null or time_limit_minutes between 1 and 600),
  constraint assessments_max_attempts check (max_attempts is null or max_attempts between 1 and 50),
  constraint assessments_pass check (pass_percentage is null or pass_percentage between 0 and 100),
  constraint assessments_negative check (negative_marking between 0 and 1)
);

create index if not exists assessments_status_idx on public.assessments (status, archived_at);
create index if not exists assessments_window_idx on public.assessments (opens_at, closes_at);

drop trigger if exists assessments_set_updated_at on public.assessments;
create trigger assessments_set_updated_at
  before update on public.assessments
  for each row execute function public.set_updated_at();

-- Which batches sit it.
create table if not exists public.assessment_batches (
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  batch_id      uuid not null references public.batches (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (assessment_id, batch_id)
);

create index if not exists assessment_batches_batch_idx on public.assessment_batches (batch_id);

-- ---------------------------------------------------------------------
-- assessment_items — the recipe
--
-- A random rule's syllabus node restricts to that node *and everything
-- beneath it*: a rule on "Mechanics" draws from every Mechanics topic and
-- subtopic. Empty arrays mean "any".
-- ---------------------------------------------------------------------
create table if not exists public.assessment_items (
  id               uuid primary key default gen_random_uuid(),
  assessment_id    uuid not null references public.assessments (id) on delete cascade,
  position         integer not null,
  kind             text not null,
  question_id      uuid references public.questions (id) on delete restrict,
  pick_count       integer,
  syllabus_node_id uuid references public.syllabus_nodes (id) on delete restrict,
  difficulties     public.difficulty_level[] not null default '{}',
  question_types   public.question_type[] not null default '{}',
  -- Only draw questions worth exactly this many marks, so every student's
  -- paper carries the same total.
  marks            numeric(6, 2),
  created_at       timestamptz not null default now(),
  constraint assessment_items_kind check (kind in ('question', 'random')),
  constraint assessment_items_shape check (
    (kind = 'question' and question_id is not null and pick_count is null)
    or (kind = 'random' and question_id is null and pick_count between 1 and 100)
  )
);

create index if not exists assessment_items_assessment_idx
  on public.assessment_items (assessment_id, position);
create unique index if not exists assessment_items_question_key
  on public.assessment_items (assessment_id, question_id)
  where question_id is not null;

-- ---------------------------------------------------------------------
-- attempts
-- ---------------------------------------------------------------------
create table if not exists public.attempts (
  id             uuid primary key default gen_random_uuid(),
  -- Restrict, not cascade: an assessment that has been sat is part of the
  -- record. Archive it instead.
  assessment_id  uuid not null references public.assessments (id) on delete restrict,
  student_id     uuid not null references public.students (id) on delete cascade,
  attempt_number integer not null,
  status         public.attempt_status not null default 'in_progress',
  started_at     timestamptz not null default now(),
  -- The earlier of (start + time limit) and the assessment's close.
  -- Stored, so changing the time limit later cannot shorten an attempt
  -- that is already running.
  deadline_at    timestamptz,
  submitted_at   timestamptz,
  graded_at      timestamptz,
  score          numeric(8, 2) not null default 0,
  max_score      numeric(8, 2) not null default 0,
  percentage     numeric(5, 2),
  -- Answers still waiting for the teacher.
  pending_manual integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint attempts_number_positive check (attempt_number >= 1)
);

create unique index if not exists attempts_number_key
  on public.attempts (assessment_id, student_id, attempt_number);
-- One attempt open at a time, per student per assessment.
create unique index if not exists attempts_one_open_key
  on public.attempts (assessment_id, student_id)
  where status = 'in_progress';
create index if not exists attempts_student_idx on public.attempts (student_id, started_at desc);
create index if not exists attempts_assessment_idx on public.attempts (assessment_id, status);

drop trigger if exists attempts_set_updated_at on public.attempts;
create trigger attempts_set_updated_at
  before update on public.attempts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- attempt_questions — what one attempt actually contained, and its marks
-- ---------------------------------------------------------------------
create table if not exists public.attempt_questions (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references public.attempts (id) on delete cascade,
  position            integer not null,
  question_id         uuid not null references public.questions (id) on delete restrict,
  question_version_id uuid not null references public.question_versions (id) on delete restrict,
  max_marks           numeric(6, 2) not null,
  -- Null until marked. May be negative when negative marking applies.
  marks_awarded       numeric(6, 2),
  is_correct          boolean,
  requires_manual     boolean not null default false,
  -- What the marking engine concluded, e.g. "Wrong unit". Shown in review.
  feedback            text,
  -- Per-part results for a structured question, keyed by part id.
  part_results        jsonb,
  teacher_comment     text,
  marked_by           uuid references public.profiles (id) on delete set null,
  marked_at           timestamptz,
  constraint attempt_questions_marks_range
    check (marks_awarded is null or (marks_awarded >= -max_marks and marks_awarded <= max_marks)),
  -- Deferred so the shuffle in start_attempt can renumber in one statement.
  constraint attempt_questions_position_key unique (attempt_id, position) deferrable initially deferred,
  -- Duplicate prevention (§55): a question appears at most once per attempt.
  constraint attempt_questions_question_key unique (attempt_id, question_id),
  -- Lets attempt_answers prove its question belongs to its attempt.
  constraint attempt_questions_attempt_id_key unique (attempt_id, id)
);

create index if not exists attempt_questions_version_idx on public.attempt_questions (question_version_id);
create index if not exists attempt_questions_question_idx on public.attempt_questions (question_id);

-- ---------------------------------------------------------------------
-- attempt_answers — the only table a student writes to
-- ---------------------------------------------------------------------
create table if not exists public.attempt_answers (
  attempt_question_id uuid primary key,
  attempt_id          uuid not null,
  response            jsonb,
  flagged             boolean not null default false,
  updated_at          timestamptz not null default now(),
  constraint attempt_answers_question_fk
    foreign key (attempt_id, attempt_question_id)
    references public.attempt_questions (attempt_id, id) on delete cascade,
  -- An essay is long; a payload this size is not an answer.
  constraint attempt_answers_size check (response is null or pg_column_size(response) < 65536)
);

create index if not exists attempt_answers_attempt_idx on public.attempt_answers (attempt_id);

drop trigger if exists attempt_answers_set_updated_at on public.attempt_answers;
create trigger attempt_answers_set_updated_at
  before update on public.attempt_answers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Is the signed-in student in a batch this assessment is set for?
create or replace function public.is_assigned_to_me(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assessment_batches ab
    join public.batches b on b.id = ab.batch_id and b.archived_at is null
    join public.batch_members bm on bm.batch_id = ab.batch_id and bm.left_at is null
    where ab.assessment_id = p_assessment_id
      and bm.student_id = public.current_student_id()
  );
$$;

create or replace function public.owns_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.attempts a
    where a.id = p_attempt_id and a.student_id = public.current_student_id()
  );
$$;

-- Answers are accepted until the deadline, plus a short grace period so an
-- autosave already in flight when the clock runs out is not lost.
create or replace function public.attempt_accepts_answers(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.attempts a
    where a.id = p_attempt_id
      and a.student_id = public.current_student_id()
      and a.status = 'in_progress'
      and (a.deadline_at is null or now() <= a.deadline_at + interval '30 seconds')
  );
$$;

-- How many questions a paper will have, for the student's instructions
-- page. Students cannot read the recipe itself, so this answers the one
-- question they need from it — and only for an assessment set for them.
create or replace function public.assessment_question_count(p_assessment_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_teacher() or public.is_assigned_to_me(p_assessment_id) then (
      select coalesce(sum(case when kind = 'question' then 1 else pick_count end), 0)::integer
      from public.assessment_items
      where assessment_id = p_assessment_id
    )
  end;
$$;

-- ---------------------------------------------------------------------
-- Integrity guards
-- ---------------------------------------------------------------------

-- Once anyone has started an assessment, its recipe is frozen: changing
-- the questions afterwards would make earlier attempts incomparable with
-- later ones. Settings (dates, visibility) stay editable.
create or replace function public.guard_assessment_items()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.assessment_id, old.assessment_id);
begin
  if exists (select 1 from public.attempts where assessment_id = target) then
    raise exception 'Students have already started this assessment, so its questions can no longer change. Duplicate it to make a new version.'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists assessment_items_guard on public.assessment_items;
create trigger assessment_items_guard
  before insert or update or delete on public.assessment_items
  for each row execute function public.guard_assessment_items();

-- Tighten migration 0002's guard. A *current* version could previously be
-- edited in place whenever its question was a draft — including a
-- published question moved back to draft after students had sat it. A
-- version that any attempt has served is now frozen, whatever the
-- question's status. Translations and private notes stay editable: they
-- change neither the marking nor the original wording.
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

  if exists (select 1 from public.attempt_questions aq where aq.question_version_id = old.id)
     and (to_jsonb(new) - 'translations' - 'teacher_notes')
         is distinct from (to_jsonb(old) - 'translations' - 'teacher_notes') then
    raise exception 'Version % has been used in an assessment and cannot be changed. Save your edit as a new version.',
      old.version_number
      using errcode = 'check_violation';
  end if;

  if coalesce(is_current, false) then
    return new;
  end if;

  -- Superseded versions accept translation fixes only.
  if (to_jsonb(new) - 'translations' - 'teacher_notes')
     is not distinct from (to_jsonb(old) - 'translations' - 'teacher_notes') then
    return new;
  end if;

  raise exception 'Question version % is superseded and cannot be changed. Create a new version instead.',
    old.version_number
    using errcode = 'check_violation';
end;
$$;

-- ---------------------------------------------------------------------
-- Totals
--
-- An attempt's score is always the sum of its question marks, recomputed
-- by the database whenever a mark changes — by the marking engine or by
-- the teacher. There is no code path that can leave them disagreeing.
-- ---------------------------------------------------------------------
create or replace function public.refresh_attempt_totals()
returns trigger
language plpgsql
as $$
begin
  update public.attempts a
     set score = greatest(0, t.score),
         max_score = t.max_score,
         percentage = case when t.max_score > 0
                           then round(greatest(0, t.score) / t.max_score * 100, 2)
                      end,
         pending_manual = t.pending,
         status = case
                    when a.status = 'submitted' and t.pending = 0 then 'graded'::public.attempt_status
                    when a.status = 'graded' and t.pending > 0 then 'submitted'::public.attempt_status
                    else a.status
                  end,
         graded_at = case
                       when a.status = 'submitted' and t.pending = 0 then now()
                       else a.graded_at
                     end
    from (
      select aq.attempt_id,
             coalesce(sum(aq.marks_awarded), 0) as score,
             coalesce(sum(aq.max_marks), 0) as max_score,
             count(*) filter (where aq.requires_manual and aq.marked_at is null) as pending
        from public.attempt_questions aq
       where aq.attempt_id in (select distinct attempt_id from changed)
       group by aq.attempt_id
    ) t
   where a.id = t.attempt_id
     and a.status <> 'in_progress';
  return null;
end;
$$;

drop trigger if exists attempt_questions_refresh_totals on public.attempt_questions;
create trigger attempt_questions_refresh_totals
  after update on public.attempt_questions
  referencing new table as changed
  for each statement execute function public.refresh_attempt_totals();

-- ---------------------------------------------------------------------
-- start_attempt — resolve the recipe into a paper
--
-- SECURITY DEFINER because it reads the question bank, which students
-- cannot. It returns only an attempt id; the questions it chose are then
-- read through attempt_questions, which carries no answer keys.
-- ---------------------------------------------------------------------
create or replace function public.start_attempt(p_assessment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student    uuid := public.current_student_id();
  v_assessment public.assessments%rowtype;
  v_open       uuid;
  v_used       integer;
  v_attempt    uuid;
  v_item       public.assessment_items%rowtype;
  v_position   integer := 0;
  v_added      integer;
  v_total      integer;
begin
  if v_student is null then
    raise exception 'Only a student can start an assessment.' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.students s
    where s.id = v_student and s.status = 'active' and s.archived_at is null
  ) then
    raise exception 'Your account is not active. Contact your teacher.' using errcode = 'check_violation';
  end if;

  select * into v_assessment from public.assessments where id = p_assessment_id;

  if not found
     or v_assessment.status <> 'published'
     or v_assessment.archived_at is not null
     or not public.is_assigned_to_me(p_assessment_id) then
    raise exception 'This assessment is not available to you.' using errcode = 'check_violation';
  end if;

  -- Two taps on "Start" must not create two attempts, nor slip past the
  -- attempt limit together.
  perform pg_advisory_xact_lock(hashtextextended(p_assessment_id::text || ':' || v_student::text, 0));

  select id into v_open
  from public.attempts
  where assessment_id = p_assessment_id and student_id = v_student and status = 'in_progress';

  if v_open is not null then
    -- The app finalises an expired attempt before calling, so an open one
    -- here still has time on it: resume it.
    return v_open;
  end if;

  if v_assessment.opens_at is not null and now() < v_assessment.opens_at then
    raise exception 'This assessment has not opened yet.' using errcode = 'check_violation';
  end if;

  if v_assessment.closes_at is not null and now() >= v_assessment.closes_at then
    raise exception 'This assessment has closed.' using errcode = 'check_violation';
  end if;

  select count(*) into v_used
  from public.attempts
  where assessment_id = p_assessment_id and student_id = v_student;

  if v_assessment.max_attempts is not null and v_used >= v_assessment.max_attempts then
    raise exception 'You have used all your attempts at this assessment.' using errcode = 'check_violation';
  end if;

  insert into public.attempts (assessment_id, student_id, attempt_number, deadline_at)
  values (
    p_assessment_id,
    v_student,
    v_used + 1,
    -- least() ignores nulls: no limit and no close date gives no deadline.
    least(now() + make_interval(mins => v_assessment.time_limit_minutes), v_assessment.closes_at)
  )
  returning id into v_attempt;

  for v_item in
    select * from public.assessment_items where assessment_id = p_assessment_id order by position, created_at
  loop
    if v_item.kind = 'question' then
      insert into public.attempt_questions (attempt_id, position, question_id, question_version_id, max_marks)
      select v_attempt, v_position + 1, q.id, q.current_version_id, q.current_marks
      from public.questions q
      where q.id = v_item.question_id
        and q.status = 'published'
        and q.archived_at is null
        and q.current_version_id is not null
      on conflict (attempt_id, question_id) do nothing;
    else
      insert into public.attempt_questions (attempt_id, position, question_id, question_version_id, max_marks)
      select v_attempt, v_position + row_number() over (), picked.id, picked.current_version_id, picked.current_marks
      from (
        select q.id, q.current_version_id, q.current_marks
        from public.questions q
        where q.status = 'published'
          and q.archived_at is null
          and q.current_version_id is not null
          and (
            v_item.syllabus_node_id is null
            or q.current_node_id in (
              with recursive subtree(id) as (
                select v_item.syllabus_node_id
                union all
                select n.id from public.syllabus_nodes n join subtree s on n.parent_id = s.id
              )
              select id from subtree
            )
          )
          and (cardinality(v_item.difficulties) = 0 or q.current_difficulty = any (v_item.difficulties))
          and (cardinality(v_item.question_types) = 0 or q.current_type = any (v_item.question_types))
          and (v_item.marks is null or q.current_marks = v_item.marks)
          -- Not already drawn by an earlier rule…
          and not exists (
            select 1 from public.attempt_questions aq
            where aq.attempt_id = v_attempt and aq.question_id = q.id
          )
          -- …and not one the teacher placed by hand anywhere in the paper.
          and not exists (
            select 1 from public.assessment_items fixed
            where fixed.assessment_id = p_assessment_id
              and fixed.kind = 'question'
              and fixed.question_id = q.id
          )
        order by random()
        limit v_item.pick_count
      ) picked;
    end if;

    get diagnostics v_added = row_count;
    v_position := v_position + v_added;
  end loop;

  select count(*) into v_total from public.attempt_questions where attempt_id = v_attempt;

  if v_total = 0 then
    raise exception 'This assessment has no questions available right now. Let your teacher know.'
      using errcode = 'check_violation';
  end if;

  if v_assessment.shuffle_questions then
    update public.attempt_questions aq
       set position = shuffled.new_position
      from (
        select id, row_number() over (order by random()) as new_position
        from public.attempt_questions
        where attempt_id = v_attempt
      ) shuffled
     where aq.id = shuffled.id;
  end if;

  update public.attempts
     set max_score = (select coalesce(sum(max_marks), 0) from public.attempt_questions where attempt_id = v_attempt)
   where id = v_attempt;

  return v_attempt;
end;
$$;

revoke all on function public.start_attempt(uuid) from public;
grant execute on function public.start_attempt(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- finalize_attempt — record the marking engine's results
--
-- Called by the server with the service role, after it has marked the
-- answers against the pinned versions. Students cannot call it; if they
-- could, they could write their own marks.
--
-- p_results: [{ "id": attempt_question_id, "marks": n, "correct": bool|null,
--               "requiresManual": bool, "feedback": text, "parts": {...} }]
-- ---------------------------------------------------------------------
create or replace function public.finalize_attempt(p_attempt_id uuid, p_results jsonb)
returns public.attempt_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id for update;

  if not found then
    raise exception 'That attempt could not be found.' using errcode = 'no_data_found';
  end if;

  -- Idempotent: a second submit (a double tap, a retry after a dropped
  -- connection) changes nothing and reports where the attempt stands.
  if v_attempt.status <> 'in_progress' then
    return v_attempt.status;
  end if;

  update public.attempts
     set status = 'submitted',
         -- Handing in after the deadline counts as handing in at it.
         submitted_at = case
                          when deadline_at is not null and now() > deadline_at then deadline_at
                          else now()
                        end
   where id = p_attempt_id;

  -- The totals trigger fires on this update and moves the attempt to
  -- 'graded' if nothing needs the teacher.
  update public.attempt_questions aq
     set marks_awarded   = (r ->> 'marks')::numeric,
         is_correct      = (r ->> 'correct')::boolean,
         requires_manual = coalesce((r ->> 'requiresManual')::boolean, false),
         feedback        = r ->> 'feedback',
         part_results    = r -> 'parts'
    from jsonb_array_elements(p_results) r
   where aq.attempt_id = p_attempt_id
     and aq.id = (r ->> 'id')::uuid;

  select status into v_attempt.status from public.attempts where id = p_attempt_id;
  return v_attempt.status;
end;
$$;

revoke all on function public.finalize_attempt(uuid, jsonb) from public;
revoke all on function public.finalize_attempt(uuid, jsonb) from anon, authenticated;
grant execute on function public.finalize_attempt(uuid, jsonb) to service_role;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.assessments        enable row level security;
alter table public.assessment_batches enable row level security;
alter table public.assessment_items   enable row level security;
alter table public.attempts           enable row level security;
alter table public.attempt_questions  enable row level security;
alter table public.attempt_answers    enable row level security;

-- assessments ---------------------------------------------------------
drop policy if exists assessments_teacher_all on public.assessments;
create policy assessments_teacher_all on public.assessments
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- A student sees what is set for them now, plus anything they have
-- already sat — so leaving a batch, or the teacher archiving an old test,
-- does not erase their own history.
drop policy if exists assessments_student_read on public.assessments;
create policy assessments_student_read on public.assessments
  for select to authenticated
  using (
    (status = 'published' and archived_at is null and public.is_assigned_to_me(id))
    or exists (
      select 1 from public.attempts a
      where a.assessment_id = assessments.id and a.student_id = public.current_student_id()
    )
  );

-- assessment_batches / assessment_items: teacher only. Students have no
-- use for the recipe, and the fixed items would name questions.
drop policy if exists assessment_batches_teacher_all on public.assessment_batches;
create policy assessment_batches_teacher_all on public.assessment_batches
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists assessment_items_teacher_all on public.assessment_items;
create policy assessment_items_teacher_all on public.assessment_items
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- attempts ------------------------------------------------------------
-- Students read their own and write none: attempts are created by
-- start_attempt and closed by finalize_attempt.
drop policy if exists attempts_teacher_all on public.attempts;
create policy attempts_teacher_all on public.attempts
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists attempts_student_read on public.attempts;
create policy attempts_student_read on public.attempts
  for select to authenticated
  using (student_id = public.current_student_id());

-- attempt_questions ---------------------------------------------------
drop policy if exists attempt_questions_teacher_all on public.attempt_questions;
create policy attempt_questions_teacher_all on public.attempt_questions
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists attempt_questions_student_read on public.attempt_questions;
create policy attempt_questions_student_read on public.attempt_questions
  for select to authenticated
  using (public.owns_attempt(attempt_id));

-- attempt_answers -----------------------------------------------------
drop policy if exists attempt_answers_teacher_all on public.attempt_answers;
create policy attempt_answers_teacher_all on public.attempt_answers
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists attempt_answers_student_read on public.attempt_answers;
create policy attempt_answers_student_read on public.attempt_answers
  for select to authenticated
  using (public.owns_attempt(attempt_id));

drop policy if exists attempt_answers_student_insert on public.attempt_answers;
create policy attempt_answers_student_insert on public.attempt_answers
  for insert to authenticated
  with check (public.attempt_accepts_answers(attempt_id));

drop policy if exists attempt_answers_student_update on public.attempt_answers;
create policy attempt_answers_student_update on public.attempt_answers
  for update to authenticated
  using (public.attempt_accepts_answers(attempt_id))
  with check (public.attempt_accepts_answers(attempt_id));

-- No delete policy for students: clearing an answer writes a null
-- response, which keeps the flag and the timestamp.
