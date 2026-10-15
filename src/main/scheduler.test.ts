import { describe, expect, it } from 'vitest';
import { localDay, parseCard, review, serializeCard } from './scheduler';

const monday = new Date(2026, 9, 12, 9, 0);

function daysAfter(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

describe('localDay', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('review', () => {
  it('schedules a new correct target a few days out', () => {
    const state = review(null, true, monday)!;
    expect(state.lastReviewDay).toBe('2026-10-12');
    expect(state.dueDay > '2026-10-13').toBe(true);
  });

  it('brings a new wrong target back the next day', () => {
    const state = review(null, false, monday)!;
    expect(state.dueDay).toBe('2026-10-13');
  });

  it('ignores a second review on the same day', () => {
    const first = review(null, false, monday)!;
    const later = new Date(2026, 9, 12, 21, 0);
    expect(review(first, true, later)).toBeNull();
  });

  it('pushes the next review further out after each success', () => {
    const first = review(null, true, monday)!;
    const second = review(first, true, first.card.due)!;
    const gapFirst = first.card.scheduled_days;
    const gapSecond = second.card.scheduled_days;
    expect(gapSecond).toBeGreaterThan(gapFirst);
  });

  it('shortens the interval after a lapse', () => {
    let state = review(null, true, monday)!;
    state = review(state, true, state.card.due)!;
    const before = state.card.scheduled_days;
    const lapsed = review(state, false, state.card.due)!;
    expect(lapsed.card.scheduled_days).toBeLessThan(before);
    expect(lapsed.card.lapses).toBe(1);
  });

  it('accepts a review the day after a wrong answer', () => {
    const first = review(null, false, monday)!;
    expect(review(first, true, daysAfter(monday, 1))).not.toBeNull();
  });
});

describe('card serialization', () => {
  it('round-trips through JSON with real dates', () => {
    const { card } = review(null, true, monday)!;
    const restored = parseCard(serializeCard(card));
    expect(restored.due).toBeInstanceOf(Date);
    expect(restored.due.getTime()).toBe(card.due.getTime());
    expect(restored.stability).toBe(card.stability);
  });
});
