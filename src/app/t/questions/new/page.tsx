import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { QuestionEditor } from '@/features/questions/components/question-editor';
import { listQuestionCodes, listQuestionTags, suggestQuestionCode } from '@/features/questions/queries';
import { emptyBody } from '@/features/questions/types';
import { flattenSyllabus, getSyllabusTree } from '@/features/syllabus/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'New question' };

export default async function NewQuestionPage() {
  await requireTeacher();

  const [codes, tree, tags] = await Promise.all([listQuestionCodes(), getSyllabusTree(), listQuestionTags()]);

  // Only topics and subtopics are offered: a question classified at unit
  // level is too coarse to drive topic analytics later.
  const syllabusOptions = flattenSyllabus(tree).filter((node) => node.kind !== 'unit');

  return (
    <>
      <PageHeader
        title="New question"
        description="Save it as a draft while you work. Publishing requires an answer the system can actually mark."
      />

      <QuestionEditor
        mode="create"
        status="draft"
        willCreateVersion={false}
        syllabusOptions={syllabusOptions}
        tagSuggestions={tags.map((tag) => tag.tag)}
        figureUrls={{}}
        initial={{
          question_code: suggestQuestionCode(codes),
          title: '',
          type: 'mcq',
          stem: '',
          body: emptyBody('mcq'),
          marks: 1,
          difficulty: 'medium',
          estimated_seconds: null,
          syllabus_node_id: null,
          source: null,
          source_year: null,
          paper_reference: null,
          explanation: null,
          solution: null,
          common_mistake: null,
          hint: null,
          teacher_notes: null,
          figures: [],
          tags: [],
        }}
      />
    </>
  );
}
