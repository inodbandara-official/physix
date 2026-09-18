import Decimal from 'decimal.js';

/**
 * Parsing a student's numerical answer.
 *
 * Kept separate from comparison because *how it was written* matters as
 * much as what it equals: "9.810" and "9.81" are the same number but not
 * the same answer when significant figures are being marked.
 */

// Enough precision for any A/L Physics calculation without float artefacts.
Decimal.set({ precision: 40, toExpNeg: -30, toExpPos: 40 });

export interface ParsedNumber {
  value: Decimal;
  /** The numeric part exactly as typed, whitespace trimmed. Used for significant figures. */
  raw: string;
  /** Whatever followed the number, e.g. "m s^-1". Empty when no unit was given. */
  unit: string;
  significantFigures: number;
}

export type ParseFailure = 'empty' | 'not-a-number';

export type ParseResult =
  | { ok: true; parsed: ParsedNumber }
  | { ok: false; reason: ParseFailure };

/**
 * Students write powers of ten in several ways, all of which are correct
 * Physics. Each is rewritten to the `e` form before parsing.
 *
 *   1.6e-19        1.6E-19
 *   1.6 × 10^-19   1.6 x 10^-19   1.6*10^-19
 *   1.6 × 10⁻¹⁹    (superscript digits)
 *   10^5           (no mantissa)
 */
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺';
const SUPERSCRIPT_PLAIN = '0123456789-+';

function normalizeSuperscripts(input: string): string {
  let out = '';
  let runStart = -1;

  for (let i = 0; i <= input.length; i += 1) {
    const index = i < input.length ? SUPERSCRIPT.indexOf(input[i]) : -1;
    if (index >= 0) {
      if (runStart < 0) runStart = out.length;
      out += SUPERSCRIPT_PLAIN[index];
      continue;
    }
    // A run of superscript characters is an exponent: mark it as one.
    if (runStart >= 0) {
      out = `${out.slice(0, runStart)}^${out.slice(runStart)}`;
      runStart = -1;
    }
    if (i < input.length) out += input[i];
  }

  return out;
}

function normalizeExponent(input: string): string {
  return (
    input
      // "× 10^5", "x10^5", "*10^5", "·10^5" → "e5"
      .replace(/\s*[×x*·]\s*10\s*\^?\s*([+-]?\d+)/gi, 'e$1')
      // A bare "10^5" with no mantissa means 1 × 10^5.
      .replace(/^10\s*\^\s*([+-]?\d+)/i, '1e$1')
      // "1.6 ^-19" left over from superscript normalisation after "10".
      .replace(/\s*10\s*\^\s*([+-]?\d+)/gi, 'e$1')
  );
}

const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;

export function parseNumericAnswer(input: string): ParseResult {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };

  // Thousands separators are dropped only between digits, so "1,234.5"
  // parses while "1,2" (a decimal comma) is rejected rather than guessed at.
  const cleaned = normalizeExponent(normalizeSuperscripts(trimmed))
    .replace(/(\d),(?=\d{3}(\D|$))/g, '$1')
    .replace(/\s+/g, ' ');

  const match = NUMBER_PATTERN.exec(cleaned);
  if (!match) return { ok: false, reason: 'not-a-number' };

  const numeric = match[0];
  let value: Decimal;
  try {
    value = new Decimal(numeric);
  } catch {
    return { ok: false, reason: 'not-a-number' };
  }
  if (!value.isFinite()) return { ok: false, reason: 'not-a-number' };

  return {
    ok: true,
    parsed: {
      value,
      raw: numeric,
      unit: cleaned.slice(numeric.length).trim(),
      significantFigures: countSignificantFigures(numeric),
    },
  };
}

/**
 * Significant figures, counted the way a Physics teacher counts them.
 *
 *   9.81    → 3      0.00250 → 3      2.50e3 → 3
 *   1200    → 2      1200.   → 4      100.0  → 4
 *
 * Trailing zeros in a whole number with no decimal point are ambiguous by
 * convention; they are treated as *not* significant, which is the reading
 * taught in the Sri Lankan A/L syllabus.
 */
export function countSignificantFigures(raw: string): number {
  const [mantissa] = raw.split(/[eE]/);
  const unsigned = mantissa.replace(/^[+-]/, '');
  const hasDecimalPoint = unsigned.includes('.');
  const digits = unsigned.replace('.', '');

  const firstSignificant = digits.search(/[1-9]/);
  // A pure zero ("0", "0.00") counts as one significant figure.
  if (firstSignificant === -1) return 1;

  let significant = digits.slice(firstSignificant);

  if (!hasDecimalPoint) {
    significant = significant.replace(/0+$/, '');
    if (significant === '') return 1;
  }

  return significant.length;
}
