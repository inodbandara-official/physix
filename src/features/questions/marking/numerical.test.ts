import { describe, expect, it } from 'vitest';

import type { NumericalAnswer } from '@/features/questions/types';

import { countSignificantFigures, parseNumericAnswer } from './numeric-parse';
import { markNumerical, normalizeUnit } from './numerical';

function answer(partial: Partial<NumericalAnswer> & Pick<NumericalAnswer, 'value'>): NumericalAnswer {
  return {
    id: 'a1',
    tolerance: { mode: 'exact', value: '0' },
    significantFigures: null,
    requireUnit: false,
    acceptedUnits: [],
    marks: null,
    note: null,
    ...partial,
  };
}

describe('parseNumericAnswer', () => {
  it('reads a plain decimal', () => {
    const result = parseNumericAnswer('9.81');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed.value.toString()).toBe('9.81');
      expect(result.parsed.unit).toBe('');
    }
  });

  it.each([
    ['1.6e-19', '1.6e-19'],
    ['1.6E-19', '1.6e-19'],
    ['1.6 × 10^-19', '1.6e-19'],
    ['1.6x10^-19', '1.6e-19'],
    ['1.6*10^-19', '1.6e-19'],
    ['1.6 × 10⁻¹⁹', '1.6e-19'],
    ['10^5', '100000'],
  ])('reads scientific notation written as %s', (input, expected) => {
    const result = parseNumericAnswer(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parsed.value.equals(expected)).toBe(true);
  });

  it('separates the unit from the value', () => {
    const result = parseNumericAnswer('19.8 m s^-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed.value.toString()).toBe('19.8');
      expect(result.parsed.unit).toBe('m s^-1');
    }
  });

  it('drops thousands separators but not a decimal comma', () => {
    const grouped = parseNumericAnswer('1,234.5');
    expect(grouped.ok).toBe(true);
    if (grouped.ok) expect(grouped.parsed.value.toString()).toBe('1234.5');

    // "1,2" is a decimal comma in some conventions. Guessing would be worse
    // than parsing the leading 1 and letting the value comparison fail.
    const ambiguous = parseNumericAnswer('1,2');
    expect(ambiguous.ok).toBe(true);
    if (ambiguous.ok) expect(ambiguous.parsed.value.toString()).toBe('1');
  });

  it.each(['', '   '])('reports blank input (%s)', (input) => {
    const result = parseNumericAnswer(input);
    expect(result).toEqual({ ok: false, reason: 'empty' });
  });

  it.each(['abc', 'about ten', '-', 'e5'])('rejects %s as not a number', (input) => {
    const result = parseNumericAnswer(input);
    expect(result.ok).toBe(false);
  });

  it('keeps full precision rather than rounding through a float', () => {
    const result = parseNumericAnswer('0.1234567890123456789012345');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parsed.value.toString()).toBe('0.1234567890123456789012345');
  });
});

describe('countSignificantFigures', () => {
  it.each([
    ['9.81', 3],
    ['9.810', 4],
    ['0.00250', 3],
    ['250', 2],
    ['2500', 2],
    ['2500.', 4],
    ['100.0', 4],
    ['1.0e3', 2],
    ['0', 1],
    ['0.0', 1],
    ['-9.81', 3],
  ])('counts %s as %i significant figures', (raw, expected) => {
    expect(countSignificantFigures(raw)).toBe(expected);
  });
});

describe('markNumerical — exact matching', () => {
  it('accepts an exact match', () => {
    const result = markNumerical('9.81', [answer({ value: '9.81' })], 2);
    expect(result.correct).toBe(true);
    expect(result.marks).toBe(2);
    expect(result.outcome).toBe('exact');
  });

  it('treats trailing zeros as the same value when significant figures are not being marked', () => {
    const result = markNumerical('9.810', [answer({ value: '9.81' })], 2);
    expect(result.correct).toBe(true);
  });

  it('rejects a near miss when the tolerance is exact', () => {
    const result = markNumerical('9.8', [answer({ value: '9.81' })], 2);
    expect(result.correct).toBe(false);
    expect(result.outcome).toBe('wrong-value');
    expect(result.marks).toBe(0);
  });

  it('does not suffer from binary floating point error', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in float arithmetic.
    const result = markNumerical('0.3', [answer({ value: '0.3' })], 1);
    expect(result.correct).toBe(true);

    const tight = markNumerical('0.30000000000000004', [
      answer({ value: '0.3', tolerance: { mode: 'absolute', value: '0' } }),
    ], 1);
    expect(tight.correct).toBe(false);
  });
});

describe('markNumerical — tolerance', () => {
  const withAbsolute = [answer({ value: '9.81', tolerance: { mode: 'absolute', value: '0.05' } })];

  it.each([['9.81', true], ['9.8', true], ['9.86', true], ['9.76', true], ['9.87', false], ['9.7', false]])(
    'absolute ±0.05 accepts %s → %s',
    (response, expected) => {
      expect(markNumerical(response, withAbsolute, 1).correct).toBe(expected);
    },
  );

  it('accepts the tolerance boundary itself', () => {
    expect(markNumerical('9.76', withAbsolute, 1).correct).toBe(true);
    expect(markNumerical('9.86', withAbsolute, 1).correct).toBe(true);
  });

  it('scales a relative tolerance with the expected magnitude', () => {
    const answers = [answer({ value: '1000', tolerance: { mode: 'relative', value: '0.02' } })];
    expect(markNumerical('1020', answers, 1).correct).toBe(true);
    expect(markNumerical('980', answers, 1).correct).toBe(true);
    expect(markNumerical('1021', answers, 1).correct).toBe(false);
  });

  it('falls back to an absolute comparison when the expected value is zero', () => {
    // A relative tolerance around zero would reject everything, which is
    // never what the teacher meant.
    const answers = [answer({ value: '0', tolerance: { mode: 'relative', value: '0.01' } })];
    expect(markNumerical('0.005', answers, 1).correct).toBe(true);
    expect(markNumerical('0.02', answers, 1).correct).toBe(false);
  });

  it('handles negative expected values', () => {
    const answers = [answer({ value: '-273.15', tolerance: { mode: 'absolute', value: '0.5' } })];
    expect(markNumerical('-273', answers, 1).correct).toBe(true);
    expect(markNumerical('273.15', answers, 1).correct).toBe(false);
  });
});

describe('markNumerical — significant figures', () => {
  const threeSf = [answer({ value: '9.81', tolerance: { mode: 'absolute', value: '0.05' }, significantFigures: 3 })];

  it('accepts an answer written to the required number of figures', () => {
    expect(markNumerical('9.81', threeSf, 1).correct).toBe(true);
  });

  it('rejects too few significant figures even when the value is within tolerance', () => {
    const result = markNumerical('9.8', threeSf, 1);
    expect(result.correct).toBe(false);
    expect(result.outcome).toBe('wrong-significant-figures');
    expect(result.detail).toContain('3 significant figures');
  });

  it('rejects too many significant figures', () => {
    // The decisive case for counting from the string: 9.810 and 9.81 are
    // equal as numbers but different as answers.
    const result = markNumerical('9.810', threeSf, 1);
    expect(result.correct).toBe(false);
    expect(result.outcome).toBe('wrong-significant-figures');
  });

  it('counts significant figures in scientific notation', () => {
    const answers = [answer({ value: '1.6e-19', significantFigures: 2, tolerance: { mode: 'relative', value: '0.01' } })];
    expect(markNumerical('1.6e-19', answers, 1).correct).toBe(true);
    expect(markNumerical('1.60e-19', answers, 1).correct).toBe(false);
  });
});

describe('markNumerical — units', () => {
  const requiresUnit = [
    answer({ value: '19.8', requireUnit: true, acceptedUnits: ['m s^-1', 'm/s'], tolerance: { mode: 'absolute', value: '0.1' } }),
  ];

  it('accepts any unit the teacher listed', () => {
    expect(markNumerical('19.8 m s^-1', requiresUnit, 1).correct).toBe(true);
    expect(markNumerical('19.8 m/s', requiresUnit, 1).correct).toBe(true);
  });

  it('reports a missing unit distinctly from a wrong value', () => {
    const result = markNumerical('19.8', requiresUnit, 1);
    expect(result.correct).toBe(false);
    expect(result.outcome).toBe('missing-unit');
  });

  it('rejects a unit that was not listed, without converting anything', () => {
    // 19.8 km/h is a different quantity. Accepting it would require a
    // conversion the teacher never authorised.
    const result = markNumerical('19.8 km/h', requiresUnit, 1);
    expect(result.correct).toBe(false);
    expect(result.outcome).toBe('wrong-unit');
  });

  it('treats unit case as significant', () => {
    // m (metre) and M (molar) are not the same unit.
    const answers = [answer({ value: '5', requireUnit: true, acceptedUnits: ['m'] })];
    expect(markNumerical('5 m', answers, 1).correct).toBe(true);
    expect(markNumerical('5 M', answers, 1).correct).toBe(false);
  });

  it('ignores only cosmetic differences in spacing and multiplication signs', () => {
    const answers = [answer({ value: '5', requireUnit: true, acceptedUnits: ['kg m s^-2'] })];
    expect(markNumerical('5 kg·m s^-2', answers, 1).correct).toBe(true);
    expect(markNumerical('5   kg  m   s^-2', answers, 1).correct).toBe(true);
  });

  it('ignores a unit when none was configured', () => {
    expect(markNumerical('9.81 m s^-2', [answer({ value: '9.81' })], 1).correct).toBe(true);
  });

  it('accepts a missing unit when one is optional', () => {
    const answers = [answer({ value: '9.81', requireUnit: false, acceptedUnits: ['m s^-2'] })];
    expect(markNumerical('9.81', answers, 1).correct).toBe(true);
  });
});

describe('markNumerical — alternatives and marks', () => {
  it('reports the best-scoring alternative', () => {
    // A common A/L situation: full marks using g = 9.81, partial using g = 10.
    const answers = [
      answer({ id: 'precise', value: '19.62', marks: 2, tolerance: { mode: 'absolute', value: '0.05' } }),
      answer({ id: 'approx', value: '20', marks: 1, tolerance: { mode: 'absolute', value: '0.05' } }),
    ];

    expect(markNumerical('19.62', answers, 2)).toMatchObject({ marks: 2, matchedAnswerId: 'precise' });
    expect(markNumerical('20', answers, 2)).toMatchObject({ marks: 1, matchedAnswerId: 'approx' });
  });

  it('never awards more than the question is worth', () => {
    const answers = [answer({ value: '5', marks: 10 })];
    expect(markNumerical('5', answers, 3).marks).toBe(3);
  });

  it('prefers the most informative outcome when no alternative scores', () => {
    const answers = [
      answer({ id: 'a', value: '5', requireUnit: true, acceptedUnits: ['m'] }),
      answer({ id: 'b', value: '99' }),
    ];
    // The value matches 'a' but the unit is missing: say so, rather than
    // reporting the unrelated mismatch against 'b'.
    expect(markNumerical('5', answers, 1).outcome).toBe('missing-unit');
  });
});

describe('markNumerical — invalid input', () => {
  it.each([null, undefined, '', '   '])('treats %s as blank', (response) => {
    const result = markNumerical(response, [answer({ value: '5' })], 1);
    expect(result.outcome).toBe('blank');
    expect(result.marks).toBe(0);
  });

  it('reports unparseable text without crashing', () => {
    const result = markNumerical('about ten', [answer({ value: '10' })], 1);
    expect(result.outcome).toBe('unparseable');
    expect(result.correct).toBe(false);
  });

  it('fails safe when the question has no accepted answer', () => {
    const result = markNumerical('5', [], 1);
    expect(result.correct).toBe(false);
    expect(result.marks).toBe(0);
  });

  it('fails safe when the configured answer is not a number', () => {
    const result = markNumerical('5', [answer({ value: 'nonsense' })], 1);
    expect(result.correct).toBe(false);
    expect(result.marks).toBe(0);
  });
});

describe('normalizeUnit', () => {
  it.each([
    ['  m s^-1 ', 'm s^-1'],
    ['kg·m/s²', 'kg m/s²'],
    ['m / s', 'm/s'],
    ['N  m', 'N m'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizeUnit(input)).toBe(expected);
  });

  it('does not change case', () => {
    expect(normalizeUnit('MW')).toBe('MW');
    expect(normalizeUnit('mW')).toBe('mW');
  });
});
