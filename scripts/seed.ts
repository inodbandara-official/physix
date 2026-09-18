/**
 * Seeds a realistic demo academy: one teacher, twenty students, four batches
 * and a full A/L Physics syllabus. Safe to re-run — everything is upserted by
 * a natural key.
 *
 *   npm run db:seed
 *
 * Passwords come from the environment (SEED_TEACHER_PASSWORD /
 * SEED_STUDENT_PASSWORD). Nothing is hardcoded, so a seeded database is never
 * accidentally shipped with a known password.
 *
 * Assessments and attempts are seeded by later phases.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

import type { Database, Json } from '../src/types/database';
import { SEED_QUESTIONS, type SeedBody, type SeedQuestion } from './seed-questions';

// Load environment the way Next.js does: .env.local wins, .env fills the gaps.
// dotenv never overwrites a variable that is already set, so this order gives
// .env.local precedence, and a real shell variable beats both.
config({ path: '.env.local' });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = process.env.AUTH_EMAIL_DOMAIN ?? 'physix.local';
const teacherEmail = process.env.SEED_TEACHER_EMAIL ?? 'teacher@example.com';
const teacherPassword = process.env.SEED_TEACHER_PASSWORD;
const studentPassword = process.env.SEED_STUDENT_PASSWORD;

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}
if (!teacherPassword || !studentPassword) {
  console.error('Set SEED_TEACHER_PASSWORD and SEED_STUDENT_PASSWORD before seeding.');
  process.exit(1);
}

const REQUEST_TIMEOUT_MS = 25_000;

const supabase = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    // Seeding runs over whatever connection the teacher has. Node's default
    // timeout is optimistic for a long-haul link, and a request that dies
    // mid-flight reports only "fetch failed", so give it room.
    fetch: (input, init) =>
      fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
  },
});

// ---------------------------------------------------------------------
// Network resilience
//
// Seeding talks to Supabase over HTTP a few hundred times. On a flaky
// connection one of those calls will eventually drop, and losing the whole
// run to a single dropped socket is not acceptable.
//
// Only *transient* failures are retried. A real API error — a duplicate
// key, a constraint violation — is reported immediately, because retrying
// it would just fail again more slowly.
// ---------------------------------------------------------------------

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code ? `${error.message} (${cause.code})` : error.message;
  }
  return String(error);
}

function isTransient(error: unknown): boolean {
  const message = describeError(error).toLowerCase();
  return [
    'fetch failed',
    'econnreset',
    'etimedout',
    'econnrefused',
    'socket hang up',
    'enotfound',
    'eai_again',
    'network',
    // An aborted request is our own timeout firing on a stalled connection.
    'timeout',
    'aborted',
    'und_err',
  ].some((signal) => message.includes(signal));
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs one Supabase call, retrying transient network failures.
 *
 * `label` is what the user sees if it ultimately fails, so it names the
 * work rather than the call: "insert 24 syllabus topics", not "insert".
 */
async function call<T>(
  label: string,
  // Every caller hands back `{ data, error }`: PostgREST natively, the auth
  // admin API after being unwrapped at the call site. `data` is nullable on
  // failure, and the guard below turns that into a thrown, labelled error.
  run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  attempts = 6,
): Promise<NonNullable<T>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { data, error } = await run();
      if (error) throw new Error(error.message);
      // Every call here either inserts and returns the row, or selects a
      // list. A null payload means the write did not land as expected.
      if (data === null || data === undefined) throw new Error('no data was returned');
      return data as NonNullable<T>;
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === attempts) break;

      const backoff = 500 * 2 ** (attempt - 1);
      console.warn(`  … ${label}: ${describeError(error)} — retrying in ${backoff}ms`);
      await wait(backoff);
    }
  }

  throw new Error(`${label}: ${describeError(lastError)}`);
}

/** Sri Lankan A/L Physics syllabus, as a starting point the teacher can edit. */
const SYLLABUS: { unit: string; topics: { name: string; subtopics: string[] }[] }[] = [
  {
    unit: 'Measurement',
    topics: [
      { name: 'Physical Quantities and Units', subtopics: ['SI Units', 'Dimensions', 'Errors and Uncertainty'] },
    ],
  },
  {
    unit: 'Mechanics',
    topics: [
      { name: 'Motion', subtopics: ['Equations of Motion', 'Projectile Motion', 'Relative Motion'] },
      { name: 'Newton’s Laws', subtopics: ['Force and Momentum', 'Friction', 'Connected Bodies'] },
      { name: 'Work, Energy and Power', subtopics: ['Work–Energy Theorem', 'Conservation of Energy'] },
      { name: 'Circular Motion', subtopics: ['Centripetal Force', 'Banking of Roads'] },
      { name: 'Gravitational Fields', subtopics: ['Newton’s Law of Gravitation', 'Satellites'] },
    ],
  },
  {
    unit: 'Oscillations and Waves',
    topics: [
      { name: 'Simple Harmonic Motion', subtopics: ['SHM Equations', 'Pendulum and Spring'] },
      { name: 'Wave Motion', subtopics: ['Progressive Waves', 'Stationary Waves', 'Sound Waves'] },
      { name: 'Interference and Diffraction', subtopics: ['Young’s Double Slit', 'Diffraction Grating'] },
    ],
  },
  {
    unit: 'Thermal Physics',
    topics: [
      { name: 'Heat and Temperature', subtopics: ['Thermal Expansion', 'Specific Heat Capacity'] },
      { name: 'Gas Laws', subtopics: ['Ideal Gas Equation', 'Kinetic Theory'] },
      { name: 'Heat Transfer', subtopics: ['Conduction', 'Convection and Radiation'] },
    ],
  },
  {
    unit: 'Optics',
    topics: [
      { name: 'Reflection and Refraction', subtopics: ['Total Internal Reflection', 'Lenses'] },
      { name: 'Optical Instruments', subtopics: ['Microscope', 'Telescope'] },
    ],
  },
  {
    unit: 'Electricity and Magnetism',
    topics: [
      { name: 'Electric Fields', subtopics: ['Coulomb’s Law', 'Potential and Capacitance'] },
      { name: 'Current Electricity', subtopics: ['Ohm’s Law', 'Kirchhoff’s Laws', 'Potentiometer'] },
      { name: 'Magnetic Fields', subtopics: ['Force on a Conductor', 'Electromagnetic Induction'] },
      { name: 'Alternating Current', subtopics: ['RMS Values', 'Transformers'] },
    ],
  },
  {
    unit: 'Modern Physics',
    topics: [
      { name: 'Photoelectric Effect', subtopics: ['Einstein’s Equation'] },
      { name: 'Atomic and Nuclear Physics', subtopics: ['Radioactive Decay', 'Nuclear Energy'] },
    ],
  },
];

const BATCHES = [
  { name: 'Colombo Saturday', code: 'CMB-SAT', al_year: 2026, schedule_note: 'Saturdays, 8:00 AM' },
  { name: 'Colombo Sunday', code: 'CMB-SUN', al_year: 2026, schedule_note: 'Sundays, 8:00 AM' },
  { name: 'Online Batch', code: 'ONL-26', al_year: 2026, schedule_note: 'Wednesdays, 7:00 PM' },
  { name: 'Revision Batch', code: 'REV-25', al_year: 2025, schedule_note: 'Fridays, 5:00 PM' },
];

const STUDENT_NAMES = [
  'Nimal Perera', 'Kavindi Fernando', 'Sahan Wickramasinghe', 'Thilini Jayawardena',
  'Ruwan Bandara', 'Dilini Gunasekara', 'Chamara Silva', 'Hiruni Rajapaksa',
  'Isuru Wijesinghe', 'Nethmi Dissanayake', 'Kasun Ratnayake', 'Sanduni Herath',
  'Tharindu Weerasinghe', 'Amaya Senanayake', 'Pasindu Ekanayake', 'Malsha Abeywardena',
  'Dinuka Mendis', 'Yasas Karunaratne', 'Oshadi Liyanage', 'Janith Samarasekara',
];

const SCHOOLS = [
  'Royal College, Colombo', 'Ananda College, Colombo', 'Nalanda College, Colombo',
  'Visakha Vidyalaya, Colombo', 'Devi Balika Vidyalaya, Colombo', 'Mahanama College, Colombo',
  'D. S. Senanayake College, Colombo', 'St. Joseph’s College, Colombo',
];

const DISTRICTS = ['Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Galle'];

function slugUsername(name: string, index: number) {
  return `${name.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '').slice(0, 12)}${String(index + 1).padStart(3, '0')}`;
}

/**
 * A demonstration address on example.com, which is reserved by RFC 2606 and
 * can never receive mail — seeding must not put a real inbox at risk.
 *
 * Two students are left without one on purpose, so the username fallback and
 * the "no email" filter both have something to show.
 */
function seedEmail(name: string, index: number): string | null {
  if (index === 7 || index === 15) return null;
  const [first, last] = name.toLowerCase().normalize('NFKD').replace(/[^a-z ]/g, '').split(' ');
  return `${first}.${last}${String(index + 1).padStart(3, '0')}@example.com`;
}

/**
 * Every existing auth user, by lowercased email.
 *
 * Loaded once. Asking the auth API "does this user exist?" per student was
 * a round trip each, and on a slow link those add up to minutes and a lot
 * of chances to fail.
 */
let authUsersByEmail: Map<string, string> | null = null;

async function loadAuthUsers(): Promise<Map<string, string>> {
  if (authUsersByEmail) return authUsersByEmail;

  const map = new Map<string, string>();
  // The admin API pages; a teaching academy will not exceed a few pages.
  for (let page = 1; page <= 20; page += 1) {
    const users = await call(`list existing accounts (page ${page})`, async () => {
      const result = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      return { data: result.data?.users ?? null, error: result.error };
    });

    for (const user of users) {
      if (user.email) map.set(user.email.toLowerCase(), user.id);
    }
    if (users.length < 200) break;
  }

  authUsersByEmail = map;
  return map;
}

/**
 * Creates the auth account, or resets the password of one that already
 * exists so the documented demo credentials always work after a re-seed.
 */
async function upsertAuthUser(email: string, password: string, role: 'teacher' | 'student', fullName: string) {
  const key = email.toLowerCase();
  const users = await loadAuthUsers();
  const existingId = users.get(key);

  if (existingId) {
    await call(`update the account for ${email}`, async () => {
      const result = await supabase.auth.admin.updateUserById(existingId, {
        password,
        app_metadata: { role },
      });
      return { data: result.data?.user ?? null, error: result.error };
    });
    return existingId;
  }

  const created = await call(`create the account for ${email}`, async () => {
    const result = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { full_name: fullName },
    });
    return { data: result.data?.user ?? null, error: result.error };
  });

  users.set(key, created.id);
  return created.id;
}

async function seedSyllabus() {
  type NodeRow = { id: string; name: string; parent_id: string | null };
  type NodeInsert = {
    parent_id: string | null;
    kind: 'unit' | 'topic' | 'subtopic';
    name: string;
    sort_order: number;
  };

  const existing = await call('read the existing syllabus', () =>
    supabase.from('syllabus_nodes').select('id, name, parent_id'),
  );

  // A node is identified by its name within its parent, which is exactly
  // the uniqueness the database enforces.
  const keyOf = (parentId: string | null, name: string) => `${parentId ?? 'root'}::${name}`;
  const idByKey = new Map<string, string>(
    ((existing ?? []) as NodeRow[]).map((node) => [keyOf(node.parent_id, node.name), node.id]),
  );

  async function insertLevel(label: string, rows: NodeInsert[]) {
    const missing = rows.filter((row) => !idByKey.has(keyOf(row.parent_id, row.name)));
    if (missing.length === 0) return;

    const inserted = await call(`insert ${missing.length} syllabus ${label}`, () =>
      supabase.from('syllabus_nodes').insert(missing).select('id, name, parent_id'),
    );

    for (const node of (inserted ?? []) as NodeRow[]) {
      idByKey.set(keyOf(node.parent_id, node.name), node.id);
    }
  }

  await insertLevel(
    'units',
    SYLLABUS.map((entry, index) => ({
      parent_id: null,
      kind: 'unit' as const,
      name: entry.unit,
      sort_order: (index + 1) * 10,
    })),
  );

  const topics: NodeInsert[] = [];
  for (const entry of SYLLABUS) {
    const unitId = idByKey.get(keyOf(null, entry.unit));
    if (!unitId) throw new Error(`Unit "${entry.unit}" was not created.`);
    entry.topics.forEach((topic, index) => {
      topics.push({ parent_id: unitId, kind: 'topic', name: topic.name, sort_order: (index + 1) * 10 });
    });
  }
  await insertLevel('topics', topics);

  const subtopics: NodeInsert[] = [];
  for (const entry of SYLLABUS) {
    const unitId = idByKey.get(keyOf(null, entry.unit))!;
    for (const topic of entry.topics) {
      const topicId = idByKey.get(keyOf(unitId, topic.name));
      if (!topicId) throw new Error(`Topic "${topic.name}" was not created.`);
      topic.subtopics.forEach((name, index) => {
        subtopics.push({ parent_id: topicId, kind: 'subtopic', name, sort_order: (index + 1) * 10 });
      });
    }
  }
  await insertLevel('subtopics', subtopics);

  console.log(`\u2713 Syllabus: ${SYLLABUS.length} units, ${topics.length} topics, ${subtopics.length} subtopics`);
}

// ---------------------------------------------------------------------
// Question bank
// ---------------------------------------------------------------------

const newId = () => crypto.randomUUID();

/** Turns the compact seed shape into the JSONB body the app stores. */
function toBody(body: SeedBody): Json {
  switch (body.kind) {
    case 'mcq': {
      const options = body.options.map((text) => ({ id: newId(), text, feedback: null }));
      return {
        kind: 'mcq',
        options,
        correctOptionId: options[body.correct].id,
        shuffleOptions: true,
      } as unknown as Json;
    }
    case 'multi': {
      const options = body.options.map((text) => ({ id: newId(), text, feedback: null }));
      return {
        kind: 'multi',
        options,
        correctOptionIds: body.correct.map((index) => options[index].id),
        shuffleOptions: true,
        partialCredit: true,
      } as unknown as Json;
    }
    case 'true_false':
      return { kind: 'true_false', correct: body.correct } as unknown as Json;
    case 'numerical':
      return {
        kind: 'numerical',
        answers: [
          {
            id: newId(),
            value: body.value,
            tolerance: body.relative
              ? { mode: 'relative', value: body.relative }
              : body.tolerance
                ? { mode: 'absolute', value: body.tolerance }
                : { mode: 'exact', value: '0' },
            significantFigures: body.sf ?? null,
            requireUnit: body.requireUnit ?? false,
            acceptedUnits: body.units ?? [],
            marks: null,
            note: null,
          },
        ],
      } as unknown as Json;
    case 'short_answer':
      return {
        kind: 'short_answer',
        normalizeWhitespace: true,
        answers: body.answers.map((text) => ({ id: newId(), text, caseSensitive: false })),
      } as unknown as Json;
    case 'essay':
      return {
        kind: 'essay',
        guidance: null,
        rubric: body.rubric,
        expectedWords: body.words ?? null,
      } as unknown as Json;
    case 'structured':
      return {
        kind: 'structured',
        parts: body.parts.map((part) => ({
          id: newId(),
          label: part.label,
          prompt: part.prompt,
          marks: part.marks,
          body: toBody(part.body),
          explanation: part.explanation ?? null,
          figures: [],
        })),
      } as unknown as Json;
  }
}

/**
 * Seeds the question bank.
 *
 * Existing codes are read once rather than checked one at a time, and every
 * write is retried on a dropped connection. A question still costs three
 * calls — insert the shell, insert version 1, point the shell at it —
 * because the second needs the id the first returns.
 */
async function seedQuestions(teacherId: string) {
  const nodes = await call('read the syllabus for question topics', () =>
    supabase.from('syllabus_nodes').select('id, name, kind, parent_id'),
  );

  const byId = new Map(nodes.map((node) => [node.id, node]));

  /**
   * Curly and straight apostrophes are the same word to a human, and the
   * syllabus and the question list were written separately — "Newton’s
   * Laws" must find "Newton's Laws".
   */
  const normalise = (name: string) => name.replace(/[\u2018\u2019\u02BC]/g, "'").trim().toLowerCase();

  // A question may be classified against a topic or, more precisely, a
  // subtopic. Both are offered in the app's picker, so both work here.
  const placements = new Map<string, { id: string; unitId: string | null }>();
  for (const node of nodes) {
    if (node.kind === 'unit') continue;

    // Walk up to the unit: a subtopic's parent is a topic, whose parent is
    // the unit that `questions.current_unit_id` filters on.
    let unitId: string | null = node.parent_id;
    for (let depth = 0; depth < 4 && unitId; depth += 1) {
      const parent = byId.get(unitId);
      if (!parent || parent.kind === 'unit') break;
      unitId = parent.parent_id;
    }

    placements.set(normalise(node.name), { id: node.id, unitId });
  }

  const existing = await call('read existing question codes', () =>
    supabase.from('questions').select('question_code'),
  );
  const taken = new Set((existing ?? []).map((row) => row.question_code.toUpperCase()));

  let created = 0;
  let skipped = 0;

  for (const question of SEED_QUESTIONS as SeedQuestion[]) {
    if (taken.has(question.code.toUpperCase())) {
      skipped += 1;
      continue;
    }

    const topic = placements.get(normalise(question.topic));
    if (!topic) {
      console.warn(`  ! ${question.code}: no syllabus topic named "${question.topic}" — skipped`);
      continue;
    }

    const row = await call<{ id: string }>(`create question ${question.code}`, () =>
      supabase
        .from('questions')
        .insert({ question_code: question.code, status: 'published', created_by: teacherId })
        .select('id')
        .single(),
    );

    try {
      const version = await call<{ id: string }>(`write content for ${question.code}`, () =>
        supabase
          .from('question_versions')
          .insert({
            question_id: row.id,
            version_number: 1,
            type: question.body.kind,
            title: question.title,
            stem: question.stem,
            body: toBody(question.body),
            marks: String(question.marks),
            difficulty: question.difficulty,
            estimated_seconds: question.seconds,
            syllabus_node_id: topic.id,
            unit_id: topic.unitId,
            source: question.year ? 'G.C.E. A/L Physics' : null,
            source_year: question.year ?? null,
            paper_reference: question.paper ?? null,
            explanation: question.explanation ?? null,
            solution: question.solution ?? null,
            common_mistake: question.commonMistake ?? null,
            hint: question.hint ?? null,
            figures: [] as unknown as Json,
            created_by: teacherId,
          })
          .select('id')
          .single(),
      );

      await call(`publish ${question.code}`, () =>
        supabase.from('questions').update({ current_version_id: version.id }).eq('id', row.id).select('id'),
      );
    } catch (error) {
      // A shell with no content would be a broken question that a re-run
      // would then skip as "already present". Remove it so a retry is clean.
      await supabase.from('questions').delete().eq('id', row.id);
      throw error;
    }

    if (question.tags.length > 0) {
      await call(`tag ${question.code}`, () =>
        supabase
          .from('question_tags')
          .upsert(
            question.tags.map((tag) => ({ question_id: row.id, tag })),
            { onConflict: 'question_id,tag' },
          )
          .select('tag'),
      );
    }

    created += 1;
  }

  console.log(`\u2713 Questions: ${SEED_QUESTIONS.length} (${created} new, ${skipped} already present)`);
}

async function main() {
  console.log('Seeding PHYSIX demo data…\n');

  // --- Teacher --------------------------------------------------------
  const teacherId = await upsertAuthUser(teacherEmail, teacherPassword!, 'teacher', 'A. Jayasuriya');
  await supabase
    .from('profiles')
    .update({ role: 'teacher', full_name: 'A. Jayasuriya', email: teacherEmail })
    .eq('id', teacherId);
  console.log(`✓ Teacher: ${teacherEmail}`);

  // --- Branding -------------------------------------------------------
  await supabase
    .from('app_settings')
    .update({ teacher_name: 'A. Jayasuriya', contact_email: teacherEmail })
    .eq('id', true);

  // --- Syllabus -------------------------------------------------------
  await seedSyllabus();

  // --- Batches --------------------------------------------------------
  const existingBatches = await call('read existing batches', () =>
    supabase.from('batches').select('id, code'),
  );
  const batchIdByCode = new Map(existingBatches.map((row) => [row.code, row.id]));

  const missingBatches = BATCHES.filter((batch) => !batchIdByCode.has(batch.code));
  if (missingBatches.length > 0) {
    const inserted = await call(`create ${missingBatches.length} batches`, () =>
      supabase.from('batches').insert(missingBatches).select('id, code'),
    );
    for (const row of inserted) batchIdByCode.set(row.code, row.id);
  }

  const batchIds = BATCHES.map((batch) => batchIdByCode.get(batch.code)!);
  console.log(`✓ Batches: ${batchIds.length}`);

  // --- Students -------------------------------------------------------
  // The first student gets a login account so there is a documented demo
  // student; the rest are records the teacher can issue credentials for,
  // which is what the roll looks like in practice.
  const existingStudents = await call('read existing students', () =>
    supabase.from('students').select('id, student_code'),
  );
  const studentIdByCode = new Map(existingStudents.map((row) => [row.student_code, row.id]));

  // Enrolments are collected and written in one call at the end rather than
  // two per student, which matters on a slow link.
  const memberships: { batch_id: string; student_id: string; left_at: null }[] = [];
  let created = 0;

  for (const [index, fullName] of STUDENT_NAMES.entries()) {
    const studentCode = `PHY-2026-${String(index + 1).padStart(3, '0')}`;
    const username = index === 0 ? 'student' : slugUsername(fullName, index);

    let studentId = studentIdByCode.get(studentCode);

    if (!studentId) {
      const inserted = await call<{ id: string }>(`create student ${studentCode}`, () =>
        supabase
          .from('students')
          .insert({
            student_code: studentCode,
            username,
            full_name: fullName,
            email: seedEmail(fullName, index),
            school: SCHOOLS[index % SCHOOLS.length],
            district: DISTRICTS[index % DISTRICTS.length],
            al_year: index < 16 ? 2026 : 2025,
            phone: `07${(index % 8) + 1}${String(1000000 + index * 7919).slice(0, 7)}`,
            guardian_name: `${fullName.split(' ')[1]} (guardian)`,
            status: index % 9 === 8 ? 'inactive' : 'active',
          })
          .select('id')
          .single(),
      );

      studentId = inserted.id;
      studentIdByCode.set(studentCode, studentId);
      created += 1;
    }

    // Demo student login. They have an email, so that is their sign-in
    // identity — the same path a real student with an inbox takes.
    if (index === 0) {
      const loginEmail = seedEmail(fullName, index) ?? `${username}@${domain}`;
      const profileId = await upsertAuthUser(loginEmail, studentPassword!, 'student', fullName);
      await call(`link the demo student account`, () =>
        supabase
          .from('students')
          .update({ profile_id: profileId, login_email: loginEmail })
          .eq('id', studentId!)
          .select('id'),
      );
    }

    memberships.push({
      batch_id: batchIds[index % (batchIds.length - 1)],
      student_id: studentId,
      left_at: null,
    });

    // A handful of students sit in the revision batch as well.
    if (index % 5 === 0) {
      memberships.push({
        batch_id: batchIds[batchIds.length - 1],
        student_id: studentId,
        left_at: null,
      });
    }
  }

  await call(`enrol ${memberships.length} students into batches`, () =>
    supabase
      .from('batch_members')
      .upsert(memberships, { onConflict: 'batch_id,student_id' })
      .select('batch_id'),
  );

  console.log(`✓ Students: ${STUDENT_NAMES.length} (${created} new)`);

  // --- Question bank --------------------------------------------------
  await seedQuestions(teacherId);

  console.log('\nDone. Sign in as:');
  console.log(`  Teacher  ${teacherEmail}`);
  console.log(`  Student  ${seedEmail(STUDENT_NAMES[0], 0)}`);
  console.log('\nTwo seeded students deliberately have no email address, so you can');
  console.log('see the username fallback and the "No email" filter in action.');
}

main().catch((error) => {
  console.error('\nSeed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
