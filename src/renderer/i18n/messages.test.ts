import { describe, expect, it } from 'vitest';
import { MESSAGES, translate } from './messages';

describe('translate', () => {
  it('fills in parameters', () => {
    expect(translate('en', 'today.dueCount', { count: 5 })).toBe('5 due today');
    expect(translate('ko', 'today.dueCount', { count: 5 })).toBe(
      '오늘 복습할 항목 5개',
    );
  });

  it('uses the English singular form for a count of one', () => {
    expect(translate('en', 'today.answers', { count: 1 })).toBe('1 answer');
    expect(translate('en', 'today.answers', { count: 2 })).toBe('2 answers');
  });

  it('has no singular forms where the language does not need them', () => {
    expect(translate('zh-Hans', 'today.answers', { count: 1 })).toBe(
      '1 次作答',
    );
  });

  it('leaves unknown placeholders alone', () => {
    expect(translate('en', 'status.overdue')).toBe('overdue since {date}');
  });
});

describe('message tables', () => {
  it('fill every placeholder that English uses', () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [language, { all }] of Object.entries(MESSAGES)) {
      for (const [key, text] of Object.entries(MESSAGES.en.all)) {
        expect(
          placeholders(all[key as keyof typeof all]),
          `${language} ${key}`,
        ).toEqual(placeholders(text));
      }
    }
  });
});
