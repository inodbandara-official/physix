import { describe, expect, it } from 'vitest';

import { buildTree, flattenSyllabus } from './tree';
import type { SyllabusNodeRow } from '@/types/database';

function node(partial: Partial<SyllabusNodeRow> & Pick<SyllabusNodeRow, 'id' | 'kind' | 'name'>): SyllabusNodeRow {
  return {
    parent_id: null,
    code: null,
    description: null,
    sort_order: 0,
    archived_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('buildTree', () => {
  it('nests topics under units and subtopics under topics', () => {
    const tree = buildTree([
      node({ id: 'u1', kind: 'unit', name: 'Mechanics' }),
      node({ id: 't1', kind: 'topic', name: 'Motion', parent_id: 'u1' }),
      node({ id: 's1', kind: 'subtopic', name: 'Equations of Motion', parent_id: 't1' }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].name).toBe('Motion');
    expect(tree[0].children[0].children[0].name).toBe('Equations of Motion');
  });

  it('orders siblings by sort_order, then by name', () => {
    const tree = buildTree([
      node({ id: 'b', kind: 'unit', name: 'Waves', sort_order: 20 }),
      node({ id: 'a', kind: 'unit', name: 'Mechanics', sort_order: 10 }),
      node({ id: 'c', kind: 'unit', name: 'Aardvark', sort_order: 20 }),
    ]);

    expect(tree.map((unit) => unit.name)).toEqual(['Mechanics', 'Aardvark', 'Waves']);
  });

  it('surfaces a node whose parent is missing rather than dropping it', () => {
    // Happens when a parent is archived and the child is not: the teacher must
    // still be able to see and fix the stray item.
    const tree = buildTree([node({ id: 't1', kind: 'topic', name: 'Orphan topic', parent_id: 'missing' })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Orphan topic');
  });

  it('returns an empty tree for no rows', () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe('flattenSyllabus', () => {
  it('produces breadcrumb labels for pickers', () => {
    const tree = buildTree([
      node({ id: 'u1', kind: 'unit', name: 'Mechanics' }),
      node({ id: 't1', kind: 'topic', name: 'Motion', parent_id: 'u1' }),
      node({ id: 's1', kind: 'subtopic', name: 'Projectiles', parent_id: 't1' }),
    ]);

    expect(flattenSyllabus(tree).map((item) => item.label)).toEqual([
      'Mechanics',
      'Mechanics › Motion',
      'Mechanics › Motion › Projectiles',
    ]);
  });
});
