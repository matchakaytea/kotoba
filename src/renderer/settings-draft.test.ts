import { describe, expect, it } from 'vitest';
import { DEFAULT_BACKDROP, DEFAULT_SETTINGS } from '../shared/api';
import { differs, draftOf, settingsOf, splitTopics } from './settings-draft';

const draft = draftOf(DEFAULT_SETTINGS, DEFAULT_BACKDROP);

describe('settings drafts', () => {
  it('saves the settings it was made from unchanged', () => {
    const settings = settingsOf(draft);
    expect(settings).toMatchObject({
      level: DEFAULT_SETTINGS.level,
      topics: DEFAULT_SETTINGS.topics,
    });
    expect(
      differs(settings!, { ...DEFAULT_SETTINGS, backdrop: DEFAULT_BACKDROP }),
    ).toBe(false);
  });

  it('splits topics on English and Chinese commas', () => {
    expect(splitTopics('IT, 旅行、 food，  ,')).toEqual(['IT', '旅行', 'food']);
  });

  it('waits while a typed value is not finished', () => {
    expect(settingsOf({ ...draft, topics: ' , ' })).toBeNull();
    expect(settingsOf({ ...draft, level: '' })).toBeNull();
    expect(settingsOf({ ...draft, questionCount: 4 })).toBeNull();
    expect(settingsOf({ ...draft, questionCount: 41 })).toBeNull();
  });

  it('waits for a picture before saving the custom skin', () => {
    expect(settingsOf({ ...draft, theme: 'custom' })).toBeNull();
  });

  it('notices a change worth saving', () => {
    const saved = settingsOf(draft);
    expect(differs(settingsOf({ ...draft, questionCount: 20 })!, saved)).toBe(
      true,
    );
  });
});
