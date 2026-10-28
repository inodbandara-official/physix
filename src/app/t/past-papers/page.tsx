import type { Metadata } from 'next';
import Link from 'next/link';
import { FileStack } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaperFormDialog } from '@/features/past-papers/components/paper-form-dialog';
import { getPastPaperBankId, listPastPapers } from '@/features/past-papers/queries';
import { requireTeacher } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Past papers' };

export default async function PastPapersPage() {
  await requireTeacher();
  const [papers, bankId] = await Promise.all([listPastPapers(false), getPastPaperBankId()]);

  // Practice activity, so the teacher can see whether papers are being used.
  const supabase = await createSupabaseServerClient();
  const [{ count: practiceCount }, { count: toMark }] = bankId
    ? await Promise.all([
        supabase.from('attempts').select('id', { count: 'exact', head: true }).eq('assessment_id', bankId),
        supabase
          .from('attempts')
          .select('id', { count: 'exact', head: true })
          .eq('assessment_id', bankId)
          .eq('status', 'submitted'),
      ])
    : [{ count: 0 }, { count: 0 }];

  return (
    <>
      <PageHeader
        title="Past papers"
        description="Real A/L papers, built from questions in your bank. Students practise a whole paper, a section, or a topic across years — marked by the same engine as your tests."
        actions={<PaperFormDialog />}
      />

      {bankId && (practiceCount ?? 0) > 0 ? (
        <p className="text-sm text-muted-foreground">
          Students have started {practiceCount} practice {practiceCount === 1 ? 'session' : 'sessions'}.{' '}
          <Link href={`/t/assessments/${bankId}/results`} className="font-medium text-primary hover:underline">
            See practice results{(toMark ?? 0) > 0 ? ` — ${toMark} waiting for your marks` : ''}
          </Link>
        </p>
      ) : null}

      {papers.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="No past papers yet"
          description="Create a paper for a year, then add its questions from your bank. Write any missing question in the bank first, with its source year set."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Paper</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="text-right">Marks</TableHead>
                <TableHead>Sections</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {papers.map((paper) => (
                <TableRow key={paper.id}>
                  <TableCell className="font-medium tabular-nums">{paper.year}</TableCell>
                  <TableCell>
                    <Link href={`/t/past-papers/${paper.id}`} className="font-medium hover:underline">
                      {paper.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{paper.questionCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{paper.marks}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{paper.sections.join(', ') || '—'}</TableCell>
                  <TableCell>{paper.published ? <Badge>Published</Badge> : <Badge variant="outline">Draft</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
