import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/page-header';
import { TranslationEditor } from '@/features/questions/components/translation-editor';
import {
  collectFigurePaths,
  getQuestion,
  signFigureUrls,
} from '@/features/questions/queries';
import type { QuestionTranslations } from '@/features/questions/translation';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Translate question' };

export default async function TranslateQuestionPage(props: PageProps<'/t/questions/[id]/translate'>) {
  await requireTeacher();
  const { id } = await props.params;

  const detail = await getQuestion(id);
  if (!detail) notFound();

  const { question, current } = detail;
  const figureUrls = await signFigureUrls(collectFigurePaths(current));
  const translations = (current.translations ?? {}) as QuestionTranslations;

  return (
    <>
      <PageHeader
        title="Translate to Sinhala"
        description="English on the left, Sinhala on the right. Only the wording changes — the marking is shared."
      />

      <TranslationEditor
        questionId={question.id}
        questionCode={question.question_code}
        source={{
          title: current.title,
          stem: current.stem,
          explanation: current.explanation,
          solution: current.solution,
          hint: current.hint,
          common_mistake: current.common_mistake,
          body: current.body,
          figures: current.figures,
          marks: current.marks,
        }}
        initial={translations.si ?? { reviewed: false }}
        figureUrls={Object.fromEntries(figureUrls)}
      />
    </>
  );
}
