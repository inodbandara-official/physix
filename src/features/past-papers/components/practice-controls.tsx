'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { t, tf } from '@/features/language/labels';
import { cn } from '@/lib/utils';
import type { ContentLanguage } from '@/types/database';

import { startPracticeAction } from '../actions';
import type { PracticeFilter } from '../schema';

function usePractice(language: ContentLanguage) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const start = (filter: PracticeFilter) =>
    startTransition(async () => {
      const result = await startPracticeAction(filter);
      if (result.status === 'success' && result.data) {
        if (result.data.closedPrevious) toast.info(t('previousHandedIn', language));
        router.push(`/s/attempt/${result.data.attemptId}`);
      } else if (result.status === 'error') {
        toast.error(result.message);
      }
    });

  return { start, isPending };
}

export function PracticeButton({
  filter,
  label,
  language,
  variant = 'default',
}: {
  filter: PracticeFilter;
  label: string;
  language: ContentLanguage;
  variant?: 'default' | 'outline' | 'secondary';
}) {
  const { start, isPending } = usePractice(language);
  return (
    <Button size="sm" variant={variant} disabled={isPending} onClick={() => start(filter)}>
      {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
      {label}
    </Button>
  );
}

/** "Every Circular Motion question from 2015 to 2020" — the cross-paper practice set. */
export function TopicPracticeForm({
  years,
  topics,
  language,
}: {
  years: number[];
  topics: { id: string; label: string; depth: number }[];
  language: ContentLanguage;
}) {
  const { start, isPending } = usePractice(language);
  const [chosenYears, setChosenYears] = useState<number[]>([]);
  const [topic, setTopic] = useState('');
  const [limit, setLimit] = useState('20');

  const selectClass =
    'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30';

  const submit = () => {
    const topicLabel = topics.find((item) => item.id === topic)?.label.trim();
    const yearLabel = chosenYears.length ? [...chosenYears].sort().join(', ') : t('allYears', language);
    start({
      node_id: topic || undefined,
      years: chosenYears.length ? chosenYears : undefined,
      limit: Number(limit),
      label: `${topicLabel ?? t('topicPractice', language)} · ${yearLabel}`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor="practice-topic">{t('topic', language)}</Label>
          <select id="practice-topic" value={topic} onChange={(event) => setTopic(event.target.value)} className={selectClass}>
            <option value="">{t('allTopics', language)}</option>
            {topics.map((item) => (
              <option key={item.id} value={item.id}>
                {`${'  '.repeat(item.depth)}${item.label}`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="practice-limit">{t('howMany', language)}</Label>
          <select id="practice-limit" value={limit} onChange={(event) => setLimit(event.target.value)} className={selectClass}>
            {['10', '20', '40'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {years.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('years', language)}</legend>
          <div className="flex flex-wrap gap-2">
            {years.map((year) => {
              const on = chosenYears.includes(year);
              return (
                <button
                  key={year}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChosenYears((current) => (on ? current.filter((item) => item !== year) : [...current, year]))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm tabular-nums transition-colors',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {year}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {chosenYears.length === 0 ? t('allYears', language) : tf('questionsCount', language, { n: limit })}
          </p>
        </fieldset>
      ) : null}

      <Button onClick={submit} disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
        {t('startPractice', language)}
      </Button>
    </div>
  );
}
