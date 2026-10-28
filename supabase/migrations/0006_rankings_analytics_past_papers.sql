-- =====================================================================
-- PHYSIX LMS — Migration 0006: Rankings, analytics and past papers
--
-- Phase 4 and the past-paper half of Phase 5.
--
-- 1. Every served question now carries its topic, unit, difficulty and
--    type, copied from the question at the moment it was served. Analytics
--    group by these, and a student can read them for their own attempts
--    without being given the question bank — the same reason the version
--    id is pinned: what counts is what the student actually sat.
--
-- 2. Past papers reuse the assessment engine rather than duplicating it.
--    One "past paper bank" assessment exists; starting it with a filter
--    (a paper, a section, some years, a topic) builds a practice attempt
--    from the published past-paper questions. Marking, review, autosave and
--    the answer-key protections are therefore identical to a class test.
--
-- 3. Ranking settings live in one row the teacher controls. The ranking
--    itself is computed in application code from attempt totals, where its
--    rules are unit-tested and documented on screen.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Served-question metadata
-- ---------------------------------------------------------------------
alter table public.attempt_questions
  add column if not exists node_id       uuid references public.syllabus_nodes (id) on delete set null,
  add column if not exists unit_id       uuid references public.syllabus_nodes (id) on delete set null,
  add column if not exists difficulty    public.difficulty_level,
  add column if not exists question_type public.question_type;

create index if not exists attempt_questions_unit_idx on public.attempt_questions (unit_id);
create index if not exists attempt_questions_node_idx on public.attempt_questions (node_id);

-- Backfill from the pinned versions, which is exactly what was served.
update public.attempt_questions aq
   set node_id       = v.syllabus_node_id,
       unit_id       = v.unit_id,
       difficulty    = v.difficulty,
       question_type = v.type
  from public.question_versions v
 where v.id = aq.question_version_id
   and aq.question_type is null;

-- A short description of what a practice attempt covered, e.g.
-- "2019 Paper II · Section B", shown in the student's history.
alter table public.attempts
  add column if not exists practice_label text;

alter table public.attempts
  drop constraint if exists attempts_practice_label_length;
alter table public.attempts
  add constraint attempts_practice_label_length
  check (practice_label is null or char_length(practice_label) <= 160);

-- ---------------------------------------------------------------------
-- Past papers
-- ---------------------------------------------------------------------
create table if not exists public.past_papers (
  id          uuid primary key default gen_random_uuid(),
  year        integer not null,
  title       text not null,
  description text,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint past_papers_year check (year between 1950 and 2100)
);

create unique index if not exists past_papers_year_title_key
  on public.past_papers (year, lower(title));

drop trigger if exists past_papers_set_updated_at on public.past_papers;
create trigger past_papers_set_updated_at
  before update on public.past_papers
  for each row execute function public.set_updated_at();

-- The question itself — text, answer key, worked solution, topic, marks —
-- lives in the question bank, versioned like any other. This table only
-- says where it appeared on the paper.
create table if not exists public.past_paper_questions (
  paper_id        uuid not null references public.past_papers (id) on delete cascade,
  question_id     uuid not null references public.questions (id) on delete restrict,
  question_number text not null,
  section         text,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  primary key (paper_id, question_id),
  constraint past_paper_questions_number check (char_length(question_number) between 1 and 12),
  constraint past_paper_questions_section check (section is null or char_length(section) between 1 and 40)
);

create index if not exists past_paper_questions_question_idx on public.past_paper_questions (question_id);
create index if not exists past_paper_questions_order_idx on public.past_paper_questions (paper_id, position);

-- ---------------------------------------------------------------------
-- The past-paper bank assessment
-- ---------------------------------------------------------------------
alter table public.assessments
  add column if not exists past_paper_bank boolean not null default false;

create unique index if not exists assessments_one_past_paper_bank
  on public.assessments (past_paper_bank)
  where past_paper_bank;

insert into public.assessments (
  title, description, kind, status, max_attempts, shuffle_questions, shuffle_options,
  show_results_immediately, show_correct_answers, show_explanations, allow_review,
  past_paper_bank, published_at
)
select
  'Past paper practice',
  'Practice drawn from published past papers. Managed automatically.',
  'practice', 'published', null, false, false,
  true, true, true, true,
  true, now()
where not exists (select 1 from public.assessments where past_paper_bank);

-- Every active student may practise past papers.
drop policy if exists assessments_student_read on public.assessments;
create policy assessments_student_read on public.assessments
  for select to authenticated
  using (
    (status = 'published' and archived_at is null and public.is_assigned_to_me(id))
    or (past_paper_bank and public.current_student_id() is not null)
    or exists (
      select 1 from public.attempts a
      where a.assessment_id = assessments.id and a.student_id = public.current_student_id()
    )
  );

-- ---------------------------------------------------------------------
-- Ranking settings — one row
-- ---------------------------------------------------------------------
create table if not exists public.ranking_settings (
  id                 boolean primary key default true,
  -- average | total | weighted | recent; documented on the rankings page.
  basis              text not null default 'average',
  recent_count       integer not null default 5,
  -- Weight per assessment kind. A kind with weight 0 does not count
  -- towards any ranking basis; practice is 0 by default because unlimited
  -- attempts at it would reward persistence, not attainment.
  weights            jsonb not null default
    '{"practice":0,"class_test":20,"unit_test":30,"term_test":50,"mock_exam":50,"revision":20,"custom":20}'::jsonb,
  -- A closed assessment set for the student's batch and not sat counts as
  -- 0%. Otherwise skipping a hard test would raise a student's rank.
  missed_counts_zero boolean not null default true,
  -- What students see: private (own rank only) | anonymous | batch (names).
  student_visibility text not null default 'private',
  updated_at         timestamptz not null default now(),
  constraint ranking_settings_singleton check (id),
  constraint ranking_settings_basis check (basis in ('average', 'total', 'weighted', 'recent')),
  constraint ranking_settings_recent check (recent_count between 1 and 50),
  constraint ranking_settings_visibility check (student_visibility in ('private', 'anonymous', 'batch'))
);

insert into public.ranking_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists ranking_settings_set_updated_at on public.ranking_settings;
create trigger ranking_settings_set_updated_at
  before update on public.ranking_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- start_attempt, now with past-paper practice
--
-- p_filter applies only to the past-paper bank:
--   { "paper_id": uuid, "section": text, "years": [int], "node_id": uuid,
--     "limit": int, "label": text }
-- ---------------------------------------------------------------------
drop function if exists public.start_attempt(uuid);

create or replace function public.start_attempt(p_assessment_id uuid, p_filter jsonb default null)
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
  v_paper      uuid;
  v_section    text;
  v_years      integer[];
  v_node       uuid;
  v_limit      integer;
  v_label      text;
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
     or not (v_assessment.past_paper_bank or public.is_assigned_to_me(p_assessment_id)) then
    raise exception 'This assessment is not available to you.' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_assessment_id::text || ':' || v_student::text, 0));

  select id into v_open
  from public.attempts
  where assessment_id = p_assessment_id and student_id = v_student and status = 'in_progress';

  if v_open is not null then
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

  if v_assessment.past_paper_bank and p_filter is not null then
    v_label := left(nullif(trim(p_filter ->> 'label'), ''), 160);
  end if;

  insert into public.attempts (assessment_id, student_id, attempt_number, deadline_at, practice_label)
  values (
    p_assessment_id,
    v_student,
    v_used + 1,
    least(now() + make_interval(mins => v_assessment.time_limit_minutes), v_assessment.closes_at),
    v_label
  )
  returning id into v_attempt;

  if v_assessment.past_paper_bank then
    v_paper   := nullif(p_filter ->> 'paper_id', '')::uuid;
    v_section := nullif(trim(p_filter ->> 'section'), '');
    v_node    := nullif(p_filter ->> 'node_id', '')::uuid;
    v_limit   := least(greatest(coalesce((p_filter ->> 'limit')::integer, 60), 1), 100);
    if jsonb_typeof(p_filter -> 'years') = 'array' then
      select array_agg(value::integer) into v_years from jsonb_array_elements_text(p_filter -> 'years');
    end if;

    insert into public.attempt_questions (
      attempt_id, position, question_id, question_version_id, max_marks,
      node_id, unit_id, difficulty, question_type
    )
    select v_attempt, row_number() over (order by picked.sort_year desc, picked.sort_title, picked.sort_position),
           picked.id, picked.current_version_id, picked.current_marks,
           picked.current_node_id, picked.current_unit_id, picked.current_difficulty, picked.current_type
    from (
      select distinct on (q.id)
             q.id, q.current_version_id, q.current_marks, q.current_node_id, q.current_unit_id,
             q.current_difficulty, q.current_type,
             pp.year as sort_year, pp.title as sort_title, ppq.position as sort_position
      from public.past_paper_questions ppq
      join public.past_papers pp on pp.id = ppq.paper_id and pp.published
      join public.questions q
        on q.id = ppq.question_id
       and q.status = 'published'
       and q.archived_at is null
       and q.current_version_id is not null
      where (v_paper is null or ppq.paper_id = v_paper)
        and (v_section is null or lower(ppq.section) = lower(v_section))
        and (v_years is null or pp.year = any (v_years))
        and (
          v_node is null
          or q.current_node_id in (
            with recursive subtree(id) as (
              select v_node
              union all
              select n.id from public.syllabus_nodes n join subtree s on n.parent_id = s.id
            )
            select id from subtree
          )
        )
      order by q.id, pp.year desc
    ) picked
    order by picked.sort_year desc, picked.sort_title, picked.sort_position
    limit v_limit;
  else
    for v_item in
      select * from public.assessment_items where assessment_id = p_assessment_id order by position, created_at
    loop
      if v_item.kind = 'question' then
        insert into public.attempt_questions (
          attempt_id, position, question_id, question_version_id, max_marks,
          node_id, unit_id, difficulty, question_type
        )
        select v_attempt, v_position + 1, q.id, q.current_version_id, q.current_marks,
               q.current_node_id, q.current_unit_id, q.current_difficulty, q.current_type
        from public.questions q
        where q.id = v_item.question_id
          and q.status = 'published'
          and q.archived_at is null
          and q.current_version_id is not null
        on conflict (attempt_id, question_id) do nothing;
      else
        insert into public.attempt_questions (
          attempt_id, position, question_id, question_version_id, max_marks,
          node_id, unit_id, difficulty, question_type
        )
        select v_attempt, v_position + row_number() over (), picked.id, picked.current_version_id, picked.current_marks,
               picked.current_node_id, picked.current_unit_id, picked.current_difficulty, picked.current_type
        from (
          select q.id, q.current_version_id, q.current_marks, q.current_node_id, q.current_unit_id,
                 q.current_difficulty, q.current_type
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
            and not exists (
              select 1 from public.attempt_questions aq
              where aq.attempt_id = v_attempt and aq.question_id = q.id
            )
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
  end if;

  select count(*) into v_total from public.attempt_questions where attempt_id = v_attempt;

  if v_total = 0 then
    raise exception 'No questions match that choice yet. Try a different paper, year or topic.'
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

revoke all on function public.start_attempt(uuid, jsonb) from public;
grant execute on function public.start_attempt(uuid, jsonb) to authenticated;

-- How many questions a past-paper choice would give, for the practice
-- screen. Counts only; never names the questions.
create or replace function public.past_paper_question_count(p_filter jsonb)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paper   uuid := nullif(p_filter ->> 'paper_id', '')::uuid;
  v_section text := nullif(trim(p_filter ->> 'section'), '');
  v_node    uuid := nullif(p_filter ->> 'node_id', '')::uuid;
  v_years   integer[];
  v_count   integer;
begin
  if public.current_student_id() is null and not public.is_teacher() then
    return null;
  end if;

  if jsonb_typeof(p_filter -> 'years') = 'array' then
    select array_agg(value::integer) into v_years from jsonb_array_elements_text(p_filter -> 'years');
  end if;

  select count(distinct q.id) into v_count
  from public.past_paper_questions ppq
  join public.past_papers pp on pp.id = ppq.paper_id and pp.published
  join public.questions q
    on q.id = ppq.question_id and q.status = 'published' and q.archived_at is null and q.current_version_id is not null
  where (v_paper is null or ppq.paper_id = v_paper)
    and (v_section is null or lower(ppq.section) = lower(v_section))
    and (v_years is null or pp.year = any (v_years))
    and (
      v_node is null
      or q.current_node_id in (
        with recursive subtree(id) as (
          select v_node
          union all
          select n.id from public.syllabus_nodes n join subtree s on n.parent_id = s.id
        )
        select id from subtree
      )
    );

  return v_count;
end;
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.past_papers          enable row level security;
alter table public.past_paper_questions enable row level security;
alter table public.ranking_settings     enable row level security;

drop policy if exists past_papers_teacher_all on public.past_papers;
create policy past_papers_teacher_all on public.past_papers
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists past_papers_read_published on public.past_papers;
create policy past_papers_read_published on public.past_papers
  for select to authenticated
  using (published);

drop policy if exists past_paper_questions_teacher_all on public.past_paper_questions;
create policy past_paper_questions_teacher_all on public.past_paper_questions
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- Students see which numbers and sections a published paper has — the
-- shape of the paper, not its content.
drop policy if exists past_paper_questions_read_published on public.past_paper_questions;
create policy past_paper_questions_read_published on public.past_paper_questions
  for select to authenticated
  using (exists (select 1 from public.past_papers pp where pp.id = paper_id and pp.published));

drop policy if exists ranking_settings_read on public.ranking_settings;
create policy ranking_settings_read on public.ranking_settings
  for select to authenticated using (true);

drop policy if exists ranking_settings_teacher_write on public.ranking_settings;
create policy ranking_settings_teacher_write on public.ranking_settings
  for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());
