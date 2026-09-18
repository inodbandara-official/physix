# Deployment

Target: Vercel for the app, Supabase for the database, auth and files.

## 1. Supabase

1. Create a project. Pick a region near your students — Singapore or Mumbai for Sri Lanka.
2. Copy the connection string from **Project Settings → Database → Connection string (URI)**.
3. Apply the schema from your machine:

   ```bash
   DATABASE_URL='postgresql://...' npm run db:migrate
   ```

   This also creates the private `question-figures` Storage bucket and its policies, so there is nothing to set up by hand in the Storage dashboard.

   Those statements need ownership of `storage.objects`, which the `postgres` role in the connection string has. If your connection uses a more restricted role, migration 0002 will fail on them — the whole migration rolls back, so nothing is half-applied. Either run it as `postgres`, or create the bucket and its four policies from **Storage → Policies** in the dashboard and re-run.

4. In **Authentication → Sign In / Providers**, turn **off** "Allow new users to sign up".

   Accounts are created by the teacher. Leaving this on would let strangers create student-shaped accounts. (They could not become a teacher — the role is read from `raw_app_meta_data`, which clients cannot set — but they should not be able to create accounts at all.)

5. In **Authentication → URL Configuration**, set the Site URL to your production domain.

6. Create the first teacher account. Either run the seed script, or create a user in the Supabase dashboard and then, in the SQL editor:

   ```sql
   update public.profiles set role = 'teacher' where email = 'you@example.com';
   ```

## 2. Vercel

1. Import the repository.
2. Add the environment variables under **Settings → Environment Variables**:

   | Variable | Environments |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
   | `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview — **never** expose to the client |
   | `AUTH_EMAIL_DOMAIN` | All |

   `DATABASE_URL` is **not** needed on Vercel. It is only used by the migration script, which runs from your machine.

3. Deploy. The build does not contact the database, so a missing variable surfaces on the first request rather than breaking the build.

## 3. After deploying

- Sign in as the teacher and set the LMS name, colours and contact details under **Settings → Branding**
- Build the syllabus, or seed it
- Create batches, add students, issue credentials

## Migrations on an existing deployment

Run from your machine against the production `DATABASE_URL`:

```bash
DATABASE_URL='postgresql://...' npm run db:migrate
```

Already-applied files are skipped. Each migration runs in a transaction, so a failure leaves the schema as it was.

Deploy code and schema in the right order: **apply the migration first, then deploy the code that needs it.** Migrations are additive, so the running version keeps working in between.

## Backups

Supabase takes daily backups on paid plans. On the free tier, take your own before anything irreversible:

```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl > backup-$(date +%F).sql
```

The question bank and, from Phase 3, assessment results are the parts that cannot be recreated. Back up before every migration that touches `question_versions` or `attempt_*`.

Storage is backed up separately from the database. `pg_dump` does not include the contents of the `question-figures` bucket.

## Moving off Supabase later

The schema is plain Postgres. The only Supabase-specific pieces are:

- `auth.users` and `auth.uid()` in the RLS policies
- `lib/supabase/*`, the four client factories
- Supabase Storage, for question figures (and learning materials from Phase 5)

Replacing auth means providing an equivalent `auth.uid()` and rewriting those four files. Every query and action above them keeps working, because none of them import a Supabase type directly.

## Monitoring

- Vercel: build and function logs
- Supabase: **Reports** for slow queries, **Logs** for auth failures
- In-app: **Settings → Activity log**, which records every consequential teacher action

## Cost

At one teacher and a few hundred students, both free tiers are sufficient. The first limit you are likely to meet is Supabase Storage, once diagrams and PDF notes arrive in Phase 5.
