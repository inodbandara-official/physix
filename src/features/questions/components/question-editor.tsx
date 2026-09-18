'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AlertTriangle, Eye, Save, Send } from 'lucide-react';

import { Field } from '@/components/form/field';
import { FormAlert } from '@/components/form/form-alert';
import { SubmitButton } from '@/components/form/submit-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActionForm } from '@/lib/use-action-form';

import { createQuestionAction, updateQuestionAction } from '../actions';
import { effectiveMarks, publishIssues } from '../schema';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  QUESTION_TYPE_LABELS,
  emptyBody,
  type Figure,
  type QuestionBody,
  type SimpleQuestionBody,
} from '../types';
import { AnswerEditor } from './editors/answer-editors';
import { StructuredEditor } from './editors/structured-editor';
import { FigureUploader } from './figure-uploader';
import { MathField } from './math-field';
import { QuestionPreview } from './question-preview';
import { TagInput } from './tag-input';

export interface QuestionEditorValues {
  id?: string;
  question_code: string;
  title: string;
  type: QuestionBody['kind'];
  stem: string;
  body: QuestionBody;
  marks: number;
  difficulty: (typeof DIFFICULTY_ORDER)[number];
  estimated_seconds: number | null;
  syllabus_node_id: string | null;
  source: string | null;
  source_year: number | null;
  paper_reference: string | null;
  explanation: string | null;
  solution: string | null;
  common_mistake: string | null;
  hint: string | null;
  teacher_notes: string | null;
  figures: Figure[];
  tags: string[];
}

interface QuestionEditorProps {
  mode: 'create' | 'edit';
  initial: QuestionEditorValues;
  status: 'draft' | 'published' | 'archived';
  syllabusOptions: { id: string; label: string; kind: string }[];
  tagSuggestions: string[];
  figureUrls: Record<string, string>;
  /** True when saving will fork a new version rather than overwrite. */
  willCreateVersion: boolean;
}

const QUESTION_KINDS: QuestionBody['kind'][] = [
  'mcq',
  'multi',
  'true_false',
  'numerical',
  'short_answer',
  'structured',
  'essay',
];

export function QuestionEditor({
  mode,
  initial,
  status,
  syllabusOptions,
  tagSuggestions,
  figureUrls,
  willCreateVersion,
}: QuestionEditorProps) {
  const router = useRouter();
  const [values, setValues] = useState<QuestionEditorValues>(initial);
  const [publishing, setPublishing] = useState(false);

  const action = mode === 'create' ? createQuestionAction : updateQuestionAction;
  const { state, formAction } = useActionForm(action, {
    onSuccess: ({ data }) => data && router.push(`/t/questions/${data.id}`),
  });

  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  const set = <K extends keyof QuestionEditorValues>(key: K, value: QuestionEditorValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  // A structured question is worth the sum of its parts, so the marks field
  // becomes a read-out rather than an input.
  const marks = effectiveMarks(values.body, values.marks);

  const issues = useMemo(
    () =>
      publishIssues({
        type: values.type,
        stem: values.stem,
        marks,
        body: values.body,
        syllabus_node_id: values.syllabus_node_id ?? undefined,
      }),
    [values.type, values.stem, values.body, values.syllabus_node_id, marks],
  );

  const changeType = (kind: QuestionBody['kind']) => {
    // Switching type discards the old answer key, which cannot be carried
    // across meaningfully. The stem and metadata are kept.
    setValues((current) => ({ ...current, type: kind, body: emptyBody(kind) }));
  };

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="type" value={values.type} />
      <input type="hidden" name="body" value={JSON.stringify(values.body)} />
      <input type="hidden" name="figures" value={JSON.stringify(values.figures)} />
      <input type="hidden" name="tags" value={JSON.stringify(values.tags)} />
      <input type="hidden" name="marks" value={String(marks)} />
      <input type="hidden" name="publish" value={String(publishing)} />
      {values.syllabus_node_id ? (
        <input type="hidden" name="syllabus_node_id" value={values.syllabus_node_id} />
      ) : null}

      <FormAlert state={state} />

      {state.status === 'error' && errors?._form && errors._form.length > 1 ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden />
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {errors._form.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {willCreateVersion ? (
        <Alert>
          <AlertTriangle className="size-4" aria-hidden />
          <AlertDescription>
            This question is published. Saving a change that a student could notice creates a new
            version — results already recorded against the current one stay exactly as they are.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>The question</CardTitle>
              <CardDescription>
                Write maths between dollar signs: <code className="font-mono">$F = ma$</code> inline, or{' '}
                <code className="font-mono">$$v^2 = u^2 + 2as$$</code> on its own line.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="question_code" label="Question ID" errors={errors?.question_code} required>
                  <Input
                    id="question_code"
                    name="question_code"
                    value={values.question_code}
                    onChange={(event) => set('question_code', event.target.value)}
                    className="font-mono"
                    required
                  />
                </Field>

                <div className="space-y-2">
                  <Label htmlFor="question-type">Question type</Label>
                  <Select value={values.type} onValueChange={(kind) => changeType(kind as QuestionBody['kind'])}>
                    <SelectTrigger id="question-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {QUESTION_TYPE_LABELS[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Field name="title" label="Short title" hint="For your own searching. Students never see it.">
                <Input
                  id="title"
                  name="title"
                  value={values.title}
                  placeholder="Projectile launched at 30°"
                  onChange={(event) => set('title', event.target.value)}
                />
              </Field>

              <MathField
                label="Question text"
                name="stem"
                value={values.stem}
                rows={6}
                required
                errors={errors?.stem}
                placeholder={'A body of mass 2 kg moves at $5\\ \\text{m s}^{-1}$.\n\nCalculate its kinetic energy.'}
                onChange={(stem) => set('stem', stem)}
              />

              <FigureUploader
                figures={values.figures}
                figureUrls={figureUrls}
                onChange={(figures) => set('figures', figures)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Answer and marking</CardTitle>
              <CardDescription>How the system will decide whether a student is right.</CardDescription>
            </CardHeader>
            <CardContent>
              {values.body.kind === 'structured' ? (
                <StructuredEditor
                  body={values.body}
                  onChange={(body) => set('body', body)}
                />
              ) : (
                <AnswerEditor
                  body={values.body as SimpleQuestionBody}
                  onChange={(body) => set('body', body)}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>After the assessment</CardTitle>
              <CardDescription>
                Shown to students only where you enable explanations on the assessment itself.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="explanation">
                <TabsList>
                  <TabsTrigger value="explanation">Explanation</TabsTrigger>
                  <TabsTrigger value="solution">Worked solution</TabsTrigger>
                  <TabsTrigger value="coaching">Hint &amp; mistakes</TabsTrigger>
                  <TabsTrigger value="private">Private notes</TabsTrigger>
                </TabsList>

                <TabsContent value="explanation" className="pt-5">
                  <MathField
                    name="explanation"
                    value={values.explanation ?? ''}
                    rows={5}
                    placeholder="Kinetic energy is $E_k = \\tfrac{1}{2}mv^2$, so…"
                    onChange={(value) => set('explanation', value || null)}
                  />
                </TabsContent>

                <TabsContent value="solution" className="pt-5">
                  <MathField
                    name="solution"
                    value={values.solution ?? ''}
                    rows={8}
                    placeholder={'Formula:\n$$v^2 = u^2 + 2as$$\n\nSubstitute:\n$$v^2 = 0^2 + 2 \\times 9.8 \\times 20$$\n\nTherefore $v = 19.8\\ \\text{m s}^{-1}$.'}
                    onChange={(value) => set('solution', value || null)}
                  />
                </TabsContent>

                <TabsContent value="coaching" className="space-y-5 pt-5">
                  <MathField
                    label="Hint"
                    name="hint"
                    value={values.hint ?? ''}
                    rows={2}
                    placeholder="Which equation of motion has no time in it?"
                    onChange={(value) => set('hint', value || null)}
                  />
                  <MathField
                    label="Common mistake"
                    name="common_mistake"
                    value={values.common_mistake ?? ''}
                    rows={3}
                    placeholder="Forgetting to square the velocity."
                    onChange={(value) => set('common_mistake', value || null)}
                  />
                </TabsContent>

                <TabsContent value="private" className="pt-5">
                  <MathField
                    label="Teacher notes"
                    name="teacher_notes"
                    value={values.teacher_notes ?? ''}
                    rows={4}
                    hint="Never shown to students, in any mode."
                    placeholder="Used in the 2026 January unit test. Too easy for the revision batch."
                    onChange={(value) => set('teacher_notes', value || null)}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Classification</CardTitle>
              <CardDescription>What makes this question findable and countable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="syllabus-node">Syllabus topic</Label>
                <Select
                  value={values.syllabus_node_id ?? ''}
                  onValueChange={(value) => set('syllabus_node_id', value || null)}
                >
                  <SelectTrigger id="syllabus-node" className="w-full">
                    <SelectValue placeholder="Choose a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {syllabusOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {syllabusOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Your syllabus is empty. Add a unit first so questions can be classified.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select
                  value={values.difficulty}
                  onValueChange={(value) => set('difficulty', value as QuestionEditorValues['difficulty'])}
                >
                  <SelectTrigger id="difficulty" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_ORDER.map((level) => (
                      <SelectItem key={level} value={level}>
                        {DIFFICULTY_LABELS[level]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="difficulty" value={values.difficulty} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="marks-field">Marks</Label>
                  <Input
                    id="marks-field"
                    type="number"
                    min={0.5}
                    step="0.5"
                    value={marks}
                    disabled={values.body.kind === 'structured'}
                    onChange={(event) => set('marks', Number(event.target.value))}
                  />
                  {values.body.kind === 'structured' ? (
                    <p className="text-xs text-muted-foreground">Sum of the parts.</p>
                  ) : null}
                </div>

                <Field name="estimated_seconds" label="Time (seconds)" errors={errors?.estimated_seconds}>
                  <Input
                    id="estimated_seconds"
                    name="estimated_seconds"
                    type="number"
                    min={5}
                    max={7200}
                    value={values.estimated_seconds ?? ''}
                    placeholder="120"
                    onChange={(event) =>
                      set('estimated_seconds', event.target.value === '' ? null : Number(event.target.value))
                    }
                  />
                </Field>
              </div>

              <TagInput tags={values.tags} onChange={(tags) => set('tags', tags)} suggestions={tagSuggestions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source</CardTitle>
              <CardDescription>Where this question came from, for past-paper practice.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field name="source" label="Source" errors={errors?.source}>
                <Input
                  id="source"
                  name="source"
                  value={values.source ?? ''}
                  placeholder="G.C.E. A/L Physics"
                  onChange={(event) => set('source', event.target.value || null)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="source_year" label="Year" errors={errors?.source_year}>
                  <Input
                    id="source_year"
                    name="source_year"
                    type="number"
                    min={1950}
                    max={2100}
                    value={values.source_year ?? ''}
                    placeholder="2019"
                    onChange={(event) =>
                      set('source_year', event.target.value === '' ? null : Number(event.target.value))
                    }
                  />
                </Field>

                <Field name="paper_reference" label="Paper reference" errors={errors?.paper_reference}>
                  <Input
                    id="paper_reference"
                    name="paper_reference"
                    value={values.paper_reference ?? ''}
                    placeholder="Paper II, Q4"
                    onChange={(event) => set('paper_reference', event.target.value || null)}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Eye className="size-4" aria-hidden />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {values.stem.trim() === '' ? (
                <p className="text-sm text-muted-foreground">Write the question to see it here.</p>
              ) : (
                <QuestionPreview
                  stem={values.stem}
                  body={values.body}
                  marks={marks}
                  figures={values.figures}
                  figureUrls={new Map(Object.entries(figureUrls))}
                  revealAnswers
                />
              )}
            </CardContent>
          </Card>

          {issues.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Before publishing</CardTitle>
                <CardDescription>
                  A published question has to be able to mark an answer. You can still save a draft.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-5">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>

        <SubmitButton variant="outline" pendingLabel="Saving…" onClick={() => setPublishing(false)}>
          <Save className="size-4" aria-hidden />
          {status === 'published' ? 'Save changes' : 'Save draft'}
        </SubmitButton>

        {status !== 'published' ? (
          <SubmitButton
            pendingLabel="Publishing…"
            disabled={issues.length > 0}
            onClick={() => setPublishing(true)}
          >
            <Send className="size-4" aria-hidden />
            Publish
          </SubmitButton>
        ) : null}
      </div>
    </form>
  );
}
