import type { ContentLanguage } from '@/types/database';

/**
 * The handful of interface strings that appear alongside translated
 * content, so a Sinhala reader is not shown a Sinhala question wrapped in
 * English furniture.
 *
 * This is deliberately not a full i18n system. The teacher's side stays in
 * English — it is used by one person who chose it — and only the student
 * surfaces that carry translated content are localised.
 */
const STRINGS = {
  syllabus: { en: 'Syllabus', si: 'විෂය නිර්දේශය' },
  syllabusIntro: {
    en: 'Everything covered in this Physics course.',
    si: 'මෙම භෞතික විද්‍යා පාඨමාලාවේ ආවරණය වන සියල්ල.',
  },
  syllabusEmpty: {
    en: 'Syllabus not published yet',
    si: 'විෂය නිර්දේශය තවම ප්‍රකාශයට පත් කර නැත',
  },
  language: { en: 'Language', si: 'භාෂාව' },
  showingEnglish: {
    en: 'Shown in English — no Sinhala translation yet.',
    si: 'ඉංග්‍රීසි බසින් දැක්වේ — තවම සිංහල පරිවර්තනයක් නැත.',
  },
  dashboard: { en: 'Dashboard', si: 'උපකරණ පුවරුව' },
  profile: { en: 'Profile', si: 'පැතිකඩ' },
} satisfies Record<string, Record<ContentLanguage, string>>;

export type LabelKey = keyof typeof STRINGS;

export function t(key: LabelKey, language: ContentLanguage): string {
  return STRINGS[key][language];
}
