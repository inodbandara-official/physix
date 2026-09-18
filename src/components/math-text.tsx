import katex from 'katex';
import { Fragment } from 'react';

import { cn } from '@/lib/utils';

/**
 * Renders Physics prose with embedded LaTeX.
 *
 *   Inline maths:   $E_k = \frac{1}{2}mv^2$
 *   Display maths:  $$v^2 = u^2 + 2as$$
 *
 * Everything outside the delimiters is plain text, rendered as React
 * children so it is escaped automatically. Only KaTeX's own output is
 * injected as HTML, and KaTeX runs with `trust: false`, so a `\href` or
 * `\htmlClass` in a question cannot inject markup.
 *
 * This is not a Markdown renderer, deliberately: accepting arbitrary HTML
 * from a rich-text field would mean shipping a sanitiser and trusting it.
 * Paragraphs, line breaks and maths cover what a Physics question needs.
 */

type Segment =
  | { type: 'text'; value: string }
  | { type: 'math'; value: string; display: boolean };

const MATH_PATTERN = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

export function parseMathSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(MATH_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', value: input.slice(lastIndex, index) });
    }

    const display = match[1] !== undefined;
    segments.push({ type: 'math', value: (display ? match[1] : match[2]).trim(), display });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push({ type: 'text', value: input.slice(lastIndex) });
  }

  return segments;
}

function renderMath(value: string, display: boolean): { html: string; failed: boolean } {
  try {
    return {
      html: katex.renderToString(value, {
        displayMode: display,
        throwOnError: true,
        trust: false,
        strict: false,
        output: 'html',
      }),
      failed: false,
    };
  } catch {
    // A malformed formula shows as the source the teacher typed, which is
    // far more useful than a blank space or a crashed page.
    return { html: '', failed: true };
  }
}

interface MathTextProps {
  children: string | null | undefined;
  className?: string;
  /** Render inside a <span> rather than a block, for use in table cells and headings. */
  inline?: boolean;
}

export function MathText({ children, className, inline }: MathTextProps) {
  if (!children) return null;

  const content = parseMathSegments(children).map((segment, index) => {
    if (segment.type === 'text') {
      // Blank lines separate paragraphs; single newlines are line breaks.
      return (
        <Fragment key={index}>
          {segment.value.split('\n').map((line, lineIndex, lines) => (
            <Fragment key={lineIndex}>
              {line}
              {lineIndex < lines.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </Fragment>
      );
    }

    const { html, failed } = renderMath(segment.value, segment.display);
    if (failed) {
      return (
        <code key={index} className="rounded bg-destructive/10 px-1 text-destructive" title="This formula could not be rendered">
          {segment.display ? `$$${segment.value}$$` : `$${segment.value}$`}
        </code>
      );
    }

    return segment.display ? (
      <span key={index} className="my-2 block overflow-x-auto text-center" dangerouslySetInnerHTML={{ __html: html }} />
    ) : (
      <span key={index} dangerouslySetInnerHTML={{ __html: html }} />
    );
  });

  const Tag = inline ? 'span' : 'div';
  return <Tag className={cn(inline ? undefined : 'leading-relaxed', className)}>{content}</Tag>;
}

/** Plain-text preview for list rows: maths becomes its source, newlines collapse. */
export function mathToPlainText(input: string, maxLength = 160): string {
  const flat = input
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, value: string) => value.trim())
    .replace(/\$([^$\n]+?)\$/g, (_, value: string) => value.trim())
    .replace(/\s+/g, ' ')
    .trim();

  return flat.length > maxLength ? `${flat.slice(0, maxLength - 1).trimEnd()}…` : flat;
}
