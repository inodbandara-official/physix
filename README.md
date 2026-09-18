# PHYSIX

A private Learning Management System for a single Sri Lankan G.C.E. Advanced Level Physics teacher and their students.

Not a general-purpose LMS. It is built around one teacher's actual working day: keep a roll of students, organise them into batches, build a question bank against your own syllabus, set assessments, mark them automatically, rank students by rules you choose, and see which topics need more work.

**Current status: Phase 2 complete.** Authentication, roles, the student roll, batches and the syllabus tree are working, and so is the versioned question bank — seven Physics question types, LaTeX rendering, figures, and a numerical marking engine with tolerance, significant figures and unit checking. The assessment engine, ranking and analytics arrive in later phases — see [docs/roadmap.md](docs/roadmap.md).

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS v4, shadcn/ui (Radix base) |
| Database | PostgreSQL via Supabase, with Row Level Security |
| Auth | Supabase Auth (email + password) |
| Files | Supabase Storage (question figures; notes from Phase 5) |
| Validation | Zod, shared between client forms and Server Actions |
| Maths | KaTeX, rendered on the server |
| Decimals | decimal.js — no floating point anywhere in marking |
| Tests | Vitest |

Database access is confined to `src/features/*/queries.ts` and `actions.ts`, and the schema is plain Postgres with no Supabase-specific extensions beyond `auth.uid()`. Moving to another Postgres host later means replacing the client, not rewriting the app.

---

## Getting started

### 1. Prerequisites

- Node.js 20.9+ (developed on 24)
- A Supabase project — free tier is enough

### 2. Install

```bash
npm install
cp .env.example .env.local
```

### 3. Configure

Fill in `.env.local`. Every value is explained in `.env.example`; the ones you must set are:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. **Secret** — server-side only |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (URI) |
| `AUTH_EMAIL_DOMAIN` | Any domain you control the meaning of, e.g. `physix.local` |

### 4. Create the schema

```bash
npm run db:migrate
```

This applies every file in `supabase/migrations/` in order and records what it applied in `public.schema_migrations`, so it is safe to re-run.

### 5. Turn off public sign-up

In Supabase → Authentication → Sign In / Providers, **disable "Allow new users to sign up"**.

This matters. Accounts in this system are created by the teacher, never self-service. The database only ever reads a new user's role from `raw_app_meta_data`, which a client cannot set, so a stray sign-up could not become a teacher — but leaving public sign-up on would still let strangers create student-shaped accounts.

### 6. Seed demo data (optional)

```bash
# Choose your own passwords first — the script refuses to run without them.
SEED_TEACHER_PASSWORD='...' SEED_STUDENT_PASSWORD='...' npm run db:seed
```

Creates one teacher, twenty fictional students, four batches, a full A/L Physics syllabus and 57 real A/L Physics questions covering every unit and every question type. Re-running it is safe.

### 7. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

---

## Writing questions

Questions live in the bank independently of any assessment, so one question can be reused across a quiz, a unit test and past-paper practice.

**Maths** is written between dollar signs — `$F = ma$` inline, `$$v^2 = u^2 + 2as$$` on its own line — and rendered with KaTeX on the server. The editor has a preview toggle and buttons for the symbols A/L Physics needs most.

**Numerical answers** are the part worth understanding before you write many. Each accepted answer carries:

- a **value**, stored as a decimal string, never a float
- a **tolerance** — exact, absolute (`± 0.05`) or relative (`± 2%`)
- optional **significant figures**, checked against what the student typed: `9.810` and `9.81` are the same number but not the same answer
- **accepted units**, compared verbatim and case-sensitively, because `m` and `M` are different units

**Nothing is converted between units.** If you will accept km/h as well as m/s, add a second accepted answer with its own value in km/h. A marking engine that silently converted would eventually accept an answer that is wrong in the physics.

**Versioning.** A draft is a working document: edits overwrite it. A published question is a record: any change a student could notice creates a new version, and the old one is frozen — the database refuses to modify or delete a superseded version. From Phase 3 an attempt stores the version it served, so a completed assessment always shows exactly what was sat, even after the question is corrected.

---

## Signing in

There are two kinds of account, and they sign in differently.

**The teacher** signs in with their email address (`teacher@example.com` after seeding).

**Students with an email address** sign in with it. That address is also where notifications go, and it lets them reset their own password from the sign-in page.

**Students without one** sign in with the username you issued — just `nimalperera001`. Many A/L students have no personal mailbox, so the app expands the username to `<username>@AUTH_EMAIL_DOMAIN` before handing it to Supabase Auth. That domain never has to receive mail, and those students keep teacher-issued password resets.

Which of the two applies is recorded on each student as `login_email` when their account is created, so the app never has to guess. Add an email to a student who signs in by username and their account moves over automatically — the roll tells you the new address.

Three consequences worth knowing:

- **Do not change `AUTH_EMAIL_DOMAIN` once accounts exist.** Students who sign in by username would be locked out. Students signing in with their own email are unaffected.
- **Two students cannot share an email address**, because it is a login identity.
- **Passwords are shown once**, at the moment they are generated, and are never stored in readable form.

### Sending email

Supabase's built-in SMTP is for development only: a handful of messages an hour, and to your own team addresses. Before students receive anything — password resets included — set up **custom SMTP** under Project Settings → Authentication → SMTP Settings (Resend, SendGrid, Amazon SES, or your own server).

Until you do, a student who clicks "Forgot your password?" will not receive the email.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (also type-checks) |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watching |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Seed demo data |

---

## Project layout

```
src/
  app/              routes only — thin pages that call into features/
    login/          sign-in (public)
    t/              teacher area, guarded by role
    s/              student area, guarded by role
  components/       shared UI (app shell, form primitives, empty states)
    ui/             shadcn/ui primitives — generated, not hand-edited
  features/         one folder per domain
    <feature>/
      schema.ts     Zod schemas — the single source of validation truth
      queries.ts    reads (server-only)
      actions.ts    writes (Server Actions)
      components/   domain UI
  lib/              cross-cutting: auth guards, Supabase clients, errors, env
  types/database.ts hand-maintained mirror of the SQL schema
supabase/migrations/  numbered, append-only SQL
scripts/              migrate and seed
docs/                 architecture, database, deployment, roadmap
```

The rule that keeps this tidy: **routes never talk to the database directly.** A page calls a feature query; a form posts to a feature action. Everything else follows from that.

---

## Documentation

- [docs/architecture.md](docs/architecture.md) — how the pieces fit, and why
- [docs/database.md](docs/database.md) — schema, relationships and RLS model
- [docs/deployment.md](docs/deployment.md) — deploying to Vercel and Supabase
- [docs/roadmap.md](docs/roadmap.md) — what is built, what is next
