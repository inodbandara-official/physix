# Architecture

This document explains the shape of the system and the reasoning behind the decisions that are hard to reverse later.

## Shape

A modular monolith. One Next.js application, one Postgres database, no services to coordinate. The modularity is in the folder structure and in who is allowed to call whom — not in deployment boundaries.

```
Browser
   │
   ▼
Next.js (Vercel)
   ├── proxy.ts ............ refreshes the session, redirects by role
   ├── app/ ................ routes: thin, no database access
   ├── features/ ........... queries (read) + actions (write) + domain UI
   └── lib/ ................ auth guards, Supabase clients, errors, env
   │
   ▼
Supabase
   ├── Postgres + Row Level Security ..... the real authorisation boundary
   ├── Auth .............................. identity and sessions
   └── Storage ........................... question figures; notes from Phase 5
```

## The one rule

**Routes never talk to the database.** A page calls a feature query; a form posts to a feature action.

This is what keeps the app from turning into a pile of inline Supabase calls. It also means the eventual move off Supabase touches `lib/supabase/*` and the query layer, not two hundred components.

## Reads and writes

**Reads** are Server Components calling `features/*/queries.ts`. They run on the server with the caller's session, so RLS applies. Nothing marked `server-only` can be imported into a Client Component — that is a build error, not a code review comment.

**Writes** are Server Actions in `features/*/actions.ts`. Every one of them follows the same four steps:

1. `await requireTeacher()` (or `requireStudent()`) — re-checks the role server-side
2. Parse the `FormData` with the feature's Zod schema
3. Perform the write, mapping any database error to a human sentence
4. Record an audit row and revalidate the affected paths

Every action returns the same `ActionState` shape, so forms render errors uniformly and `useActionForm` stays typed.

## Three layers of authorisation

Each layer exists because the one before it can be bypassed.

| Layer | File | What it does | What it does **not** do |
| --- | --- | --- | --- |
| Proxy | `src/proxy.ts` | Refreshes the session cookie, redirects a signed-out or wrong-role visitor | Protect anything — it is a convenience |
| Server guard | `lib/auth/session.ts` | `requireTeacher()` / `requireStudent()` at the top of every page and action | Constrain a query that forgets to filter |
| RLS | `supabase/migrations/` | Decides, per row, what this user may read or write | — |

RLS is the real boundary. If every check in the TypeScript above it were deleted, a student still could not read another student's record.

A student who reaches `/t/students` is redirected to their own dashboard rather than shown a 403, so the app does not confirm which teacher routes exist.

## Resolving who is signing in

The sign-in form takes one field: an email address or a username. An email is used as typed. A username is resolved to the student's `login_email` using the **service-role client, inside the Server Action**.

That lookup deliberately never crosses to the browser. An RPC that mapped username to email would be an enumeration vector and would leak students' addresses; doing it server-side means a wrong username and a wrong password produce the same generic failure.

Password reset follows the same principle: `requestPasswordResetAction` reports success whether or not the address is registered, because a form that says "no such account" is a way of testing which of a teacher's students are enrolled.

## Why forms use a hook instead of `useActionState` + `useEffect`

`useActionForm` (`lib/use-action-form.ts`) runs the action inside a transition and handles the result where it arrives — closing the dialog, navigating, resetting the form.

The obvious alternative, watching the action result in a `useEffect`, means the dialog closes a render *after* the result lands. That cascades renders, and React's `set-state-in-effect` rule flags it. Handling the result in the submit path is both faster and easier to read.

`useFormStatus` still works inside the returned `formAction`, so `SubmitButton` keeps its pending state with no extra wiring.

## Validation lives in one place

Each feature's `schema.ts` holds Zod schemas used by the Server Action. Client-side, the browser's own `required` and `type` attributes catch the obvious mistakes; everything that actually matters is validated on the server, and errors come back as a field-keyed map the `Field` component renders.

There is deliberately no second, client-only copy of the rules to drift out of sync.

## Errors users can act on

`lib/errors.ts` maps Postgres codes and constraint names to sentences a teacher can act on.

```
23505 on students_student_code_key  →  "A student with this Student ID already exists."
```

Raw database text never reaches the UI. When a check-constraint trigger raises a message written for humans — as the syllabus nesting trigger does — that message is passed through unchanged, which keeps the rule and its explanation in one place.

## The marking engine

`features/questions/marking/` is pure: functions over a question body and a response, with no database, session or side effects. Phase 3 wires it to attempts; nothing about it changes when it does.

That purity is what makes it testable to the degree it needs to be — 101 tests, because marking correct Physics as wrong is the worst failure this system can have.

Three rules govern the numerical path, each because the alternative is wrong:

1. **Decimal arithmetic, never floating point.** `0.1 + 0.2` must not enter a comparison.
2. **Significant figures are counted from the string the student typed**, not the parsed value. `9.810` and `9.81` are the same number and different answers.
3. **Units are compared verbatim against an explicit list, case-sensitively.** Nothing is converted. `m` and `M` are different units, and an engine that quietly converted would eventually accept an answer that is wrong in the physics.

The engine reports *why*, not just whether: `missing-unit` and `wrong-significant-figures` are distinct outcomes from `wrong-value`, and when several accepted answers are configured it returns the most informative result rather than the first mismatch.

## Rendering maths

`components/math-text.tsx` splits text on `$…$` and `$$…$$` and renders the maths with KaTeX. It is a server component by default, so a page of questions ships no JavaScript for it.

Everything outside the delimiters is rendered as React children, so it is escaped automatically; only KaTeX's own output is injected as HTML, and KaTeX runs with `trust: false`, so `\href` in a question cannot become a link. A formula that fails to parse renders as the source the teacher typed, in red — far more useful than a blank space or a crashed page.

It is deliberately **not** a Markdown renderer. Accepting arbitrary HTML from a question field would mean shipping a sanitiser and trusting it; paragraphs, line breaks and maths cover what a Physics question actually needs.

## Question versioning

Identity and content are separate tables: `questions` and `question_versions`. Editing a published question writes a new version and repoints `questions.current_version_id`; the old version is frozen by a database trigger, not merely by convention.

The decision of whether an edit forks a version is a pure function (`versioning.ts`) over a **content fingerprint** — a key-sorted serialisation of everything a student could notice. Teacher-only fields are excluded, so relabelling or annotating never creates a version.

See [database.md](database.md) for the schema and the guarantees it enforces.

## Branding is data

The `app_settings` singleton holds the LMS name, tagline, teacher name, logo and colours. The shell injects the colours as CSS custom properties (`--brand-primary`). Nothing in the source hardcodes a name, so rebranding is a form submission.

## Performance decisions already made

- **Every list paginates.** Student lists are server-filtered and server-paginated; `perPage` is capped at 100 in the schema so a crafted query string cannot ask for the whole table.
- **Search uses trigram indexes** on `full_name` and `student_code`, not a client-side filter.
- **`getSession` is `cache()`d per request**, so a page rendering six server components makes one auth round-trip.
- **The question bank filters on a denormalised snapshot**, not a join. `questions.current_*` is trigger-maintained, so every filter is one indexed predicate — and it is the index Phase 3's random selection will use.
- **Derived statistics will be cached, not recomputed.** From Phase 4, topic and question statistics live in their own tables, refreshed on write. The dashboard must never aggregate every attempt on page load.

## What is deliberately not done yet

The teacher dashboard shows no averages, no rankings and no at-risk students; a question's page shows no success rate. Those figures need attempt data that does not exist yet, and inventing plausible-looking placeholders would be worse than an honest empty state. Each such panel says which phase fills it in.

## Concepts borrowed from Moodle

Moodle is used as a source of proven ideas, not code or UI:

- **Questions live independently of assessments** and are reused across them *(built)*
- **Question versioning**, so editing a question cannot rewrite a completed attempt *(built)*
- **Random selection from categories**, with per-topic and per-difficulty quotas
- **Multiple attempts**, each stored in full
- **Question performance statistics** used to judge the question, not just the student

The implementation is much smaller and specific to A/L Physics: one teacher, one subject, a syllabus tree the teacher owns, and numerical answers with tolerance and units.
