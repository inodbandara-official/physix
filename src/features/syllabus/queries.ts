import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { buildTree, type SyllabusNode } from './tree';

export { buildTree, flattenSyllabus } from './tree';
export type { SyllabusNode } from './tree';

/**
 * The syllabus is small (tens of rows), so it is fetched flat in one query and
 * assembled into a tree in memory. No recursive CTE needed until it isn't.
 */
export async function getSyllabusTree(includeArchived = false): Promise<SyllabusNode[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('syllabus_nodes').select('*');
  if (!includeArchived) query = query.is('archived_at', null);

  const { data, error } = await query.order('sort_order').order('name');
  if (error) throw error;

  return buildTree(data ?? []);
}

export async function countSyllabus() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('syllabus_nodes').select('kind').is('archived_at', null);
  const rows = data ?? [];
  return {
    units: rows.filter((row) => row.kind === 'unit').length,
    topics: rows.filter((row) => row.kind === 'topic').length,
    subtopics: rows.filter((row) => row.kind === 'subtopic').length,
  };
}
