'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { requireTeacher } from '@/lib/auth/session';
import { humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import { nextCopyCode } from './codes';
import { createQuestionSchema, effectiveMarks, publishIssues, updateQuestionSchema, type QuestionInput } from './schema';
import type { QuestionBody } from './types';
import { shouldCreateNewVersion, type VersionContent } from './versioning';

function revalidateQuestions(questionId?: string) {
  revalidatePath('/t/questions');
  revalidatePath('/t/dashboard');
  if (questionId) revalidatePath(`/t/questions/${questionId}`);
}

/**
 * The editor posts `body`, `figures` and `tags` as JSON strings, because
 * they are deeply nested and a flat FormData cannot carry them faithfully.
 */
function readQuestionForm(formData: FormData): Record<string, unknown> {
  const raw = formDataToObject(formData);
  for (const key of ['body', 'figures', 'tags'] as const) {
    const value = formData.get(key);
    if (typeof value === 'string' && value !== '') {
      try {
        raw[key] = JSON.parse(value);
      } catch {
        raw[key] = undefined;
      }
    }
  }
  return raw;
}

/**
 * Walks up to the top-level unit a syllabus node belongs to, so questions
 * can be filtered by unit without a recursive query at read time.
 *
 * The whole tree is a few dozen rows, so it is fetched once and walked in
 * memory rather than issuing one query per level.
 */
async function resolveUnitId(nodeId: string | undefined): Promise<string | null> {
  if (!nodeId) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('syllabus_nodes').select('id, parent_id, kind');
  if (!data) return null;

  const byId = new Map(data.map((node) => [node.id, node]));

  let current = byId.get(nodeId);
  // Bounded so a malformed cycle cannot hang the request.
  for (let depth = 0; depth < 8 && current; depth += 1) {
    if (current.kind === 'unit') return current.id;
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return null;
}

function toVersionContent(input: QuestionInput): VersionContent {
  return {
    type: input.type,
    title: input.title,
    stem: input.stem,
    body: input.body,
    marks: effectiveMarks(input.body, input.marks),
    difficulty: input.difficulty,
    estimated_seconds: input.estimated_seconds ?? null,
    syllabus_node_id: input.syllabus_node_id ?? null,
    source: input.source ?? null,
    source_year: input.source_year ?? null,
    paper_reference: input.paper_reference ?? null,
    explanation: input.explanation ?? null,
    solution: input.solution ?? null,
    common_mistake: input.common_mistake ?? null,
    hint: input.hint ?? null,
    figures: input.figures,
  };
}

function versionInsert(
  questionId: string,
  versionNumber: number,
  content: VersionContent,
  unitId: string | null,
  teacherNotes: string | null,
  authorId: string,
) {
  return {
    question_id: questionId,
    version_number: versionNumber,
    type: content.type as QuestionInput['type'],
    title: content.title,
    stem: content.stem,
    body: content.body as unknown as Json,
    marks: String(content.marks),
    difficulty: content.difficulty as QuestionInput['difficulty'],
    estimated_seconds: content.estimated_seconds,
    syllabus_node_id: content.syllabus_node_id,
    unit_id: unitId,
    source: content.source,
    source_year: content.source_year,
    paper_reference: content.paper_reference,
    explanation: content.explanation,
    solution: content.solution,
    common_mistake: content.common_mistake,
    hint: content.hint,
    teacher_notes: teacherNotes,
    figures: content.figures as Json,
    created_by: authorId,
  };
}

export async function createQuestionAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  const session = await requireTeacher();

  const parsed = createQuestionSchema.safeParse(readQuestionForm(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const publish = formData.get('publish') === 'true';

  if (publish) {
    const issues = publishIssues(input);
    if (issues.length > 0) return actionError(issues[0], { _form: issues });
  }

  const supabase = await createSupabaseServerClient();
  const unitId = await resolveUnitId(input.syllabus_node_id);

  const { data: question, error } = await supabase
    .from('questions')
    .insert({
      question_code: input.question_code,
      status: publish ? 'published' : 'draft',
      created_by: session.userId,
    })
    .select('id')
    .single();

  if (error || !question) {
    return actionError(humanizeDatabaseError(error, 'The question could not be saved.'));
  }

  const content = toVersionContent(input);
  const { data: version, error: versionError } = await supabase
    .from('question_versions')
    .insert(versionInsert(question.id, 1, content, unitId, input.teacher_notes ?? null, session.userId))
    .select('id')
    .single();

  if (versionError || !version) {
    // Roll the shell back so a retry is not blocked by a duplicate code.
    await supabase.from('questions').delete().eq('id', question.id);
    return actionError(humanizeDatabaseError(versionError, 'The question content could not be saved.'));
  }

  await supabase.from('questions').update({ current_version_id: version.id }).eq('id', question.id);
  await syncTags(question.id, input.tags);

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'question.create',
    entityType: 'question',
    entityId: question.id,
    summary: `Created question ${input.question_code}${publish ? ' and published it' : ' as a draft'}.`,
    metadata: { type: input.type, status: publish ? 'published' : 'draft' },
  });

  revalidateQuestions(question.id);
  return actionSuccess(publish ? 'Question published.' : 'Draft saved.', { id: question.id });
}

/**
 * Saves an edit.
 *
 * A draft is overwritten in place. A published question gets a new version
 * whenever anything a student could see has changed — the previous version
 * is left untouched, which is what keeps completed attempts reproducible.
 */
export async function updateQuestionAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData,
): Promise<ActionState<{ id: string }>> {
  const session = await requireTeacher();

  const parsed = updateQuestionSchema.safeParse(readQuestionForm(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { id, ...input } = parsed.data;
  const publish = formData.get('publish') === 'true';
  const supabase = await createSupabaseServerClient();

  const { data: question } = await supabase
    .from('questions')
    .select('id, status, current_version_id, question_code')
    .eq('id', id)
    .maybeSingle();

  if (!question?.current_version_id) return actionError('That question could not be found.');

  const { data: currentVersion } = await supabase
    .from('question_versions')
    .select('*')
    .eq('id', question.current_version_id)
    .maybeSingle();

  if (!currentVersion) return actionError('That question has no content to edit.');

  const nextStatus = publish ? 'published' : question.status;
  if (nextStatus === 'published') {
    const issues = publishIssues(input);
    if (issues.length > 0) return actionError(issues[0], { _form: issues });
  }

  const unitId = await resolveUnitId(input.syllabus_node_id);
  const nextContent = toVersionContent(input);

  const previousContent: VersionContent = {
    type: currentVersion.type,
    title: currentVersion.title,
    stem: currentVersion.stem,
    body: currentVersion.body as unknown as QuestionBody,
    marks: Number(currentVersion.marks),
    difficulty: currentVersion.difficulty,
    estimated_seconds: currentVersion.estimated_seconds,
    syllabus_node_id: currentVersion.syllabus_node_id,
    source: currentVersion.source,
    source_year: currentVersion.source_year,
    paper_reference: currentVersion.paper_reference,
    explanation: currentVersion.explanation,
    solution: currentVersion.solution,
    common_mistake: currentVersion.common_mistake,
    hint: currentVersion.hint,
    figures: currentVersion.figures,
  };

  // A question being published for the first time keeps version 1: it has
  // no history worth preserving until it has actually been used.
  const fork =
    question.status !== 'draft' && shouldCreateNewVersion(question.status, previousContent, nextContent);

  if (fork) {
    const { data: version, error } = await supabase
      .from('question_versions')
      .insert(
        versionInsert(
          id,
          currentVersion.version_number + 1,
          nextContent,
          unitId,
          input.teacher_notes ?? null,
          session.userId,
        ),
      )
      .select('id, version_number')
      .single();

    if (error || !version) {
      return actionError(humanizeDatabaseError(error, 'The new version could not be saved.'));
    }

    const { error: pointerError } = await supabase
      .from('questions')
      .update({ current_version_id: version.id, status: nextStatus })
      .eq('id', id);

    if (pointerError) {
      return actionError(humanizeDatabaseError(pointerError, 'The new version could not be made current.'));
    }

    await syncTags(id, input.tags);
    await recordAudit({
      actorId: session.userId,
      actorRole: 'teacher',
      action: 'question.version',
      entityType: 'question',
      entityId: id,
      summary: `Created version ${version.version_number} of question ${question.question_code}.`,
      metadata: { version: version.version_number },
    });

    revalidateQuestions(id);
    return actionSuccess(`Saved as version ${version.version_number}. Past attempts are unchanged.`, { id });
  }

  const { error: updateError } = await supabase
    .from('question_versions')
    .update({
      ...versionInsert(id, currentVersion.version_number, nextContent, unitId, input.teacher_notes ?? null, session.userId),
      created_by: currentVersion.created_by,
    })
    .eq('id', currentVersion.id);

  if (updateError) {
    return actionError(humanizeDatabaseError(updateError, 'The changes could not be saved.'));
  }

  if (nextStatus !== question.status) {
    await supabase.from('questions').update({ status: nextStatus }).eq('id', id);
  }

  await syncTags(id, input.tags);
  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: publish ? 'question.publish' : 'question.update',
    entityType: 'question',
    entityId: id,
    summary: publish
      ? `Published question ${question.question_code}.`
      : `Updated question ${question.question_code}.`,
  });

  revalidateQuestions(id);
  return actionSuccess(publish ? 'Question published.' : 'Changes saved.', { id });
}

async function syncTags(questionId: string, tags: string[]): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const wanted = [...new Set(tags)];

  const { data: existing } = await supabase.from('question_tags').select('tag').eq('question_id', questionId);
  const current = new Set((existing ?? []).map((row) => row.tag));

  const toAdd = wanted.filter((tag) => !current.has(tag));
  const toRemove = [...current].filter((tag) => !wanted.includes(tag));

  if (toAdd.length > 0) {
    await supabase
      .from('question_tags')
      .upsert(toAdd.map((tag) => ({ question_id: questionId, tag })), { onConflict: 'question_id,tag' });
  }
  if (toRemove.length > 0) {
    await supabase.from('question_tags').delete().eq('question_id', questionId).in('tag', toRemove);
  }
}

export async function setQuestionStatusAction(
  questionId: string,
  status: 'draft' | 'published' | 'archived',
): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  if (status === 'published') {
    const { data: question } = await supabase
      .from('questions')
      .select('current_version_id')
      .eq('id', questionId)
      .maybeSingle();

    const { data: version } = question?.current_version_id
      ? await supabase
          .from('question_versions')
          .select('type, stem, marks, body, syllabus_node_id')
          .eq('id', question.current_version_id)
          .maybeSingle()
      : { data: null };

    if (!version) return actionError('That question could not be found.');

    const issues = publishIssues({
      type: version.type,
      stem: version.stem,
      marks: Number(version.marks),
      body: version.body as unknown as QuestionBody,
      syllabus_node_id: version.syllabus_node_id ?? undefined,
    });
    if (issues.length > 0) return actionError(issues[0], { _form: issues });
  }

  const { data, error } = await supabase
    .from('questions')
    .update({ status })
    .eq('id', questionId)
    .select('question_code')
    .single();

  if (error || !data) return actionError(humanizeDatabaseError(error, 'The status could not be changed.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'question.status',
    entityType: 'question',
    entityId: questionId,
    summary: `Set question ${data.question_code} to ${status}.`,
    metadata: { status },
  });

  revalidateQuestions(questionId);
  return actionSuccess(`Question marked ${status}.`);
}

export async function archiveQuestionAction(questionId: string, archived: boolean): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('questions')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', questionId)
    .select('question_code')
    .single();

  if (error || !data) return actionError(humanizeDatabaseError(error, 'The question could not be archived.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: archived ? 'question.archive' : 'question.restore',
    entityType: 'question',
    entityId: questionId,
    summary: `${archived ? 'Archived' : 'Restored'} question ${data.question_code}.`,
  });

  revalidateQuestions(questionId);
  return actionSuccess(archived ? 'Question archived.' : 'Question restored.');
}

/**
 * Copies a question as a fresh draft at version 1.
 *
 * The copy deliberately does not carry the original's version history: it
 * is a new question that happens to start from the same content.
 */
export async function duplicateQuestionAction(questionId: string): Promise<ActionState<{ id: string }>> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { data: question } = await supabase
    .from('questions')
    .select('question_code, current_version_id')
    .eq('id', questionId)
    .maybeSingle();

  if (!question?.current_version_id) return actionError('That question could not be found.');

  const { data: source } = await supabase
    .from('question_versions')
    .select('*')
    .eq('id', question.current_version_id)
    .maybeSingle();

  if (!source) return actionError('That question has no content to copy.');

  const { data: taken } = await supabase.from('questions').select('question_code').limit(5000);
  const code = nextCopyCode(
    question.question_code,
    (taken ?? []).map((row) => row.question_code),
  );

  const { data: copy, error } = await supabase
    .from('questions')
    .insert({ question_code: code, status: 'draft', created_by: session.userId })
    .select('id')
    .single();

  if (error || !copy) return actionError(humanizeDatabaseError(error, 'The question could not be duplicated.'));

  const { data: version, error: versionError } = await supabase
    .from('question_versions')
    .insert({
      question_id: copy.id,
      version_number: 1,
      type: source.type,
      title: source.title ? `${source.title} (copy)` : '',
      stem: source.stem,
      body: source.body,
      marks: source.marks,
      difficulty: source.difficulty,
      estimated_seconds: source.estimated_seconds,
      syllabus_node_id: source.syllabus_node_id,
      unit_id: source.unit_id,
      source: source.source,
      source_year: source.source_year,
      paper_reference: source.paper_reference,
      explanation: source.explanation,
      solution: source.solution,
      common_mistake: source.common_mistake,
      hint: source.hint,
      teacher_notes: source.teacher_notes,
      figures: source.figures,
      created_by: session.userId,
    })
    .select('id')
    .single();

  if (versionError || !version) {
    await supabase.from('questions').delete().eq('id', copy.id);
    return actionError(humanizeDatabaseError(versionError, 'The question could not be duplicated.'));
  }

  await supabase.from('questions').update({ current_version_id: version.id }).eq('id', copy.id);

  const { data: tags } = await supabase.from('question_tags').select('tag').eq('question_id', questionId);
  await syncTags(copy.id, (tags ?? []).map((row) => row.tag));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'question.duplicate',
    entityType: 'question',
    entityId: copy.id,
    summary: `Duplicated question ${question.question_code} as ${code}.`,
  });

  revalidateQuestions();
  return actionSuccess('Question duplicated as a draft.', { id: copy.id });
}

export async function bulkQuestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireTeacher();

  const ids = formData.getAll('question_ids[]').map(String).filter(Boolean);
  const operation = String(formData.get('operation') ?? '');

  if (ids.length === 0) return actionError('Select at least one question.');

  const handlers: Record<string, (id: string) => Promise<ActionState>> = {
    publish: (id) => setQuestionStatusAction(id, 'published'),
    draft: (id) => setQuestionStatusAction(id, 'draft'),
    archive: (id) => archiveQuestionAction(id, true),
    restore: (id) => archiveQuestionAction(id, false),
  };

  const handler = handlers[operation];
  if (!handler) return actionError('That bulk action is not available.');

  let succeeded = 0;
  const failures: string[] = [];
  for (const id of ids) {
    const result = await handler(id);
    if (result.status === 'error') failures.push(result.message);
    else succeeded += 1;
  }

  revalidateQuestions();

  if (succeeded === 0) return actionError(failures[0] ?? 'Nothing could be updated.');
  if (failures.length > 0) {
    return actionSuccess(`Updated ${succeeded} question(s). ${failures.length} could not be changed.`);
  }
  return actionSuccess(`Updated ${succeeded} question(s).`);
}

/** Uploads a figure and returns its storage path. The bucket is private. */
export async function uploadFigureAction(
  _prev: ActionState<{ path: string }>,
  formData: FormData,
): Promise<ActionState<{ path: string }>> {
  const session = await requireTeacher();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return actionError('Choose an image to upload.');
  if (file.size > 5 * 1024 * 1024) return actionError('Images must be 5 MB or smaller.');

  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return actionError('Use a PNG, JPEG, WebP, GIF or SVG image.');
  }

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from('question-figures')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return actionError('The image could not be uploaded. Try again.');

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'question.figure_upload',
    entityType: 'storage',
    entityId: path,
    summary: 'Uploaded a question figure.',
  });

  return actionSuccess('Image uploaded.', { path });
}
