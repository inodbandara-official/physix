import { describe, expect, it } from 'vitest';

import type { QuestionBody } from './types';
import { contentFingerprint, shouldCreateNewVersion, stableStringify, type VersionContent } from './versioning';

const body: QuestionBody = {
  kind: 'mcq',
  options: [
    { id: 'o1', text: 'Speed', feedback: null },
    { id: 'o2', text: 'Velocity', feedback: null },
  ],
  correctOptionId: 'o2',
  shuffleOptions: true,
};

function content(overrides: Partial<VersionContent> = {}): VersionContent {
  return {
    type: 'mcq',
    title: 'Vectors',
    stem: 'Which quantity is a vector?',
    body,
    marks: 1,
    difficulty: 'easy',
    estimated_seconds: 60,
    syllabus_node_id: 'node-1',
    source: null,
    source_year: null,
    paper_reference: null,
    explanation: null,
    solution: null,
    common_mistake: null,
    hint: null,
    figures: [],
    ...overrides,
  };
}

describe('stableStringify', () => {
  it('is insensitive to key order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it('is sensitive to array order', () => {
    // Option order is content: reordering them changes what a student sees.
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('sorts keys inside nested objects', () => {
    expect(stableStringify({ outer: { a: 1, b: 2 } })).toBe(stableStringify({ outer: { b: 2, a: 1 } }));
  });
});

describe('contentFingerprint', () => {
  it('ignores surrounding whitespace in the stem and title', () => {
    expect(contentFingerprint(content({ stem: '  Which quantity is a vector?  ' }))).toBe(
      contentFingerprint(content()),
    );
  });

  it('treats a missing optional field and an explicit null as the same', () => {
    expect(contentFingerprint(content({ explanation: null }))).toBe(contentFingerprint(content()));
  });

  it('changes when the answer key changes', () => {
    const edited: QuestionBody = { ...body, correctOptionId: 'o1' };
    expect(contentFingerprint(content({ body: edited }))).not.toBe(contentFingerprint(content()));
  });

  it('changes when the marks change', () => {
    expect(contentFingerprint(content({ marks: 2 }))).not.toBe(contentFingerprint(content()));
  });
});

describe('shouldCreateNewVersion', () => {
  it('edits a draft in place', () => {
    // Nobody has sat a draft, so its edit history is noise.
    expect(shouldCreateNewVersion('draft', content(), content({ stem: 'Rewritten' }))).toBe(false);
  });

  it('forks a published question when its content changes', () => {
    expect(shouldCreateNewVersion('published', content(), content({ stem: 'Rewritten' }))).toBe(true);
  });

  it('forks a published question when the correct answer changes', () => {
    // The case that matters most: silently changing the key would rewrite
    // every past result.
    const edited: QuestionBody = { ...body, correctOptionId: 'o1' };
    expect(shouldCreateNewVersion('published', content(), content({ body: edited }))).toBe(true);
  });

  it('does not fork when nothing a student sees has changed', () => {
    expect(shouldCreateNewVersion('published', content(), content())).toBe(false);
  });

  it('treats an archived question like a published one', () => {
    expect(shouldCreateNewVersion('archived', content(), content({ marks: 5 }))).toBe(true);
  });
});
