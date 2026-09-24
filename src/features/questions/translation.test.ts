import { describe, expect, it } from 'vitest';

import {
  availableLanguages,
  hasUsableTranslation,
  localizeQuestion,
  translatableIds,
  type QuestionTranslations,
} from './translation';
import type { QuestionBody } from './types';

const mcq: QuestionBody = {
  kind: 'mcq',
  options: [
    { id: 'o1', text: 'Speed', feedback: null },
    { id: 'o2', text: 'Velocity', feedback: null },
  ],
  correctOptionId: 'o2',
  shuffleOptions: true,
};

const source = {
  title: 'Vectors',
  stem: 'Which quantity is a vector? $v = 5\\ \\text{m s}^{-1}$',
  explanation: 'Velocity has direction.',
  solution: null,
  hint: null,
  common_mistake: null,
  body: mcq,
  figures: [],
};

const sinhala: QuestionTranslations = {
  si: {
    stem: 'දෛශිකයක් වන්නේ කුමන රාශියද? $v = 5\\ \\text{m s}^{-1}$',
    options: { o1: 'ප්‍රවේගය', o2: 'වේගය' },
    reviewed: true,
  },
};

describe('localizeQuestion', () => {
  it('returns the original when English is asked for', () => {
    const result = localizeQuestion(source, sinhala, 'en');
    expect(result.stem).toBe(source.stem);
    expect(result.translated).toBe(false);
  });

  it('swaps the stem and the option text for Sinhala', () => {
    const result = localizeQuestion(source, sinhala, 'si');
    expect(result.stem).toContain('දෛශිකයක්');
    expect(result.translated).toBe(true);
    if (result.body.kind === 'mcq') {
      expect(result.body.options.map((option) => option.text)).toEqual(['ප්‍රවේගය', 'වේගය']);
    }
  });

  it('never changes the answer key', () => {
    // The whole point of sharing structure: a question cannot mark one way
    // in English and another in Sinhala.
    const result = localizeQuestion(source, sinhala, 'si');
    if (result.body.kind !== 'mcq') throw new Error('expected mcq');
    expect(result.body.correctOptionId).toBe('o2');
    expect(result.body.options.map((option) => option.id)).toEqual(['o1', 'o2']);
  });

  it('keeps maths untouched', () => {
    const result = localizeQuestion(source, sinhala, 'si');
    expect(result.stem).toContain('$v = 5\\ \\text{m s}^{-1}$');
  });

  it('falls back field by field, so a partial translation still renders', () => {
    // Sinhala stem, but no Sinhala explanation.
    const result = localizeQuestion(source, sinhala, 'si');
    expect(result.stem).toContain('දෛශිකයක්');
    expect(result.explanation).toBe('Velocity has direction.');
  });

  it('falls back to English when a translation is missing entirely', () => {
    const result = localizeQuestion(source, {}, 'si');
    expect(result.stem).toBe(source.stem);
    expect(result.translated).toBe(false);
    expect(result.language).toBe('en');
  });

  it('hides an unreviewed translation from students', () => {
    // An unchecked draft must not become an exam question.
    const draft: QuestionTranslations = { si: { stem: 'draft', reviewed: false } };
    expect(localizeQuestion(source, draft, 'si').translated).toBe(false);
  });

  it('shows an unreviewed draft when the teacher asks for it', () => {
    const draft: QuestionTranslations = { si: { stem: 'draft', reviewed: false } };
    const result = localizeQuestion(source, draft, 'si', { includeUnreviewed: true });
    expect(result.translated).toBe(true);
    expect(result.stem).toBe('draft');
  });

  it('treats a whitespace-only translation as missing', () => {
    const blank: QuestionTranslations = { si: { stem: '   ', reviewed: true } };
    expect(localizeQuestion(source, blank, 'si').translated).toBe(false);
  });

  it('ignores a translated option whose id no longer exists', () => {
    const stale: QuestionTranslations = {
      si: { stem: 'ප්‍රශ්නය', options: { gone: 'orphan' }, reviewed: true },
    };
    const result = localizeQuestion(source, stale, 'si');
    if (result.body.kind !== 'mcq') throw new Error('expected mcq');
    expect(result.body.options.map((option) => option.text)).toEqual(['Speed', 'Velocity']);
  });
});

describe('structured questions', () => {
  const structured: QuestionBody = {
    kind: 'structured',
    parts: [
      {
        id: 'p1',
        label: 'a',
        prompt: 'Calculate the acceleration.',
        marks: 2,
        explanation: 'Use $a = (v-u)/t$.',
        figures: [],
        body: { kind: 'numerical', answers: [] },
      },
    ],
  };

  it('translates part prompts while keeping marks and ids', () => {
    const result = localizeQuestion(
      { ...source, body: structured },
      { si: { stem: 'ප්‍රශ්නය', parts: { p1: { prompt: 'ත්වරණය ගණනය කරන්න.' } }, reviewed: true } },
      'si',
    );

    if (result.body.kind !== 'structured') throw new Error('expected structured');
    expect(result.body.parts[0].prompt).toBe('ත්වරණය ගණනය කරන්න.');
    expect(result.body.parts[0].marks).toBe(2);
    expect(result.body.parts[0].label).toBe('a');
    // Untranslated part explanation falls back.
    expect(result.body.parts[0].explanation).toBe('Use $a = (v-u)/t$.');
  });
});

describe('availableLanguages', () => {
  it('always offers English', () => {
    expect(availableLanguages({})).toEqual(['en']);
  });

  it('offers Sinhala once reviewed', () => {
    expect(availableLanguages(sinhala)).toEqual(['en', 'si']);
  });

  it('does not offer an unreviewed draft', () => {
    expect(availableLanguages({ si: { stem: 'draft', reviewed: false } })).toEqual(['en']);
  });
});

describe('hasUsableTranslation', () => {
  it('requires the question text, not just any field', () => {
    // A translated hint alone does not make a question readable in Sinhala.
    expect(hasUsableTranslation({ si: { hint: 'ඉඟිය', reviewed: true } }, 'si')).toBe(false);
    expect(hasUsableTranslation(sinhala, 'si')).toBe(true);
  });
});

describe('translatableIds', () => {
  it('lists every option for a simple question', () => {
    expect(translatableIds(mcq).options.map((option) => option.id)).toEqual(['o1', 'o2']);
  });

  it('lists parts and their options, labelled by part', () => {
    const body: QuestionBody = {
      kind: 'structured',
      parts: [
        {
          id: 'p1',
          label: 'a',
          prompt: 'Choose one.',
          marks: 1,
          explanation: null,
          figures: [],
          body: mcq as never,
        },
      ],
    };
    const result = translatableIds(body);
    expect(result.parts).toHaveLength(1);
    expect(result.options[0].partLabel).toBe('a');
  });
});
