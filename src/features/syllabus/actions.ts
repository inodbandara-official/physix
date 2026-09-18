'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, formDataToObject, fromZodError, type ActionState } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { requireTeacher } from '@/lib/auth/session';
import { humanizeDatabaseError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { syllabusNodeSchema, updateSyllabusNodeSchema } from './schema';

const SYLLABUS_PATH = '/t/syllabus';

export async function createSyllabusNodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireTeacher();

  const parsed = syllabusNodeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();

  // New items go to the end of their sibling list.
  const siblings = supabase.from('syllabus_nodes').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const { data: last } = parsed.data.parent_id
    ? await siblings.eq('parent_id', parsed.data.parent_id)
    : await siblings.is('parent_id', null);

  const { error } = await supabase.from('syllabus_nodes').insert({
    kind: parsed.data.kind,
    parent_id: parsed.data.parent_id ?? null,
    name: parsed.data.name,
    code: parsed.data.code ?? null,
    description: parsed.data.description ?? null,
    sort_order: (last?.[0]?.sort_order ?? 0) + 10,
  });

  if (error) return actionError(humanizeDatabaseError(error, 'That item could not be added.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'syllabus.create',
    entityType: 'syllabus_node',
    summary: `Added ${parsed.data.kind} "${parsed.data.name}" to the syllabus.`,
  });

  revalidatePath(SYLLABUS_PATH);
  return actionSuccess(`${labelFor(parsed.data.kind)} added.`);
}

export async function updateSyllabusNodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireTeacher();

  const parsed = updateSyllabusNodeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { id, ...fields } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('syllabus_nodes')
    .update({ name: fields.name, code: fields.code ?? null, description: fields.description ?? null })
    .eq('id', id);

  if (error) return actionError(humanizeDatabaseError(error, 'That item could not be renamed.'));

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: 'syllabus.update',
    entityType: 'syllabus_node',
    entityId: id,
    summary: `Renamed a syllabus item to "${fields.name}".`,
  });

  revalidatePath(SYLLABUS_PATH);
  return actionSuccess('Saved.');
}

export async function archiveSyllabusNodeAction(nodeId: string, archived: boolean): Promise<ActionState> {
  const session = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  // Archiving hides a branch without deleting it, so questions written against
  // an old topic keep a valid reference.
  const { data, error } = await supabase
    .from('syllabus_nodes')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', nodeId)
    .select('name, kind')
    .single();

  if (error || !data) return actionError(humanizeDatabaseError(error, 'That item could not be archived.'));

  if (archived) {
    const descendants = await collectDescendants(nodeId);
    if (descendants.length > 0) {
      await supabase
        .from('syllabus_nodes')
        .update({ archived_at: new Date().toISOString() })
        .in('id', descendants);
    }
  }

  await recordAudit({
    actorId: session.userId,
    actorRole: 'teacher',
    action: archived ? 'syllabus.archive' : 'syllabus.restore',
    entityType: 'syllabus_node',
    entityId: nodeId,
    summary: `${archived ? 'Archived' : 'Restored'} ${data.kind} "${data.name}".`,
  });

  revalidatePath(SYLLABUS_PATH);
  return actionSuccess(archived ? `${labelFor(data.kind)} archived.` : `${labelFor(data.kind)} restored.`);
}

async function collectDescendants(rootId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('syllabus_nodes').select('id, parent_id');

  const childrenOf = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!row.parent_id) continue;
    const list = childrenOf.get(row.parent_id) ?? [];
    list.push(row.id);
    childrenOf.set(row.parent_id, list);
  }

  const out: string[] = [];
  const stack = [...(childrenOf.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return out;
}

/** Swaps sort_order with the adjacent sibling — enough for a syllabus of this size. */
export async function reorderSyllabusNodeAction(nodeId: string, direction: 'up' | 'down'): Promise<ActionState> {
  await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const { data: node } = await supabase
    .from('syllabus_nodes')
    .select('id, parent_id, sort_order')
    .eq('id', nodeId)
    .maybeSingle();

  if (!node) return actionError('That item could not be found.');

  const siblingQuery = supabase.from('syllabus_nodes').select('id, sort_order').is('archived_at', null).neq('id', nodeId);
  const { data: siblings } = node.parent_id
    ? await siblingQuery.eq('parent_id', node.parent_id)
    : await siblingQuery.is('parent_id', null);

  const ordered = (siblings ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const neighbour =
    direction === 'up'
      ? [...ordered].reverse().find((sibling) => sibling.sort_order < node.sort_order)
      : ordered.find((sibling) => sibling.sort_order > node.sort_order);

  if (!neighbour) return actionSuccess('Already at the end.');

  await supabase.from('syllabus_nodes').update({ sort_order: neighbour.sort_order }).eq('id', node.id);
  await supabase.from('syllabus_nodes').update({ sort_order: node.sort_order }).eq('id', neighbour.id);

  revalidatePath(SYLLABUS_PATH);
  return actionSuccess('Order updated.');
}

function labelFor(kind: string) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
