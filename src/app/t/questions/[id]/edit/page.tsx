import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/page-header';
import { QuestionEditor } from '@/features/questions/components/question-editor';
import {
  collectFigurePaths,
  getQuestion,
  listQuestionTags,
  signFigureUrls,
} from '@/features/questions/queries';
import { flattenSyllabus, getSyllabusTree } from '@/features/syllabus/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Edit question' };

export default async function EditQuestionPage(props: PageProps<'/t/questions/[id]/edit'>) {
  await requireTeacher();
  const { id } = await props.params;

  const [detail, tree, tags] = await Promise.all([getQuestion(id), getSyllabusTree(), listQuestionTags()]);
  if (!detail) notFound();

  const { question, current } = detail;
  const figureUrls = await signFigureUrls(collectFigurePaths(current));
  const syllabusOptions = flattenSyllabus(tree).filter((node) => node.kind !== 'unit');

  return (
    <>
      <PageHeader
        title={current.title || question.question_code}
        description={`Editing ${question.question_code}, currently version ${current.version_number}.`}
      />

      <QuestionEditor
        mode="edit"
        status={question.status}
        willCreateVersion={question.status !== 'draft'}
        syllabusOptions={syllabusOptions}
        tagSuggestions={tags.map((tag) => tag.tag)}
        figureUrls={Object.fromEntries(figureUrls)}
        initial={{
          id: question.id,
          question_code: question.question_code,
          title: current.title,
          type: current.type,
          stem: current.stem,
          body: current.body,
          marks: current.marks,
          difficulty: current.difficulty,
          estimated_seconds: current.estimated_seconds,
          syllabus_node_id: current.syllabus_node_id,
          source: current.source,
          source_year: current.source_year,
          paper_reference: current.paper_reference,
          explanation: current.explanation,
          solution: current.solution,
          common_mistake: current.common_mistake,
          hint: current.hint,
          teacher_notes: current.teacher_notes,
          figures: current.figures,
          tags: detail.tags,
        }}
      />
    </>
  );
}
