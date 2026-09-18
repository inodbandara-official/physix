import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { formDataToObject, fromZodError } from './action';

describe('formDataToObject', () => {
  it('trims values and turns blanks into undefined', () => {
    const form = new FormData();
    form.set('full_name', '  Nimal Perera  ');
    form.set('school', '   ');

    const result = formDataToObject(form);
    expect(result.full_name).toBe('Nimal Perera');
    expect(result.school).toBeUndefined();
  });

  it('collects repeated array fields', () => {
    const form = new FormData();
    form.append('batch_ids[]', 'a');
    form.append('batch_ids[]', 'b');

    expect(formDataToObject(form).batch_ids).toEqual(['a', 'b']);
  });

  it('ignores file entries', () => {
    const form = new FormData();
    form.set('avatar', new File(['x'], 'x.png'));
    form.set('name', 'Nimal');

    expect(formDataToObject(form)).toEqual({ name: 'Nimal' });
  });
});

describe('fromZodError', () => {
  it('groups messages by field path', () => {
    const schema = z.object({ name: z.string().min(5), age: z.number().min(18) });
    const parsed = schema.safeParse({ name: 'abc', age: 10 });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const state = fromZodError(parsed.error);
    expect(state.status).toBe('error');
    if (state.status !== 'error') return;

    expect(Object.keys(state.fieldErrors ?? {})).toEqual(['name', 'age']);
    expect(state.fieldErrors?.name).toHaveLength(1);
  });

  it('files a top-level refinement under _form when it has no path', () => {
    const schema = z.object({ a: z.string() }).refine(() => false, { message: 'Nope.' });
    const parsed = schema.safeParse({ a: 'x' });
    if (parsed.success) throw new Error('expected failure');

    const state = fromZodError(parsed.error);
    if (state.status !== 'error') throw new Error('expected error state');
    expect(state.fieldErrors?._form).toEqual(['Nope.']);
  });
});
