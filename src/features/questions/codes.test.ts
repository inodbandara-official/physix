import { describe, expect, it } from 'vitest';

import { nextCopyCode, suggestQuestionCode } from './codes';

describe('suggestQuestionCode', () => {
  it('starts at Q-0001 for an empty bank', () => {
    expect(suggestQuestionCode([])).toBe('Q-0001');
  });

  it('skips codes already in use', () => {
    expect(suggestQuestionCode(['Q-0001', 'Q-0002'])).toBe('Q-0003');
  });

  it('fills a gap rather than always appending', () => {
    expect(suggestQuestionCode(['Q-0001', 'Q-0003'])).toBe('Q-0002');
  });

  it('ignores case when checking what is taken', () => {
    expect(suggestQuestionCode(['q-0001'])).toBe('Q-0002');
  });

  it('ignores codes that do not follow the pattern', () => {
    expect(suggestQuestionCode(['MECH-01', '2019-P2-Q4'])).toBe('Q-0001');
  });
});

describe('nextCopyCode', () => {
  it('appends -COPY the first time', () => {
    expect(nextCopyCode('Q-0007', ['Q-0007'])).toBe('Q-0007-COPY');
  });

  it('numbers further copies', () => {
    expect(nextCopyCode('Q-0007', ['Q-0007', 'Q-0007-COPY'])).toBe('Q-0007-COPY2');
    expect(nextCopyCode('Q-0007', ['Q-0007', 'Q-0007-COPY', 'Q-0007-COPY2'])).toBe('Q-0007-COPY3');
  });

  it('ignores case when checking what is taken', () => {
    expect(nextCopyCode('Q-0007', ['q-0007-copy'])).toBe('Q-0007-COPY2');
  });

  it('works for codes that are not in the Q-nnnn family', () => {
    expect(nextCopyCode('MECH-01', [])).toBe('MECH-01-COPY');
  });
});
