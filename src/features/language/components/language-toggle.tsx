'use client';

import { useTransition } from 'react';
import { Check, Languages } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { runWithToast } from '@/lib/run-action';
import type { ContentLanguage } from '@/types/database';

import { setLanguageAction } from '../actions';

const OPTIONS: { value: ContentLanguage; label: string; note: string }[] = [
  { value: 'en', label: 'English', note: 'English' },
  { value: 'si', label: 'සිංහල', note: 'Sinhala' },
];

/**
 * Switches reading language. The choice is saved to the account, so it
 * follows the student from a phone in class to a laptop at home.
 */
export function LanguageToggle({ current }: { current: ContentLanguage }) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending} aria-label="Change language / භාෂාව වෙනස් කරන්න">
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          Language · භාෂාව
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() =>
              option.value !== current &&
              startTransition(() => runWithToast(() => setLanguageAction(option.value)))
            }
          >
            <Check className={option.value === current ? 'size-4' : 'size-4 opacity-0'} aria-hidden />
            <span className="flex-1">{option.label}</span>
            {option.label !== option.note ? (
              <span className="text-xs text-muted-foreground">{option.note}</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
