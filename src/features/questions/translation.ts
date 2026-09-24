import type { Figure, QuestionBody, SimpleQuestionBody } from './types';

/**
 * Bilingual question content.
 *
 * A translation carries **prose only**. Option ids, part ids, answer keys,
 * marks, tolerances and accepted units live once in `body` and are shared
 * by every language, so a question cannot mark one way in English and
 * another in Sinhala.
 *
 * Maths is never translated: `$…$` and `$$…$$` are copied verbatim, and
 * numbers keep their digits. A translated question differs from the
 * original in wording, never in physics.
 */

export const CONTENT_LANGUAGES = ['en', 'si'] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<ContentLanguage, string> = {
  en: 'English',
  si: 'සිංහල',
};

/** The language a question is authored in. Translations hang off it. */
export const SOURCE_LANGUAGE: ContentLanguage = 'en';

export interface QuestionTranslation {
  title?: string;
  stem?: string;
  explanation?: string;
  solution?: string;
  hint?: string;
  commonMistake?: string;
  /** Option id → translated text. */
  options?: Record<string, string>;
  /** Part id → translated prompt and explanation. */
  parts?: Record<string, { prompt?: string; explanation?: string }>;
  /** Figure id → translated alt text and caption. */
  figures?: Record<string, { alt?: string; caption?: string }>;
  /**
   * False for a draft a human has not checked. Students are only ever
   * shown a reviewed translation — an unreviewed one falls back to
   * English rather than risking a mistranslated exam question.
   */
  reviewed?: boolean;
}

export type QuestionTranslations = Partial<Record<ContentLanguage, QuestionTranslation>>;

/** Prose a translator has to supply, in the order the editor shows it. */
export interface TranslatableField {
  key: keyof Pick<
    QuestionTranslation,
    'title' | 'stem' | 'explanation' | 'solution' | 'hint' | 'commonMistake'
  >;
  label: string;
  rows: number;
}

export const TRANSLATABLE_FIELDS: TranslatableField[] = [
  { key: 'stem', label: 'Question text', rows: 6 },
  { key: 'title', label: 'Short title', rows: 2 },
  { key: 'explanation', label: 'Explanation', rows: 4 },
  { key: 'solution', label: 'Worked solution', rows: 6 },
  { key: 'hint', label: 'Hint', rows: 2 },
  { key: 'commonMistake', label: 'Common mistake', rows: 3 },
];

/**
 * Whether a translation is complete enough to show.
 *
 * The bar is the question text: a student reading Sinhala must at minimum
 * get the question itself in Sinhala. Everything else falls back field by
 * field, so a half-translated question still renders in full.
 */
export function hasUsableTranslation(
  translations: QuestionTranslations,
  language: ContentLanguage,
): boolean {
  if (language === SOURCE_LANGUAGE) return true;
  const translation = translations[language];
  return Boolean(translation?.stem && translation.stem.trim() !== '');
}

export function isReviewed(translations: QuestionTranslations, language: ContentLanguage): boolean {
  if (language === SOURCE_LANGUAGE) return true;
  return translations[language]?.reviewed === true;
}

/** Languages a student could actually read this question in. */
export function availableLanguages(translations: QuestionTranslations): ContentLanguage[] {
  return CONTENT_LANGUAGES.filter(
    (language) =>
      language === SOURCE_LANGUAGE ||
      (hasUsableTranslation(translations, language) && isReviewed(translations, language)),
  );
}

interface LocalizeOptions {
  /**
   * Show an unreviewed draft anyway. True in the teacher's editor and
   * preview; never true for a student.
   */
  includeUnreviewed?: boolean;
}

/** A non-empty translated string, or the original. */
function pick(translated: string | undefined, original: string): string;
function pick(translated: string | undefined, original: string | null): string | null;
function pick(translated: string | undefined, original: string | null): string | null {
  const trimmed = translated?.trim();
  return trimmed ? trimmed : original;
}

export interface LocalizedContent {
  language: ContentLanguage;
  /** False when the requested language was unavailable and English is shown. */
  translated: boolean;
  title: string;
  stem: string;
  explanation: string | null;
  solution: string | null;
  hint: string | null;
  commonMistake: string | null;
  body: QuestionBody;
  figures: Figure[];
}

interface SourceContent {
  title: string;
  stem: string;
  explanation: string | null;
  solution: string | null;
  hint: string | null;
  common_mistake: string | null;
  body: QuestionBody;
  figures: Figure[];
}

/**
 * Resolves what a reader actually sees.
 *
 * Every field falls back independently, so a translation that covers the
 * question but not the worked solution shows Sinhala for one and English
 * for the other, rather than hiding either.
 */
export function localizeQuestion(
  source: SourceContent,
  translations: QuestionTranslations,
  language: ContentLanguage,
  options: LocalizeOptions = {},
): LocalizedContent {
  const usable =
    language !== SOURCE_LANGUAGE &&
    hasUsableTranslation(translations, language) &&
    (options.includeUnreviewed || isReviewed(translations, language));

  if (!usable) {
    return {
      language: SOURCE_LANGUAGE,
      translated: false,
      title: source.title,
      stem: source.stem,
      explanation: source.explanation,
      solution: source.solution,
      hint: source.hint,
      commonMistake: source.common_mistake,
      body: source.body,
      figures: source.figures,
    };
  }

  const t = translations[language]!;

  return {
    language,
    translated: true,
    title: pick(t.title, source.title),
    stem: pick(t.stem, source.stem),
    explanation: pick(t.explanation, source.explanation),
    solution: pick(t.solution, source.solution),
    hint: pick(t.hint, source.hint),
    commonMistake: pick(t.commonMistake, source.common_mistake),
    body: localizeBody(source.body, t),
    figures: localizeFigures(source.figures, t),
  };
}

function localizeFigures(figures: Figure[], t: QuestionTranslation): Figure[] {
  if (!t.figures) return figures;
  return figures.map((figure) => {
    const translated = t.figures?.[figure.id];
    if (!translated) return figure;
    return {
      ...figure,
      alt: pick(translated.alt, figure.alt),
      caption: pick(translated.caption, figure.caption),
    };
  });
}

/**
 * Swaps displayed text inside a body, leaving everything that decides
 * marking untouched — ids, correct answers, tolerances, units, marks.
 */
export function localizeBody(body: QuestionBody, t: QuestionTranslation): QuestionBody {
  if (body.kind === 'structured') {
    return {
      ...body,
      parts: body.parts.map((part) => {
        const translated = t.parts?.[part.id];
        return {
          ...part,
          prompt: pick(translated?.prompt, part.prompt),
          explanation: pick(translated?.explanation, part.explanation),
          figures: localizeFigures(part.figures, t),
          body: localizeSimpleBody(part.body, t),
        };
      }),
    };
  }

  return localizeSimpleBody(body, t);
}

function localizeSimpleBody(body: SimpleQuestionBody, t: QuestionTranslation): SimpleQuestionBody {
  switch (body.kind) {
    case 'mcq':
    case 'multi':
      return {
        ...body,
        options: body.options.map((option) => ({
          ...option,
          text: pick(t.options?.[option.id], option.text),
        })),
      };
    // Short answers are not translated here: the accepted answers are
    // marking data, and a teacher who accepts a Sinhala response adds it
    // to the same list rather than replacing the English one.
    default:
      return body;
  }
}

/**
 * Every id a translation needs to cover, so the editor can show one field
 * per piece of prose without the teacher hunting for them.
 */
export function translatableIds(body: QuestionBody): {
  options: { id: string; source: string; partLabel?: string }[];
  parts: { id: string; label: string; prompt: string; explanation: string | null }[];
} {
  const options: { id: string; source: string; partLabel?: string }[] = [];
  const parts: { id: string; label: string; prompt: string; explanation: string | null }[] = [];

  const collectOptions = (simple: SimpleQuestionBody, partLabel?: string) => {
    if (simple.kind === 'mcq' || simple.kind === 'multi') {
      for (const option of simple.options) {
        options.push({ id: option.id, source: option.text, partLabel });
      }
    }
  };

  if (body.kind === 'structured') {
    for (const part of body.parts) {
      parts.push({
        id: part.id,
        label: part.label,
        prompt: part.prompt,
        explanation: part.explanation,
      });
      collectOptions(part.body, part.label);
    }
  } else {
    collectOptions(body);
  }

  return { options, parts };
}
