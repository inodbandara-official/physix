'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, CloudOff, Flag, Loader2, LogOut, Check, Send } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { t, tf, marksLabel } from '@/features/language/labels';
import type { QuestionResponse, SimpleResponse } from '@/features/questions/marking/mark-question';
import { formatCountdown } from '@/lib/time';
import { cn } from '@/lib/utils';

import { saveAnswersAction, submitAttemptAction } from '../actions';
import { isAnswered } from '../response';
import { AnswerInput } from './answer-inputs';
import type { RunnerProps, RunnerQuestion } from './runner-types';

type SaveState = 'saved' | 'saving' | 'offline' | 'retrying';

interface LocalCopy {
  responses: Record<string, QuestionResponse | null>;
  flagged: Record<string, boolean>;
  visited: string[];
  /** Question ids changed on this device and not yet confirmed by the server. */
  pending: string[];
  /**
   * When each answer last changed here, on the server's clock. Decides
   * which copy wins on reload: a save can be confirmed on this device yet
   * not visible to the page that loads next, and the newer copy must not
   * lose to the older one.
   */
  changedAt?: Record<string, number>;
}

const SAVE_DEBOUNCE_MS = 800;
const RETRY_MS = 5000;

function storageKey(attemptId: string) {
  return `physix:attempt:${attemptId}`;
}

function readLocal(attemptId: string): LocalCopy | null {
  try {
    const raw = window.localStorage.getItem(storageKey(attemptId));
    return raw ? (JSON.parse(raw) as LocalCopy) : null;
  } catch {
    return null;
  }
}

function writeLocal(attemptId: string, copy: LocalCopy) {
  try {
    window.localStorage.setItem(storageKey(attemptId), JSON.stringify(copy));
  } catch {
    // Storage full or blocked (private mode). The server copy still works;
    // only the offline fallback is lost.
  }
}

function clearLocal(attemptId: string) {
  try {
    window.localStorage.removeItem(storageKey(attemptId));
  } catch {
    // Nothing to do.
  }
}

/**
 * The test screen.
 *
 * Rendered only in the browser (see attempt-runner-loader), so it can read
 * the device's unsaved answers straight into its initial state.
 *
 * Saving works like this: every change is applied locally at once, written
 * to localStorage, and queued. A debounced flush sends the queue to the
 * server; anything the server has not confirmed stays queued and is
 * retried, including after a reload. Submitting sends whatever is still
 * queued along with the hand-in, so going offline for a moment near the end
 * costs nothing.
 */
export function AttemptRunner(props: RunnerProps) {
  const { attemptId, questions, language } = props;
  const router = useRouter();

  // Server time minus device time, so timestamps stored here compare
  // fairly with the server's.
  const [skew] = useState(() => new Date(props.serverNow).getTime() - Date.now());

  // --- initial state: server answers, overlaid with newer local ones -------
  const [initial] = useState(() => {
    const responses: Record<string, QuestionResponse | null> = {};
    const flagged: Record<string, boolean> = {};
    for (const [id, answer] of Object.entries(props.initialAnswers)) {
      responses[id] = answer.response;
      flagged[id] = answer.flagged;
    }

    const local = readLocal(attemptId);
    const known = new Set(questions.map((question) => question.id));
    const localPending = new Set(local?.pending ?? []);
    const changedAt = { ...(local?.changedAt ?? {}) };
    const pending: string[] = [];

    for (const id of Object.keys(local?.responses ?? {})) {
      if (!known.has(id)) continue;
      const serverTime = props.initialAnswers[id] ? new Date(props.initialAnswers[id].updatedAt).getTime() : -Infinity;
      const localTime = changedAt[id] ?? (localPending.has(id) ? Infinity : -Infinity);
      // The device's copy is newer than anything the server has shown us:
      // keep it, and send it again. Re-sending an answer is harmless.
      if (localTime > serverTime) {
        responses[id] = local?.responses[id] ?? null;
        flagged[id] = local?.flagged[id] ?? false;
        pending.push(id);
      }
    }

    const visited = new Set((local?.visited ?? []).filter((id) => known.has(id)));
    if (questions[0]) visited.add(questions[0].id);
    for (const id of Object.keys(props.initialAnswers)) visited.add(id);

    return { responses, flagged, visited, pending, changedAt };
  });

  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState(initial.responses);
  const [flagged, setFlagged] = useState(initial.flagged);
  const [visited, setVisited] = useState(initial.visited);
  const [saveState, setSaveState] = useState<SaveState>(initial.pending.length > 0 ? 'saving' : 'saved');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  // Refs mirror state for the save loop, which must always send the latest.
  const responsesRef = useRef(initial.responses);
  const flaggedRef = useRef(initial.flagged);
  const visitedRef = useRef(initial.visited);
  const pendingRef = useRef(new Map<string, number>(initial.pending.map((id) => [id, 1])));
  const versionRef = useRef(1);
  const inFlightRef = useRef(false);
  const againRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  const changedAtRef = useRef<Record<string, number>>(initial.changedAt);

  // --- clock ----------------------------------------------------------------
  const deadline = props.deadlineAt ? new Date(props.deadlineAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  const remaining = deadline === null ? null : Math.max(0, (deadline - (now + skew)) / 1000);

  const persist = useCallback(() => {
    writeLocal(attemptId, {
      responses: responsesRef.current,
      flagged: flaggedRef.current,
      visited: [...visitedRef.current],
      pending: [...pendingRef.current.keys()],
      changedAt: changedAtRef.current,
    });
  }, [attemptId]);

  const entriesFor = useCallback(
    (ids: string[]) =>
      ids.map((id) => ({
        attemptQuestionId: id,
        response: responsesRef.current[id] ?? null,
        flagged: flaggedRef.current[id] ?? false,
      })),
    [],
  );

  // One timer for both the debounce and the retry, so they never stack.
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const schedule = useCallback((delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushRef.current();
    }, delay);
  }, []);

  // --- submit -------------------------------------------------------------
  const submitRef = useRef<(automatic: boolean) => Promise<void>>(async () => {});
  const submit = useCallback(
    async (automatic: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setSubmitting(true);
      setConfirmOpen(false);
      if (timerRef.current) clearTimeout(timerRef.current);

      try {
        const result = await submitAttemptAction({
          attemptId,
          entries: entriesFor([...pendingRef.current.keys()]),
        });

        if (result.status === 'success') {
          clearLocal(attemptId);
          router.replace(`/s/results/${attemptId}`);
          return;
        }
        if (result.status === 'error') toast.error(result.message);
      } catch {
        toast.error(t('offline', language));
      }

      // Still ours to hand in. An automatic submit keeps trying; a manual
      // one hands control back to the student.
      finishedRef.current = false;
      setSubmitting(false);
      if (automatic) setTimeout(() => void submitRef.current(true), RETRY_MS);
    },
    [attemptId, entriesFor, language, router],
  );

  // --- autosave -----------------------------------------------------------
  const flush = useCallback(async () => {
    if (finishedRef.current) return;
    if (inFlightRef.current) {
      againRef.current = true;
      return;
    }

    const snapshot = new Map(pendingRef.current);
    if (snapshot.size === 0) {
      setSaveState('saved');
      return;
    }

    inFlightRef.current = true;
    setSaveState('saving');

    try {
      const result = await saveAnswersAction({ attemptId, entries: entriesFor([...snapshot.keys()]) });

      if (result.status === 'success') {
        // Only clear what has not changed again while the save was in flight.
        for (const [id, version] of snapshot) {
          if (pendingRef.current.get(id) === version) pendingRef.current.delete(id);
        }
        persist();
        setSaveState(pendingRef.current.size === 0 ? 'saved' : 'saving');
      } else {
        // Refused: almost always the deadline. Hand in what the server has.
        setSaveState('retrying');
        if (result.status === 'error') toast.error(result.message);
        void submit(true);
      }
    } catch {
      setSaveState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'retrying');
      inFlightRef.current = false;
      againRef.current = false;
      schedule(RETRY_MS);
      return;
    }

    inFlightRef.current = false;
    // Something changed while that save was in flight: send it too.
    if (againRef.current || (pendingRef.current.size > 0 && !timerRef.current)) {
      againRef.current = false;
      schedule(SAVE_DEBOUNCE_MS);
    }
  }, [attemptId, entriesFor, persist, schedule, submit]);

  useEffect(() => {
    flushRef.current = flush;
    submitRef.current = submit;
  }, [flush, submit]);

  const scheduleFlush = useCallback(() => schedule(SAVE_DEBOUNCE_MS), [schedule]);

  const markPending = (id: string) => {
    changedAtRef.current = { ...changedAtRef.current, [id]: Date.now() + skew };
    versionRef.current += 1;
    pendingRef.current.set(id, versionRef.current);
    persist();
    setSaveState('saving');
    scheduleFlush();
  };

  const setResponse = (id: string, response: QuestionResponse | null) => {
    responsesRef.current = { ...responsesRef.current, [id]: response };
    setResponses(responsesRef.current);
    markPending(id);
  };

  const toggleFlag = (id: string) => {
    flaggedRef.current = { ...flaggedRef.current, [id]: !flaggedRef.current[id] };
    setFlagged(flaggedRef.current);
    markPending(id);
  };

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(questions.length - 1, next));
    setIndex(clamped);
    const id = questions[clamped]?.id;
    if (id && !visitedRef.current.has(id)) {
      visitedRef.current = new Set(visitedRef.current).add(id);
      setVisited(visitedRef.current);
      persist();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- effects: subscriptions only ------------------------------------------

  // Unsent answers from an earlier visit go up as soon as the page opens.
  useEffect(() => {
    if (pendingRef.current.size > 0) scheduleFlush();
  }, [scheduleFlush]);

  // Back online, or the tab is being hidden (a phone locking): save now.
  useEffect(() => {
    const onOnline = () => void flush();
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [flush]);

  // Leaving an active attempt asks first (§17).
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (finishedRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // The clock: warnings at five minutes and one, then an automatic submit.
  const warnedRef = useRef({ five: false, one: false });
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const left = (deadline - (current + skew)) / 1000;

      if (left <= 300 && left > 60 && !warnedRef.current.five) {
        warnedRef.current.five = true;
        toast.warning(t('fiveMinutesLeft', language));
      }
      if (left <= 60 && left > 0 && !warnedRef.current.one) {
        warnedRef.current.one = true;
        toast.warning(t('oneMinuteLeft', language));
      }
      if (left <= 0 && !finishedRef.current) {
        toast.info(t('timeUp', language));
        void submit(true);
      }
    };
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [deadline, skew, language, submit]);

  // --- render -----------------------------------------------------------
  const question = questions[index];
  if (!question) return null;

  const answeredCount = questions.filter((item) => isAnswered(responses[item.id])).length;
  const flaggedCount = questions.filter((item) => flagged[item.id]).length;
  const lowTime = remaining !== null && remaining <= 300;

  return (
    <div className="flex min-h-svh flex-col" lang={language}>
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold sm:text-base">{props.title}</p>
            <SaveIndicator state={saveState} language={language} />
          </div>

          {remaining !== null ? (
            <div
              role="timer"
              aria-live="off"
              aria-label={t('timeRemaining', language)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums',
                lowTime && 'border-destructive/50 bg-destructive/10 text-destructive',
              )}
            >
              <Clock className="size-4" aria-hidden />
              {formatCountdown(remaining)}
            </div>
          ) : null}

          {props.languageToggle}

          <Button
            variant="ghost"
            size="icon"
            aria-label={t('leave', language)}
            onClick={() => setLeaveOpen(true)}
            disabled={submitting}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_18rem]">
        <section aria-labelledby="question-heading" className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 id="question-heading" className="text-sm font-medium text-muted-foreground">
              {tf('questionOf', language, { n: index + 1, total: questions.length })}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-normal tabular-nums">
                {marksLabel(question.marks, language)}
              </Badge>
              <Button
                variant={flagged[question.id] ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={Boolean(flagged[question.id])}
                onClick={() => toggleFlag(question.id)}
                disabled={submitting}
              >
                <Flag className={cn('size-4', flagged[question.id] && 'fill-amber-500 text-amber-500')} aria-hidden />
                {flagged[question.id] ? t('unflag', language) : t('flag', language)}
              </Button>
            </div>
          </div>

          <QuestionBlock
            key={question.id}
            question={question}
            response={responses[question.id] ?? null}
            onChange={(response) => setResponse(question.id, response)}
            language={language}
            disabled={submitting}
          />

          <div className="flex items-center justify-between gap-3 border-t pt-5">
            <Button variant="outline" onClick={() => goTo(index - 1)} disabled={index === 0}>
              <ChevronLeft className="size-4" aria-hidden />
              {t('previous', language)}
            </Button>
            {index < questions.length - 1 ? (
              <Button onClick={() => goTo(index + 1)}>
                {t('next', language)}
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
                <Send className="size-4" aria-hidden />
                {t('submit', language)}
              </Button>
            )}
          </div>
        </section>

        <aside aria-label={t('questionMap', language)} className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border bg-background p-4">
            <p className="mb-3 text-sm font-medium">{t('questionMap', language)}</p>
            <ol className="grid grid-cols-6 gap-2 sm:grid-cols-10 lg:grid-cols-5">
              {questions.map((item, itemIndex) => (
                <li key={item.id}>
                  <MapButton
                    number={itemIndex + 1}
                    current={itemIndex === index}
                    answered={isAnswered(responses[item.id])}
                    visited={visited.has(item.id)}
                    flagged={Boolean(flagged[item.id])}
                    language={language}
                    onClick={() => goTo(itemIndex)}
                  />
                </li>
              ))}
            </ol>
            <MapLegend language={language} />
          </div>

          <Button className="w-full" size="lg" onClick={() => setConfirmOpen(true)} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            {submitting ? t('submitting', language) : t('submit', language)}
          </Button>
        </aside>
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent lang={language}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('submitTitle', language)}</AlertDialogTitle>
            <AlertDialogDescription>
              {tf('submitBody', language, { answered: answeredCount, total: questions.length })}
              {flaggedCount > 0 ? ` ${tf('submitFlagged', language, { n: flaggedCount })}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('keepWorking', language)}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submit(false)}>{t('submit', language)}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent lang={language}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leaveTitle', language)}</AlertDialogTitle>
            <AlertDialogDescription>{t('leaveBody', language)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('stay', language)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await flush();
                // Leaving on purpose, answers saved: no browser prompt.
                finishedRef.current = true;
                router.push(`/s/assessments/${props.assessmentId}`);
              }}
            >
              {t('leave', language)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuestionBlock({
  question,
  response,
  onChange,
  language,
  disabled,
}: {
  question: RunnerQuestion;
  response: QuestionResponse | null;
  onChange: (response: QuestionResponse | null) => void;
  language: RunnerProps['language'];
  disabled: boolean;
}) {
  const parts = response?.kind === 'structured' ? response.parts : {};

  return (
    <article
      className="space-y-5 rounded-xl border bg-background p-5 sm:p-6"
      lang={question.showingFallback ? 'en' : language}
    >
      {question.showingFallback ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{t('showingEnglish', language)}</p>
      ) : null}

      <div className="text-base leading-relaxed">{question.stem}</div>
      {question.figures}

      {question.input ? (
        <AnswerInput
          name={question.id}
          input={question.input}
          value={response && response.kind !== 'structured' ? response : null}
          onChange={(value) => onChange(value)}
          language={language}
          disabled={disabled}
        />
      ) : null}

      {question.parts.length > 0 ? (
        <ol className="space-y-6">
          {question.parts.map((part) => (
            <li key={part.id} className="space-y-3 border-l-2 pl-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">
                  ({part.label}) <span className="font-normal">{part.prompt}</span>
                </p>
                <Badge variant="outline" className="shrink-0 font-normal tabular-nums">
                  {marksLabel(part.marks, language)}
                </Badge>
              </div>
              {part.figures}
              <AnswerInput
                name={`${question.id}-${part.id}`}
                input={part.input}
                value={parts[part.id] ?? null}
                onChange={(value) => {
                  const next: Record<string, SimpleResponse | undefined> = { ...parts, [part.id]: value ?? undefined };
                  if (value === null) delete next[part.id];
                  onChange(Object.keys(next).length > 0 ? { kind: 'structured', parts: next } : null);
                }}
                language={language}
                disabled={disabled}
              />
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}

function MapButton({
  number,
  current,
  answered,
  visited,
  flagged,
  language,
  onClick,
}: {
  number: number;
  current: boolean;
  answered: boolean;
  visited: boolean;
  flagged: boolean;
  language: RunnerProps['language'];
  onClick: () => void;
}) {
  const state = answered ? t('answered', language) : visited ? t('notAnswered', language) : t('notVisited', language);
  const label = `${number}: ${state}${flagged ? `, ${t('flagged', language)}` : ''}`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={current ? 'step' : undefined}
      className={cn(
        'relative flex aspect-square w-full items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        answered && 'border-primary bg-primary text-primary-foreground',
        !answered && visited && 'border-amber-500/60 bg-amber-500/10 text-amber-800 dark:text-amber-300',
        !answered && !visited && 'bg-muted/60 text-muted-foreground',
        current && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
      )}
    >
      {number}
      {flagged ? (
        <Flag className="absolute -top-1.5 -right-1.5 size-3.5 fill-amber-500 text-amber-600" aria-hidden />
      ) : null}
    </button>
  );
}

function MapLegend({ language }: { language: RunnerProps['language'] }) {
  const items = [
    { className: 'border-primary bg-primary', label: t('answered', language) },
    { className: 'border-amber-500/60 bg-amber-500/10', label: t('notAnswered', language) },
    { className: 'bg-muted/60', label: t('notVisited', language) },
  ];

  return (
    <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className={cn('size-3.5 rounded border', item.className)} aria-hidden />
          {item.label}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <Flag className="size-3.5 fill-amber-500 text-amber-600" aria-hidden />
        {t('flagged', language)}
      </li>
    </ul>
  );
}

function SaveIndicator({ state, language }: { state: SaveState; language: RunnerProps['language'] }) {
  const content = {
    saved: { icon: <Check className="size-3" aria-hidden />, text: t('saved', language), tone: 'text-muted-foreground' },
    saving: { icon: <Loader2 className="size-3 animate-spin" aria-hidden />, text: t('saving', language), tone: 'text-muted-foreground' },
    offline: { icon: <CloudOff className="size-3" aria-hidden />, text: t('offline', language), tone: 'text-amber-700 dark:text-amber-400' },
    retrying: { icon: <CloudOff className="size-3" aria-hidden />, text: t('retrying', language), tone: 'text-amber-700 dark:text-amber-400' },
  }[state];

  return (
    <p role="status" aria-live="polite" className={cn('flex items-center gap-1 text-xs', content.tone)}>
      {content.icon}
      <span className="truncate">{content.text}</span>
    </p>
  );
}
