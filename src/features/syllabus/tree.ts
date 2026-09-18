import type { SyllabusNodeRow } from '@/types/database';

export interface SyllabusNode extends SyllabusNodeRow {
  children: SyllabusNode[];
}

/**
 * Pure tree helpers, kept free of any database import so they can be unit
 * tested directly and reused on the client.
 */
export function buildTree(rows: SyllabusNodeRow[]): SyllabusNode[] {
  const byId = new Map<string, SyllabusNode>();
  for (const row of rows) byId.set(row.id, { ...row, children: [] });

  const roots: SyllabusNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id) {
      const parent = byId.get(node.parent_id);
      if (parent) {
        parent.children.push(node);
        continue;
      }
      // Parent is archived (or otherwise absent) while the child is not.
      // Surfacing the orphan at the top level beats hiding it.
    }
    roots.push(node);
  }

  const sort = (nodes: SyllabusNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    for (const node of nodes) sort(node.children);
  };
  sort(roots);

  return roots;
}

/** Flattened "Mechanics › Motion › Equations of Motion" labels, for pickers. */
export function flattenSyllabus(
  nodes: SyllabusNode[],
  prefix = '',
): { id: string; label: string; kind: string }[] {
  const out: { id: string; label: string; kind: string }[] = [];
  for (const node of nodes) {
    const label = prefix ? `${prefix} › ${node.name}` : node.name;
    out.push({ id: node.id, label, kind: node.kind });
    out.push(...flattenSyllabus(node.children, label));
  }
  return out;
}
