import { describe, expect, it } from 'vitest';

import {
  accuracyOf,
  categoryOf,
  histogram,
  improvement,
  monthKey,
  monthlyTimeline,
  personalBests,
  questionStats,
  summarise,
  topicResolver,
  weakTopics,
  type AttemptRecord,
  type QuestionRecord,
} from './compute';

let counter = 0;
const record = (overrides: Partial<QuestionRecord> = {}): QuestionRecord => ({
  studentId: 's1',
  attemptId: `a${counter++}`,
  questionId: 'q1',
  submittedAt: '2026-03-10T05:00:00Z',
  unitId: 'unit',
  nodeId: 'sub',
  difficulty: 'medium',
  type: 'mcq',
  marks: 1,
  maxMarks: 1,
  answered: true,
  ...overrides,
});

const attempt = (submittedAt: string, percentage: number): AttemptRecord => ({
  attemptId: `t${counter++}`,
  studentId: 's1',
  assessmentId: 'x',
  submittedAt,
  percentage,
});

describe('accuracyOf', () => {
  it('is marks over available marks', () => {
    expect(accuracyOf([record({ marks: 3, maxMarks: 4 }), record({ marks: 1, maxMarks: 4 })]).accuracy).toBe(50);
  });

  it('counts a negatively marked question as zero, not below', () => {
    expect(accuracyOf([record({ marks: -1, maxMarks: 4 }), record({ marks: 4, maxMarks: 4 })]).accuracy).toBe(50);
  });

  it('is null with nothing to measure', () => {
    expect(accuracyOf([]).accuracy).toBeNull();
  });
});

describe('categoryOf', () => {
  it('groups question types the way students meet them', () => {
    expect(categoryOf('numerical')).toBe('numerical');
    expect(categoryOf('mcq')).toBe('conceptual');
    expect(categoryOf('structured')).toBe('written');
    expect(categoryOf(null)).toBeNull();
  });
});

describe('weakTopics', () => {
  const nodes = [
    { id: 'unit', parent_id: null, kind: 'unit' },
    { id: 'topic', parent_id: 'unit', kind: 'topic' },
    { id: 'sub', parent_id: 'topic', kind: 'subtopic' },
    { id: 'other', parent_id: 'unit', kind: 'topic' },
  ];
  const topicOf = topicResolver(nodes);

  it('folds subtopics into their topic', () => {
    expect(topicOf('sub')).toBe('topic');
    expect(topicOf('topic')).toBe('topic');
    expect(topicOf('unit')).toBe('unit');
    expect(topicOf(null)).toBeNull();
  });

  it('flags topics below the threshold with enough questions', () => {
    const records = [
      ...Array.from({ length: 6 }, (_, i) => record({ nodeId: 'sub', marks: i < 2 ? 1 : 0 })),
      ...Array.from({ length: 6 }, () => record({ nodeId: 'other', marks: 1 })),
    ];
    const weak = weakTopics(records, topicOf);
    expect(weak).toHaveLength(1);
    expect(weak[0]).toMatchObject({ topicId: 'topic', questions: 6, accuracy: 33.3 });
  });

  it('does not judge a topic on too few questions', () => {
    const records = Array.from({ length: 3 }, () => record({ nodeId: 'sub', marks: 0 }));
    expect(weakTopics(records, topicOf)).toEqual([]);
  });
});

describe('time', () => {
  it('buckets months in Colombo time', () => {
    // 20:00 UTC on 31 March is 01:30 on 1 April in Colombo.
    expect(monthKey('2026-03-31T20:00:00Z')).toBe('2026-04');
  });

  it('averages attempts per month, in order', () => {
    const timeline = monthlyTimeline([
      attempt('2026-02-01T05:00:00Z', 70),
      attempt('2026-01-10T05:00:00Z', 50),
      attempt('2026-01-20T05:00:00Z', 60),
    ]);
    expect(timeline).toEqual([
      { month: '2026-01', average: 55, attempts: 2 },
      { month: '2026-02', average: 70, attempts: 1 },
    ]);
    expect(improvement(timeline)).toBe(15);
    expect(improvement(timeline.slice(0, 1))).toBeNull();
  });
});

describe('personalBests', () => {
  it('finds the longest run of consecutive days', () => {
    const bests = personalBests(
      [
        attempt('2026-03-01T05:00:00Z', 40),
        attempt('2026-03-02T05:00:00Z', 90),
        attempt('2026-03-02T09:00:00Z', 50),
        attempt('2026-03-03T05:00:00Z', 60),
        attempt('2026-03-07T05:00:00Z', 60),
      ],
      [record(), record({ marks: 0 }), record({ answered: false, marks: 0 })],
    );
    expect(bests).toEqual({ highestPercentage: 90, questionsAnswered: 2, questionsFullyCorrect: 1, longestStreak: 3 });
  });
});

describe('summarise and histogram', () => {
  it('computes median and population standard deviation', () => {
    expect(summarise([2, 4, 4, 4, 5, 5, 7, 9])).toMatchObject({ mean: 5, median: 4.5, standardDeviation: 2 });
    expect(summarise([])).toMatchObject({ count: 0, median: null });
  });

  it('puts 100% in the top bin', () => {
    const bins = histogram([0, 9.9, 10, 95, 100]);
    expect(bins[0].count).toBe(2);
    expect(bins[1].count).toBe(1);
    expect(bins[9].count).toBe(2);
    expect(bins).toHaveLength(10);
  });
});

describe('questionStats', () => {
  it('flags only with enough attempts', () => {
    const few = Array.from({ length: 5 }, () => record({ questionId: 'easy' }));
    expect(questionStats(few)[0].flags).toEqual([]);
  });

  it('flags easy, hard and skipped questions', () => {
    const easy = Array.from({ length: 10 }, () => record({ questionId: 'easy' }));
    const hard = Array.from({ length: 10 }, (_, i) => record({ questionId: 'hard', marks: 0, answered: i < 6 }));
    const stats = Object.fromEntries(questionStats([...easy, ...hard]).map((item) => [item.questionId, item]));
    expect(stats.easy.flags).toEqual(['too-easy']);
    expect(stats.hard.flags).toEqual(['too-hard', 'often-skipped', 'often-wrong']);
    expect(stats.hard.skipRate).toBe(40);
  });
});
