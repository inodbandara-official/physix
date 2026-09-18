import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { QuestionRow, QuestionVersionRow } from '@/types/database';

import type { QuestionFilters } from './schema';
import type { Figure, QuestionBody } from './types';

export { nextCopyCode, suggestQuestionCode } from './codes';

export interface QuestionListItem {
  id: string;
  question_code: string;
  status: QuestionRow['status'];
  archived_at: string | null;
  updated_at: string;
  version_number: number;
  version_id: string;
  type: QuestionVersionRow['type'];
  title: string;
  stem: string;
  marks: number;
  difficulty: QuestionVersionRow['difficulty'];
  syllabus_node_id: string | null;
  unit_id: string | null;
  source_year: number | null;
  tags: string[];
}

export interface QuestionPage {
  rows: QuestionListItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

/**
 * The question bank list.
 *
 * Reads the trigger-maintained `current_*` snapshot on `questions`, so the
 * bank always shows what a new assessment would actually use, and every
 * filter is a plain indexed predicate. Superseded versions are reachable
 * from the question page, never from search.
 */
export async function listQuestions(filters: QuestionFilters): Promise<QuestionPage> {
  const supabase = await createSupabaseServerClient();
  const from = (filters.page - 1) * filters.perPage;
  const to = from + filters.perPage - 1;

  let taggedIds: string[] | null = null;
  if (filters.tag) {
    const { data } = await supabase.from('question_tags').select('question_id').eq('tag', filters.tag);
    taggedIds = (data ?? []).map((row) => row.question_id);
    if (taggedIds.length === 0) {
      return { rows: [], total: 0, page: filters.page, perPage: filters.perPage, pageCount: 0 };
    }
  }

  let query = supabase.from('questions').select('*', { count: 'exact' }).not('current_version_id', 'is', null);

  if (filters.archived === 'active') query = query.is('archived_at', null);
  if (filters.archived === 'archived') query = query.not('archived_at', 'is', null);
  if (filters.status) query = query.eq('status', filters.status);
  if (taggedIds) query = query.in('id', taggedIds);
  if (filters.type) query = query.eq('current_type', filters.type);
  if (filters.difficulty) query = query.eq('current_difficulty', filters.difficulty);
  if (filters.unit) query = query.eq('current_unit_id', filters.unit);
  if (filters.node) query = query.eq('current_node_id', filters.node);
  if (filters.year) query = query.eq('current_year', filters.year);
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_]/g, '')}%`;
    query = query.or(`current_stem.ilike.${term},current_title.ilike.${term},question_code.ilike.${term}`);
  }

  const { data, count, error } = await query.order('updated_at', { ascending: false }).range(from, to);
  if (error) throw error;

  const questions = data ?? [];
  const tagsByQuestion = await loadTags(questions.map((row) => row.id));

  return {
    rows: questions.map((row) => toListItem(row, tagsByQuestion.get(row.id) ?? [])),
    total: count ?? 0,
    page: filters.page,
    perPage: filters.perPage,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / filters.perPage)),
  };
}

function toListItem(row: QuestionRow, tags: string[]): QuestionListItem {
  return {
    id: row.id,
    question_code: row.question_code,
    status: row.status,
    archived_at: row.archived_at,
    updated_at: row.updated_at,
    version_id: row.current_version_id ?? '',
    version_number: row.current_version_number ?? 1,
    type: row.current_type ?? 'mcq',
    title: row.current_title ?? '',
    stem: row.current_stem ?? '',
    marks: Number(row.current_marks ?? 0),
    difficulty: row.current_difficulty ?? 'medium',
    syllabus_node_id: row.current_node_id,
    unit_id: row.current_unit_id,
    source_year: row.current_year,
    tags,
  };
}

async function loadTags(questionIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (questionIds.length === 0) return map;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('question_tags').select('question_id, tag').in('question_id', questionIds);

  for (const row of data ?? []) {
    map.set(row.question_id, [...(map.get(row.question_id) ?? []), row.tag]);
  }
  for (const tags of map.values()) tags.sort();
  return map;
}

export interface QuestionVersionDetail extends Omit<QuestionVersionRow, 'marks' | 'body' | 'figures'> {
  marks: number;
  body: QuestionBody;
  figures: Figure[];
}

export interface QuestionDetail {
  question: QuestionRow;
  current: QuestionVersionDetail;
  /** Every version, newest first. Superseded versions are read-only. */
  versions: Pick<QuestionVersionRow, 'id' | 'version_number' | 'created_at' | 'type'>[];
  tags: string[];
}

export async function getQuestion(id: string): Promise<QuestionDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: question } = await supabase.from('questions').select('*').eq('id', id).maybeSingle();
  if (!question?.current_version_id) return null;

  const [{ data: current }, { data: versions }, { data: tags }] = await Promise.all([
    supabase.from('question_versions').select('*').eq('id', question.current_version_id).maybeSingle(),
    supabase
      .from('question_versions')
      .select('id, version_number, created_at, type')
      .eq('question_id', id)
      .order('version_number', { ascending: false }),
    supabase.from('question_tags').select('tag').eq('question_id', id).order('tag'),
  ]);

  if (!current) return null;

  return {
    question,
    current: toVersionDetail(current),
    versions: versions ?? [],
    tags: (tags ?? []).map((row) => row.tag),
  };
}

/** A specific historical version, for reviewing what a past attempt showed. */
export async function getQuestionVersion(versionId: string): Promise<QuestionVersionDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('question_versions').select('*').eq('id', versionId).maybeSingle();
  return data ? toVersionDetail(data) : null;
}

export function toVersionDetail(row: QuestionVersionRow): QuestionVersionDetail {
  return {
    ...row,
    marks: Number(row.marks),
    body: row.body as unknown as QuestionBody,
    figures: (row.figures ?? []) as unknown as Figure[],
  };
}

export async function listQuestionTags(): Promise<{ tag: string; count: number }[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('question_tags').select('tag');

  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export async function countQuestions() {
  const supabase = await createSupabaseServerClient();
  const [all, published, drafts] = await Promise.all([
    supabase.from('questions').select('id', { count: 'exact', head: true }).is('archived_at', null),
    supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .eq('status', 'published'),
    supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .eq('status', 'draft'),
  ]);

  return { total: all.count ?? 0, published: published.count ?? 0, drafts: drafts.count ?? 0 };
}

/** Existing codes, used only to suggest the next free question ID. */
export async function listQuestionCodes(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('questions').select('question_code').limit(5000);
  return (data ?? []).map((row) => row.question_code);
}


/**
 * Signed URLs for figures. The bucket is private, so nothing is readable
 * by guessing a path; links live for an hour, which outlasts any page view
 * without leaving a durable public URL behind.
 */
export async function signFigureUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return map;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from('question-figures').createSignedUrls(unique, 3600);
  if (error) return map;

  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

/** Every figure path referenced by a version, including those inside parts. */
export function collectFigurePaths(version: QuestionVersionDetail): string[] {
  const paths = version.figures.map((figure) => figure.path);
  if (version.body.kind === 'structured') {
    for (const part of version.body.parts) {
      paths.push(...part.figures.map((figure) => figure.path));
    }
  }
  return paths;
}
