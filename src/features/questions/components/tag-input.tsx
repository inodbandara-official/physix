'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { TAG_PATTERN } from '../schema';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Tags already used elsewhere in the bank, offered as quick picks. */
  suggestions?: string[];
}

/** Free-form curation labels: #past-paper, #tricky, #needs-diagram. */
export function TagInput({ tags, onChange, suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = (value: string) => {
    const tag = value.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');
    if (tag === '') return;

    if (!TAG_PATTERN.test(tag)) {
      setError('Use lowercase letters, numbers and hyphens.');
      return;
    }
    if (tags.includes(tag)) {
      setDraft('');
      return;
    }
    if (tags.length >= 20) {
      setError('That is as many tags as one question needs.');
      return;
    }

    onChange([...tags, tag]);
    setDraft('');
    setError(null);
  };

  const unused = suggestions.filter((tag) => !tags.includes(tag)).slice(0, 8);

  return (
    <div className="space-y-2">
      <Label htmlFor="tag-input">Tags</Label>

      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary" className="gap-1 pr-1 font-normal">
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                  onClick={() => onChange(tags.filter((item) => item !== tag))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <Input
        id="tag-input"
        value={draft}
        placeholder="past-paper, then Enter"
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            // Enter must add a tag, not submit the whole question.
            event.preventDefault();
            add(draft);
          }
          if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() !== '' && add(draft)}
      />

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {unused.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">Used before:</span>
          {unused.map((tag) => (
            <Button key={tag} type="button" variant="ghost" size="xs" onClick={() => add(tag)}>
              {tag}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
