import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { PastPaperRow, QuestionRow } from '@/types/database';

export interface PaperQuestion {
  questionId: string;
  number: string;
  section: string | null;
  position: number;
  question: Pick<
    QuestionRow,
    'id' | 'question_code' | 'status' | 'archived_at' | 'current_title' | 'current_stem' | 'current_type' | 'current_marks' | 'current_node_id'
  > | null;
}

export interface PaperSummary extends PastPaperRow {
  questionCount: number;
  sections: string[];
  marks: number;
}

/** Papers newest first, with their question counts and the sections they use. */
export async function listPastPapers(publishedOnly: boolean): Promise<PaperSummary[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('past_papers').select('*');
  if (publishedOnly) query = query.eq('published', true);
  const { data: papers, error } = await query.order('year', { ascending: false }).order('title');
  if (error) throw error;
  if (!papers || papers.length === 0) return [];

  const { data: links } = await supabase
    .from('past_paper_questions')
    .select('paper_id, section, question_id, position')
    .in(
      'paper_id',
      papers.map((paper) => paper.id),
    )
    .order('position');

  // Marks need the question snapshot, which only the teacher may read.
  const marksById = new Map<string, number>();
  if (!publishedOnly && links && links.length > 0) {
    const { data: questions } = await supabase
      .from('questions')
      .select('id, current_marks')
      .in('id', [...new Set(links.map((link) => link.question_id))]);
    for (const row of questions ?? []) marksById.set(row.id, Number(row.current_marks ?? 0));
  }

  return papers.map((paper) => {
    const mine = (links ?? []).filter((link) => link.paper_id === paper.id);
    return {
      ...paper,
      questionCount: mine.length,
      sections: [...new Set(mine.map((link) => link.section).filter((section): section is string => Boolean(section)))],
      marks: Math.round(mine.reduce((sum, link) => sum + (marksById.get(link.question_id) ?? 0), 0) * 100) / 100,
    };
  });
}

export async function getPastPaper(id: string): Promise<{ paper: PastPaperRow; questions: PaperQuestion[] } | null> {
  const supabase = await createSupabaseServerClient();

  const { data: paper } = await supabase.from('past_papers').select('*').eq('id', id).maybeSingle();
  if (!paper) return null;

  const { data: links } = await supabase
    .from('past_paper_questions')
    .select('question_id, question_number, section, position')
    .eq('paper_id', id)
    .order('position')
    .order('created_at');

  const ids = (links ?? []).map((link) => link.question_id);
  const { data: questions } = ids.length
    ? await supabase
        .from('questions')
        .select('id, question_code, status, archived_at, current_title, current_stem, current_type, current_marks, current_node_id')
        .in('id', ids)
    : { data: [] };
  const byId = new Map((questions ?? []).map((question) => [question.id, question]));

  return {
    paper,
    questions: (links ?? []).map((link) => ({
      questionId: link.question_id,
      number: link.question_number,
      section: link.section,
      position: link.position,
      question: byId.get(link.question_id) ?? null,
    })),
  };
}

/** The one assessment that past-paper practice runs through. */
export async function getPastPaperBankId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('assessments').select('id').eq('past_paper_bank', true).maybeSingle();
  return data?.id ?? null;
}

/** Years that have at least one published paper, newest first. */
export function yearsOf(papers: Pick<PastPaperRow, 'year'>[]): number[] {
  return [...new Set(papers.map((paper) => paper.year))].sort((a, b) => b - a);
}
