import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { MathText } from '@/components/math-text';
import { AttemptRunnerLoader } from '@/features/attempts/components/attempt-runner-loader';
import { Figures } from '@/features/attempts/components/figures';
import type { RunnerInput, RunnerQuestion } from '@/features/attempts/components/runner-types';
import { getRunnerData } from '@/features/attempts/queries';
import type { SheetInput } from '@/features/attempts/sheet';
import { LanguageToggle } from '@/features/language/components/language-toggle';
import { requireStudent } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Assessment' };

export default async function AttemptPage(props: PageProps<'/s/attempt/[id]'>) {
  const session = await requireStudent();
  const { id } = await props.params;
  const language = session.profile.language;

  const load = await getRunnerData(id, language);
  if (load.state === 'missing') notFound();
  if (load.state === 'finished') redirect(`/s/results/${id}`);

  const { data } = load;

  // Maths is rendered here, on the server. The browser receives finished
  // markup and never loads KaTeX for the test screen.
  const questions: RunnerQuestion[] = data.questions.map((question, index) => ({
    id: question.attemptQuestionId,
    number: index + 1,
    marks: question.marks,
    kind: question.kind,
    showingFallback: language !== 'en' && !question.translated,
    stem: <MathText>{question.stem}</MathText>,
    figures: <Figures figures={question.figures} urls={data.figureUrls} />,
    input: question.input ? toRunnerInput(question.input) : null,
    parts: question.parts.map((part) => ({
      id: part.id,
      label: part.label,
      marks: part.marks,
      prompt: <MathText inline>{part.prompt}</MathText>,
      figures: <Figures figures={part.figures} urls={data.figureUrls} />,
      input: toRunnerInput(part.input),
    })),
  }));

  return (
    <AttemptRunnerLoader
      attemptId={data.attemptId}
      assessmentId={data.assessmentId}
      title={data.title}
      exitHref={data.pastPaper ? '/s/past-papers' : `/s/assessments/${data.assessmentId}`}
      attemptNumber={data.attemptNumber}
      deadlineAt={data.deadlineAt}
      serverNow={data.serverNow}
      negativeMarking={data.negativeMarking}
      language={language}
      questions={questions}
      initialAnswers={data.answers}
      languageToggle={<LanguageToggle current={language} />}
    />
  );
}

function toRunnerInput(input: SheetInput): RunnerInput {
  switch (input.kind) {
    case 'mcq':
    case 'multi':
      return {
        kind: input.kind,
        options: input.options.map((option) => ({
          id: option.id,
          letter: option.letter,
          content: <MathText inline>{option.text}</MathText>,
        })),
      };
    case 'essay':
      return {
        kind: 'essay',
        guidance: input.guidance ? <MathText>{input.guidance}</MathText> : null,
        expectedWords: input.expectedWords,
      };
    default:
      return { kind: input.kind };
  }
}
