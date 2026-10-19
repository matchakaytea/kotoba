import { describe, expect, it } from 'vitest';
import { getLibrary, openDatabase, saveTest } from '../main/database';
import type { SyncManager } from '../main/sync/manager';
import type { LangTest } from '../shared/test-schema';
import { webApi } from './api';

const test: LangTest = {
  format: 'langtest',
  format_version: 1,
  test_id: 't1',
  language: 'ja',
  title: 'Trial test',
  questions: [
    {
      template: 'reading',
      prompt: '納期',
      answers: ['のうき'],
      targets: [{ expression: '納期', reading: 'のうき', skill: 'reading' }],
    },
  ],
};

function api(signedIn: boolean) {
  const db = openDatabase(':memory:');
  saveTest(db, test);
  const sync = {
    signedIn: async () => signedIn,
    schedule: () => {},
  } as unknown as SyncManager;
  return { db, kotoba: webApi(db, sync, new Set()) };
}

const answer = {
  testId: 't1',
  questionIndex: 0,
  template: 'reading' as const,
  answer: 'なっき',
  correct: false,
  targets: test.questions[0].targets,
};

describe('signed out', () => {
  it('keeps no answers', async () => {
    const { kotoba } = api(false);
    await kotoba.saveAttempt(answer);
    expect(await kotoba.getMistakes()).toEqual([]);
    expect((await kotoba.getSummary()).attempts).toBe(0);
  });

  it('leaves tests in place', async () => {
    const { db, kotoba } = api(false);
    await kotoba.deleteTest('t1');
    expect(getLibrary(db).map((t) => t.id)).toEqual(['t1']);
  });
});

describe('signed in', () => {
  it('keeps answers and test changes', async () => {
    const { db, kotoba } = api(true);
    await kotoba.saveAttempt(answer);
    expect((await kotoba.getSummary()).attempts).toBe(1);
    await kotoba.deleteTest('t1');
    expect(getLibrary(db)).toEqual([]);
  });
});
