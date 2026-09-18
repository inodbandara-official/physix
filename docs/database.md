# Database

Schema, relationships and the Row Level Security model. The authoritative source is `supabase/migrations/`; this document explains the reasoning.

## Conventions

- UUID primary keys (`gen_random_uuid()`), except `app_settings`, which is a singleton keyed on `true`
- `created_at` / `updated_at` on every mutable table, kept current by a shared trigger
- **Archive, don't delete.** `archived_at` marks a row as out of the way while keeping it referenceable, so historical results stay meaningful
- Uniqueness is enforced case-insensitively, on `lower(column)`

## Tables (Phase 1)

```
auth.users ──1:1── profiles ──0:1── students ──*── batch_members ──*── batches
                      │                 │
                      │                 └──*── student_notes
                      │
                      └──*── audit_logs

syllabus_nodes ──self-referencing── syllabus_nodes     (unit → topic → subtopic)

app_settings   (single row: branding)
```

### `profiles`

One row per authenticated user, created automatically by a trigger on `auth.users`. Holds the role.

The trigger reads the role from `raw_app_meta_data`, which only the service role can write — never from `raw_user_meta_data`, which the client controls. A self-signup therefore cannot mint a teacher account even if public sign-up were left enabled.

### `students`

The teacher's roll. `profile_id` is nullable because **a student record exists before a login account does** — the teacher adds the student, then issues credentials when they are ready to.

Three fields decide how a student signs in:

- `email` — their own address. When present it is **both** the login identity and where notifications go. Optional, because many A/L students have no mailbox
- `username` — the fallback login identity, expanded to `username@AUTH_EMAIL_DOMAIN`
- `login_email` — the address the auth account **actually** uses, written when credentials are issued

`login_email` is recorded rather than recomputed on demand, for two reasons: changing `AUTH_EMAIL_DOMAIN` later must not silently invalidate existing logins, and sign-in needs to resolve a typed username to an address without guessing which rule applied at the time.

`email` and `login_email` each carry a partial unique index on `lower(...)`, because an address that two students share is an address that cannot identify either of them.

Editing `students.email` on a student who already has an account updates the Supabase Auth user in the same action (`syncLoginEmail`), so the record and the auth account can never disagree about what the student types. Removing the address moves them back to the username form rather than leaving them with no way in.

`notes` on this table is a short note attached to the record. The dated teacher's journal is `student_notes`, a separate table, because those are two different things in practice: one is a property of the student, the other is a running commentary.

### `batches` and `batch_members`

A student may belong to several batches. Membership is closed with `left_at` rather than deleted, so an assessment result can still be attributed to the batch the student was in at the time.

Unique on `(lower(name), coalesce(al_year, -1))`, which allows "Colombo Saturday" to exist once per A/L year.

### `syllabus_nodes`

One self-referencing table instead of three (`units`, `topics`, `subtopics`).

The brief lists a fixed hierarchy, but it also requires the teacher to reshape it freely. Three tables would make "add a level below subtopic" a migration; one table with a `kind` enum and a `parent_id` makes it a row.

Nesting is enforced by a trigger — a unit must be at the top, a topic must sit in a unit, a subtopic in a topic — and the trigger raises messages written for teachers, which `humanizeDatabaseError` passes straight through.

Archiving a branch archives its descendants, so a hidden topic cannot leave stray visible children. A node whose parent is missing is surfaced at the top level rather than silently dropped, so the teacher can see and fix it.

### `app_settings`

A single row, constrained to one by `check (id)` on a boolean primary key. Holds the LMS name, tagline, teacher name, logo and brand colours.

### `audit_logs`

Append-only. There is no `UPDATE` or `DELETE` policy, so those are denied for every role except the service role. Teachers can read their own log; nobody can edit it.

`metadata` is a small JSONB object for context (counts, status changes). It never holds passwords, tokens or answer content.

## Question bank (Phase 2)

```
questions ──1:many── question_versions        (identity → immutable content)
    │                      ▲
    │  current_version_id ─┘
    └──*── question_tags
```

### `questions` — identity

Holds the stable question ID, its curation state (`draft` / `published` / `archived`), and a pointer to the version that is currently live. No content whatsoever.

It also carries a block of `current_*` columns — type, title, stem, marks, difficulty, syllabus node, unit, year — which are a **denormalised snapshot** of whatever `current_version_id` points at, maintained by two triggers:

- repointing `current_version_id` is caught `BEFORE UPDATE` on `questions`
- editing a draft in place is caught `AFTER UPDATE` on `question_versions`, and only for the row that is actually current

They exist because there are *two* foreign keys between `questions` and `question_versions`, which makes every embedded PostgREST query ambiguous and fragile. Filtering a snapshot column instead is one indexed predicate, and it is what Phase 3's random question selection will draw on:

```sql
create index questions_selection_idx
  on questions (status, current_unit_id, current_difficulty)
  where archived_at is null;
```

The snapshot is never written by the application. If it is ever wrong, the triggers are wrong.

### `question_versions` — immutable content

Everything a student could see: stem, marks, difficulty, syllabus node, figures, explanation, worked solution, and the type-specific `body`.

**`body` is JSONB**, and deliberately so. The shape genuinely differs per question type — options for multiple choice, accepted-value specifications for numerical, nested parts for structured — it is always read whole, and it is never queried field by field. Six side tables would buy nothing and cost every read a join. The contract is the discriminated union in `src/features/questions/types.ts`, and every write is validated by Zod before it reaches the column.

**Immutability is enforced in the database, not just the app.** Two triggers refuse to update or delete any version that is no longer current:

```
Question version 2 is superseded and cannot be changed. Create a new version instead.
```

This is the guarantee §41 asks for, and it holds even against a bug in the application layer. The rule the teacher experiences:

| Status | Editing does |
| --- | --- |
| `draft` | Overwrites version 1 — nobody has sat it, so its edit history is noise |
| `published` | Creates version n+1; version n is frozen |
| `archived` | Same as published |

"Changed" means the content fingerprint changed: a stable, key-sorted serialisation of everything a student could notice. Teacher-only fields — private notes, tags — are not content, so relabelling never forks a version.

### `question_tags`

Free-form curation labels, constrained to `^[a-z0-9][a-z0-9-]{0,39}$`. Tags belong to the *question*, not to a version, because relabelling is not a content change.

### Storage

Figures live in a private `question-figures` bucket, capped at 5 MB and restricted to image types. Only the teacher can read or write it today; the app serves figures through signed URLs that last an hour. Phase 3 adds a policy letting a student read a figure belonging to a question in an assessment they have been assigned.

### Student access

There is deliberately **no student RLS policy on any of these tables.** Students never read the question bank directly — from Phase 3 they see only the specific version served to them through an attempt, which carries its own policies. Correct answers, solutions and teacher notes are therefore unreachable, rather than merely un-rendered.

## Row Level Security

Every table has RLS enabled. Two `SECURITY DEFINER` helpers do the work:

```sql
public.is_teacher()          -- is the caller the teacher?
public.current_student_id()  -- which student record is the caller?
```

They are `SECURITY DEFINER` so that a policy on `profiles` does not recurse into `profiles`, and `STABLE` so the planner evaluates them once per statement rather than once per row.

| Table | Teacher | Student |
| --- | --- | --- |
| `profiles` | All | Read and update own row; cannot change own role |
| `students` | All | Read own row only |
| `batches` | All | Read batches they are currently in |
| `batch_members` | All | Read own memberships |
| `syllabus_nodes` | All | Read non-archived nodes |
| `student_notes` | All | Read only notes marked `published`, on their own record |
| `app_settings` | Update | Read |
| `audit_logs` | Read | None |
| `questions` | All | None |
| `question_versions` | All | None |
| `question_tags` | All | None |

Two properties worth stating explicitly, because they are the ones that matter:

- **A student cannot read another student's record.** `students_read_self` matches on `profile_id = auth.uid()`; there is no policy that widens this.
- **A student cannot write anything about themselves that affects assessment.** Their only write is to their own `profiles` row, and the `WITH CHECK` clause pins `role` to its current value.

The service-role key bypasses all of this, which is why it is used for exactly one thing — creating and updating auth users — and never for reading or writing application data on behalf of a request.

## Migrations

Numbered SQL files in `supabase/migrations/`, applied in filename order by `npm run db:migrate` and recorded in `public.schema_migrations`. Each runs in its own transaction, so a failure leaves the schema untouched.

Migrations are append-only. To change something, add a new file.

When you add a migration, update `src/types/database.ts` in the same commit. It is hand-maintained rather than generated so that builds never depend on a live database.

## Planned schema (later phases)

Sketched here so the tables that exist make sense as a foundation.

**Phase 3 — assessments**

```
assessments           configuration: window, time limit, attempts, marking rules
assessment_items      a fixed question, or a random-selection rule
assessment_attempts   one row per attempt, with timing
attempt_questions     the questions actually served, pinned to a version
attempt_answers       what the student submitted, and what it scored
```

`attempt_questions` is materialised when the attempt starts. Random selection is resolved once, so an attempt is reproducible and a student cannot reshuffle by reloading.

**Phase 4 — analytics and ranking**

```
student_topic_stats   cached accuracy per student per topic
question_stats        cached difficulty and timing per question
ranking_configs       the basis and weights the teacher chose
ranking_snapshots     computed rankings, so history is stable
```

These are caches, refreshed on write. Nothing on a dashboard aggregates raw attempts at request time.
