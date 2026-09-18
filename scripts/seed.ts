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

const supabase = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

async function upsertAuthUser(email: string, password: string, role: 'teacher' | 'student', fullName: string) {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name: fullName },
  });

  if (!error && created.user) return created.user.id;

  // Already exists: find it and reset the password so the documented demo
  // credentials always work after a re-seed.
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw new Error(`Could not create or find auth user ${email}: ${error?.message}`);

  await supabase.auth.admin.updateUserById(existing.id, { password, app_metadata: { role } });
  return existing.id;
}

async function seedSyllabus() {
  let unitOrder = 0;
  for (const entry of SYLLABUS) {
    unitOrder += 10;
    const unitId = await upsertNode(null, 'unit', entry.unit, unitOrder);

    let topicOrder = 0;
    for (const topic of entry.topics) {
      topicOrder += 10;
      const topicId = await upsertNode(unitId, 'topic', topic.name, topicOrder);

      let subOrder = 0;
      for (const subtopic of topic.subtopics) {
        subOrder += 10;
        await upsertNode(topicId, 'subtopic', subtopic, subOrder);
      }
    }
  }
  console.log(`✓ Syllabus: ${SYLLABUS.length} units`);
}

async function upsertNode(
  parentId: string | null,
  kind: 'unit' | 'topic' | 'subtopic',
  name: string,
  sortOrder: number,
): Promise<string> {
  const query = supabase.from('syllabus_nodes').select('id').eq('name', name).limit(1);
  const { data: existing } = parentId ? await query.eq('parent_id', parentId) : await query.is('parent_id', null);

  if (existing?.[0]) return existing[0].id;

  const { data, error } = await supabase
    .from('syllabus_nodes')
    .insert({ parent_id: parentId, kind, name, sort_order: sortOrder })
    .select('id')
    .single();

  if (error || !data) throw new Error(`Syllabus insert failed for ${name}: ${error?.message}`);
  return data.id;
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

async function seedQuestions(teacherId: string) {
  // Topic name -> { id, unitId }. Names are unique across the seeded syllabus.
  const { data: nodes } = await supabase.from('syllabus_nodes').select('id, name, kind, parent_id');
  const topics = new Map<string, { id: string; unitId: string | null }>();
  for (const node of nodes ?? []) {
    if (node.kind !== 'topic') continue;
    topics.set(node.name, { id: node.id, unitId: node.parent_id });
  }

  let created = 0;
  let skipped = 0;

  for (const question of SEED_QUESTIONS as SeedQuestion[]) {
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .eq('question_code', question.code)
      .maybeSingle();

    if (existing) {
      skipped += 1;
      continue;
    }

    const topic = topics.get(question.topic);
    if (!topic) {
      console.warn(`  ! ${question.code}: no syllabus topic named "${question.topic}" — skipped`);
      continue;
    }

    const { data: row, error } = await supabase
      .from('questions')
      .insert({ question_code: question.code, status: 'published', created_by: teacherId })
      .select('id')
      .single();

    if (error || !row) throw new Error(`Question insert failed for ${question.code}: ${error?.message}`);

    const { data: version, error: versionError } = await supabase
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
      .single();

    if (versionError || !version) {
      await supabase.from('questions').delete().eq('id', row.id);
      throw new Error(`Question version insert failed for ${question.code}: ${versionError?.message}`);
    }

    await supabase.from('questions').update({ current_version_id: version.id }).eq('id', row.id);

    if (question.tags.length > 0) {
      await supabase
        .from('question_tags')
        .upsert(
          question.tags.map((tag) => ({ question_id: row.id, tag })),
          { onConflict: 'question_id,tag' },
        );
    }

    created += 1;
  }

  console.log(`✓ Questions: ${SEED_QUESTIONS.length} (${created} new, ${skipped} already present)`);
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
  const batchIds: string[] = [];
  for (const batch of BATCHES) {
    const { data: existing } = await supabase.from('batches').select('id').eq('code', batch.code).maybeSingle();
    if (existing) {
      batchIds.push(existing.id);
      continue;
    }
    const { data, error } = await supabase.from('batches').insert(batch).select('id').single();
    if (error || !data) throw new Error(`Batch insert failed: ${error?.message}`);
    batchIds.push(data.id);
  }
  console.log(`✓ Batches: ${batchIds.length}`);

  // --- Students -------------------------------------------------------
  // The first student gets a login account so there is a documented demo
  // student; the rest are records the teacher can issue credentials for,
  // which is what the roll looks like in practice.
  let created = 0;
  for (const [index, fullName] of STUDENT_NAMES.entries()) {
    const studentCode = `PHY-2026-${String(index + 1).padStart(3, '0')}`;
    const username = index === 0 ? 'student' : slugUsername(fullName, index);

    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('student_code', studentCode)
      .maybeSingle();

    let studentId = existing?.id;

    if (!studentId) {
      const { data, error } = await supabase
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
        .single();

      if (error || !data) throw new Error(`Student insert failed for ${fullName}: ${error?.message}`);
      studentId = data.id;
      created += 1;
    }

    // Demo student login. They have an email, so that is their sign-in
    // identity — the same path a real student with an inbox takes.
    if (index === 0) {
      const loginEmail = seedEmail(fullName, index) ?? `${username}@${domain}`;
      const profileId = await upsertAuthUser(loginEmail, studentPassword!, 'student', fullName);
      await supabase
        .from('students')
        .update({ profile_id: profileId, login_email: loginEmail })
        .eq('id', studentId);
    }

    const batchId = batchIds[index % (batchIds.length - 1)];
    await supabase
      .from('batch_members')
      .upsert({ batch_id: batchId, student_id: studentId, left_at: null }, { onConflict: 'batch_id,student_id' });

    // A handful of students sit in the revision batch as well.
    if (index % 5 === 0) {
      await supabase
        .from('batch_members')
        .upsert(
          { batch_id: batchIds[batchIds.length - 1], student_id: studentId, left_at: null },
          { onConflict: 'batch_id,student_id' },
        );
    }
  }
  console.log(`✓ Students: ${STUDENT_NAMES.length} (${created} new)`);

  // --- Question bank --------------------------------------------------
  await seedQuestions(teacherId);

  console.log('\nDone. Sign in as:');
  console.log(`  Teacher  ${teacherEmail}`);
  console.log(`  Student  student  (login email: student@${domain})`);
}

main().catch((error) => {
  console.error('\nSeed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
