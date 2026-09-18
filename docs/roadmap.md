# Roadmap

Six phases. Each one leaves the application runnable, and nothing advertises a feature that is not there — panels awaiting a later phase say so.

---

## Phase 1 — Foundation ✅ Complete

Project setup, authentication, roles, the database foundation, student management, batches, the syllabus tree, branding and both dashboards.

**Built**

- Next.js 16 + TypeScript strict + Tailwind v4 + shadcn/ui (Radix base)
- Supabase Auth with a teacher/student role model, enforced in three layers
- Migration 0001: `profiles`, `students`, `batches`, `batch_members`, `syllabus_nodes`, `student_notes`, `app_settings`, `audit_logs`, all with RLS
- Student management: create, edit, search, filter, paginate, archive, activate/deactivate, issue credentials, reset passwords, private teacher journal
- Batch management: create, edit, archive, add/remove/move students, batch statistics
- Syllabus: a unit → topic → subtopic tree the teacher can add to, rename, reorder and archive
- Teacher dashboard (roll, batches, syllabus, recent activity) and student dashboard (classes, syllabus, shared notes)
- Branding settings, audit log, dark mode, a mobile-first student experience
- Migration and seed scripts; 42 unit tests; lint, type-check and build all clean

**Deliberately absent:** anything that would need assessment data. The dashboard shows no averages or rankings rather than fabricating them.

---

## Phase 2 — Question engine ✅ Complete

The question bank, and everything needed to author Physics questions properly.

**Built**

- Migration 0002: `questions` (identity + a trigger-maintained snapshot of the current version), `question_versions` (immutable content), `question_tags`, all with RLS
- Seven question types: multiple choice, multiple response, true/false, numerical, short answer, structured multi-part, essay
- KaTeX rendering, server-side, with a live preview and symbol shortcuts in the editor
- Figures uploaded to a private Storage bucket and served through short-lived signed URLs
- Full metadata: syllabus topic, difficulty, marks, estimated time, source, year, paper reference, tags
- Search, filter by unit/type/difficulty/status/tag/year, pagination, preview, duplicate, archive, bulk actions
- Versioning: drafts edit in place, published questions fork; the database refuses to modify or delete a superseded version
- The marking engine — pure, dependency-free, and covered by 101 tests of its own

**The numerical engine.** Decimal arithmetic throughout (`decimal.js`), so `0.1 + 0.2` never enters a comparison. Significant figures are counted from the string the student typed, because `9.810` and `9.81` are the same number but not the same answer. Units are compared verbatim against an explicit list, case-sensitively, with no implicit conversion anywhere — if km/h is acceptable, the teacher says so and gives its own value. Scientific notation is accepted in every form students write it: `1.6e-19`, `1.6 × 10^-19`, `1.6 × 10⁻¹⁹`.

155 tests cover the question engine end to end; 197 across the project. Lint, type-check and build are clean.

**Deliberately not done:** CSV question import. It belongs with student CSV import in Phase 6, and the format should be settled once both are in view.

---

## Phase 3 — Assessment engine ← next

- Assessment builder: type, window, time limit, attempt count, marking rules
- Random question selection with per-topic and per-difficulty quotas, no duplicates within an attempt
- Assignment to batches or individual students
- The student sitting experience: timer, question navigator, flagging, autosave that survives a dropped connection, a warning before leaving
- Attempts materialised at start and pinned to question versions, so every attempt is reproducible
- Automatic marking, wiring the Phase 2 engine to attempts; manual marking with partial credit for essay and structured answers
- Explanations, worked solutions and review, shown only where the teacher enabled them

---

## Phase 4 — Ranking and analytics

- Gradebook
- A ranking engine with a documented, teacher-configurable score: total marks, average percentage, weighted assessments, or recent performance — with correct tie handling and no cross-batch leakage unless enabled
- Ranking privacy modes: private, anonymous, public within batch, full
- Per-student analytics: topic accuracy, difficulty breakdown, numerical vs conceptual, improvement over time
- Weak topic detection that shows its sample size and does not draw conclusions from four questions
- Question analytics, so the teacher can find questions that are too easy, too hard, or simply bad
- Assessment analytics: distribution, median, standard deviation, participation
- Progress timelines, CSV export

---

## Phase 5 — Learning ecosystem

- Past papers: year, paper, section, question number, linked to syllabus topics; practise a whole paper, a section, or a topic across years
- Learning materials in Supabase Storage, organised unit → topic → resource
- Formula vault, rendered with KaTeX
- Announcements and in-app notifications, delivered by email to students whose address is on file (email sign-in and the address itself landed early, out of phase order, because the teacher needed them)
- The recommended practice engine — deterministic, explainable, prioritising weakness, recency and unattempted content. No black box
- Lightweight gamification: streaks, topic mastery, personal bests

---

## Phase 6 — Production hardening

- Security review and an RLS audit against a live database, including the negative cases: a student cannot read another's results, reach teacher routes, alter marks or edit questions
- Integration tests for the security boundary — these need a real database and belong here rather than in unit tests
- Performance: cached statistics, index review, query budgets
- Accessibility audit
- CSV import for students and questions; PDF reports
- Operational documentation

---

## Working order

Later phases build directly on earlier ones, and one dependency in particular should not be reordered:

- **Cached statistics tables (Phase 4) must land with the analytics that read them.** Shipping dashboards that aggregate raw attempts and optimising later means rewriting every query.

Question versioning landed in Phase 2, before any attempt data exists — which was the point. Retrofitting it later is the kind of migration that loses results.
