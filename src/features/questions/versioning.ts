import type { QuestionStatus } from '@/types/database';

import type { QuestionBody } from './types';

/**
 * When an edit becomes a new version.
 *
 * The rule the teacher experiences:
 *
 * - A **draft** is a working document. Edits overwrite it, because nobody
 *   has ever seen it and a history of typo fixes is noise.
 * - A **published** question is a record. Any change a student could see
 *   creates version n+1; the old version stays exactly as it was, so a
 *   completed attempt still shows what was actually sat.
 *
 * Teacher-only fields (notes, tags, the internal hint) are not content:
 * changing them never forks a version.
 */

export interface VersionContent {
  type: string;
  title: string;
  stem: string;
  body: QuestionBody;
  marks: number;
  difficulty: string;
  estimated_seconds: number | null;
  syllabus_node_id: string | null;
  source: string | null;
  source_year: number | null;
  paper_reference: string | null;
  explanation: string | null;
  solution: string | null;
  common_mistake: string | null;
  hint: string | null;
  figures: unknown;
}

/**
 * A stable string for everything a student could notice.
 *
 * `JSON.stringify` alone would be order-sensitive, so keys are sorted
 * recursively: reordering a JSONB payload must not look like an edit.
 */
export function contentFingerprint(content: VersionContent): string {
  return stableStringify({
    type: content.type,
    title: content.title.trim(),
    stem: content.stem.trim(),
    body: content.body,
    marks: Number(content.marks),
    difficulty: content.difficulty,
    estimated_seconds: content.estimated_seconds ?? null,
    syllabus_node_id: content.syllabus_node_id ?? null,
    source: content.source ?? null,
    source_year: content.source_year ?? null,
    paper_reference: content.paper_reference ?? null,
    explanation: content.explanation ?? null,
    solution: content.solution ?? null,
    common_mistake: content.common_mistake ?? null,
    hint: content.hint ?? null,
    figures: content.figures ?? [],
  });
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);

  return `{${entries.join(',')}}`;
}

export function shouldCreateNewVersion(
  status: QuestionStatus,
  previous: VersionContent,
  next: VersionContent,
): boolean {
  if (status === 'draft') return false;
  return contentFingerprint(previous) !== contentFingerprint(next);
}
