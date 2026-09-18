/**
 * Applies every SQL file in supabase/migrations, in filename order, exactly
 * once. Applied files are recorded in `public.schema_migrations`.
 *
 *   npm run db:migrate
 *
 * Deliberately plain `pg` rather than the Supabase CLI: the schema is ordinary
 * Postgres, so the same script works against Supabase, a local Postgres, or
 * any other host the project moves to later.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { config } from 'dotenv';
import { Client } from 'pg';

// Load environment the way Next.js does: .env.local wins, .env fills the gaps.
// dotenv never overwrites a variable that is already set, so this order gives
// .env.local precedence, and a real shell variable beats both.
config({ path: '.env.local' });
config();

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase/migrations');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Copy it from Supabase → Project Settings → Database.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();

  await client.query(`
    create table if not exists public.schema_migrations (
      version    text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  // Exposed to migrations as current_setting('app.auth_email_domain'), so a
  // backfill that has to reconstruct a login address uses the same domain the
  // running app does rather than a hardcoded guess.
  await client.query('select set_config($1, $2, false)', [
    'app.auth_email_domain',
    process.env.AUTH_EMAIL_DOMAIN ?? 'physix.local',
  ]);

  const { rows } = await client.query<{ version: string }>('select version from public.schema_migrations');
  const applied = new Set(rows.map((row) => row.version));

  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`→ applying ${file} … `);

    try {
      // Each migration is one transaction: a failure leaves the schema untouched.
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into public.schema_migrations (version) values ($1)', [file]);
      await client.query('commit');
      console.log('done');
      count += 1;
    } catch (error) {
      await client.query('rollback');
      console.log('failed');
      console.error(error instanceof Error ? error.message : error);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log(count === 0 ? 'Schema already up to date.' : `Applied ${count} migration(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
