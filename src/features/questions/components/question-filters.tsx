'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { DIFFICULTY_LABELS, DIFFICULTY_ORDER, QUESTION_TYPE_LABELS } from '../types';

const ANY = 'any';
const FILTER_KEYS = ['q', 'unit', 'node', 'type', 'difficulty', 'status', 'tag', 'year', 'archived'];

interface QuestionFiltersProps {
  units: { id: string; name: string }[];
  tags: { tag: string; count: number }[];
  years: number[];
}

export function QuestionFilters({ units, tags, years }: QuestionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const term = searchParams.get('q') ?? '';

  const apply = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === ANY) params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    startTransition(() => router.push(`/t/questions?${params.toString()}`));
  };

  const hasFilters = FILTER_KEYS.some((key) => searchParams.get(key));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            const entered = new FormData(event.currentTarget).get('q');
            apply({ q: String(entered ?? '').trim() || undefined });
          }}
        >
          <Label htmlFor="question-search" className="sr-only">
            Search questions
          </Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              key={term}
              id="question-search"
              name="q"
              defaultValue={term}
              placeholder="Search question text, title or ID"
              className="pl-9"
              type="search"
            />
          </div>
        </form>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => startTransition(() => router.push('/t/questions'))}
          >
            <X className="size-4" aria-hidden />
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <FilterSelect
          id="filter-unit"
          label="Unit"
          value={searchParams.get('unit') ?? ANY}
          placeholder="All units"
          onChange={(value) => apply({ unit: value, node: undefined })}
          options={units.map((unit) => ({ value: unit.id, label: unit.name }))}
        />

        <FilterSelect
          id="filter-type"
          label="Type"
          value={searchParams.get('type') ?? ANY}
          placeholder="Any type"
          onChange={(value) => apply({ type: value })}
          options={Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />

        <FilterSelect
          id="filter-difficulty"
          label="Difficulty"
          value={searchParams.get('difficulty') ?? ANY}
          placeholder="Any"
          onChange={(value) => apply({ difficulty: value })}
          options={DIFFICULTY_ORDER.map((level) => ({ value: level, label: DIFFICULTY_LABELS[level] }))}
        />

        <FilterSelect
          id="filter-status"
          label="Status"
          value={searchParams.get('status') ?? ANY}
          placeholder="Any"
          onChange={(value) => apply({ status: value })}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'published', label: 'Published' },
          ]}
        />

        <FilterSelect
          id="filter-tag"
          label="Tag"
          value={searchParams.get('tag') ?? ANY}
          placeholder="Any tag"
          onChange={(value) => apply({ tag: value })}
          options={tags.map((tag) => ({ value: tag.tag, label: `${tag.tag} (${tag.count})` }))}
        />

        <FilterSelect
          id="filter-year"
          label="Year"
          value={searchParams.get('year') ?? ANY}
          placeholder="Any year"
          onChange={(value) => apply({ year: value })}
          options={years.map((year) => ({ value: String(year), label: String(year) }))}
        />
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
