import { describe, expect, it } from 'vitest';

import { mathToPlainText, parseMathSegments } from './math-text';

describe('parseMathSegments', () => {
  it('returns a single text segment when there is no maths', () => {
    expect(parseMathSegments('A body of mass 2 kg.')).toEqual([
      { type: 'text', value: 'A body of mass 2 kg.' },
    ]);
  });

  it('splits inline maths out of surrounding prose', () => {
    expect(parseMathSegments('Given $F = ma$, find the force.')).toEqual([
      { type: 'text', value: 'Given ' },
      { type: 'math', value: 'F = ma', display: false },
      { type: 'text', value: ', find the force.' },
    ]);
  });

  it('recognises display maths', () => {
    const segments = parseMathSegments('Use $$v^2 = u^2 + 2as$$ here.');
    expect(segments[1]).toEqual({ type: 'math', value: 'v^2 = u^2 + 2as', display: true });
  });

  it('prefers display delimiters over inline ones', () => {
    // "$$x$$" must not be read as an empty inline "$", then "x", then "$".
    const segments = parseMathSegments('$$x$$');
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ type: 'math', display: true, value: 'x' });
  });

  it('handles several formulas in one string', () => {
    const segments = parseMathSegments('$a$ and $b$');
    expect(segments.filter((segment) => segment.type === 'math')).toHaveLength(2);
  });

  it('leaves a lone dollar sign as text', () => {
    // A price or a stray symbol must not swallow the rest of the question.
    expect(parseMathSegments('costs $5 to make')).toEqual([{ type: 'text', value: 'costs $5 to make' }]);
  });

  it('does not let inline maths span a line break', () => {
    const segments = parseMathSegments('$a\nb$');
    expect(segments.every((segment) => segment.type === 'text')).toBe(true);
  });

  it('keeps LaTeX backslashes intact', () => {
    const segments = parseMathSegments(String.raw`$E_k = \frac{1}{2}mv^2$`);
    expect(segments[0]).toMatchObject({ value: String.raw`E_k = \frac{1}{2}mv^2` });
  });
});

describe('mathToPlainText', () => {
  it('strips delimiters for list previews', () => {
    expect(mathToPlainText('Given $F = ma$, find the force.')).toBe('Given F = ma, find the force.');
  });

  it('collapses newlines and repeated spaces', () => {
    expect(mathToPlainText('line one\n\nline   two')).toBe('line one line two');
  });

  it('truncates with an ellipsis', () => {
    const result = mathToPlainText('x'.repeat(300), 20);
    expect(result).toHaveLength(20);
    expect(result.endsWith('…')).toBe(true);
  });

  it('leaves a short string unchanged', () => {
    expect(mathToPlainText('short', 20)).toBe('short');
  });
});
