import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LangTest } from '../../shared/test-schema';
import {
  deleteTest,
  dismissMistake,
  getLibrary,
  getMistakes,
  getSettings,
  getToday,
  openDatabase,
  recordAttempt,
  saveSettings,
  saveTest,
} from '../database';
import {
  notePictureSaved,
  runSync,
  type Changes,
  type LocalPicture,
  type RemoteStore,
} from './sync';

/** A shared store kept in memory, like Supabase with one user. */
function memoryStore(): RemoteStore & { pictures: Map<string, Uint8Array> } {
  const rows: { at: number; changes: Changes }[] = [];
  const pictures = new Map<string, Uint8Array>();
  let clock = 0;
  return {
    pictures,
    async uploadPicture(name, bytes) {
      pictures.clear();
      pictures.set(name, bytes);
    },
    async downloadPicture(name) {
      const bytes = pictures.get(name);
      if (!bytes) throw new Error('missing');
      return bytes;
    },
    async push(changes) {
      rows.push({ at: ++clock, changes: structuredClone(changes) });
    },
    async pull(cursor) {
      const after = cursor ? Number(cursor) : 0;
      const newer = rows.filter((row) => row.at > after);
      const changes: Changes = { attempts: [], tests: [], settings: null };
      for (const row of newer) {
        changes.attempts.push(...row.changes.attempts);
        changes.tests.push(...row.changes.tests);
        if (row.changes.settings) changes.settings = row.changes.settings;
      }
      return { changes, cursor: String(clock) };
    },
  };
}

const test: LangTest = {
  format: 'langtest',
  format_version: 1,
  test_id: 't1',
  language: 'ja',
  title: 'Sync test',
  questions: [
    {
      template: 'reading',
      prompt: '納期',
      answers: ['のうき'],
      targets: [{ expression: '納期', reading: 'のうき', skill: 'reading' }],
    },
  ],
};

function answer(db: DatabaseSync, correct: boolean, when: Date) {
  recordAttempt(
    db,
    {
      testId: 't1',
      questionIndex: 0,
      template: 'reading',
      answer: correct ? 'のうき' : 'なっき',
      correct,
      targets: test.questions[0].targets,
    },
    when,
  );
}

let pc: DatabaseSync;
let phone: DatabaseSync;
let store: ReturnType<typeof memoryStore>;
beforeEach(() => {
  pc = openDatabase(':memory:');
  phone = openDatabase(':memory:');
  store = memoryStore();
});

describe('sync between two devices', () => {
  it('brings tests, answers and settings from the PC to the phone', async () => {
    saveTest(pc, test);
    answer(pc, false, new Date(2026, 9, 1));
    saveSettings(pc, { ...getSettings(pc), topics: ['Chiikawa'] });

    expect(await runSync(pc, store)).toMatchObject({ uploaded: 3 });
    expect(await runSync(phone, store)).toMatchObject({ uploaded: 0 });

    expect(getLibrary(phone).map((t) => t.id)).toEqual(['t1']);
    expect(getMistakes(phone)).toHaveLength(1);
    expect(getSettings(phone).topics).toEqual(['Chiikawa']);
  });

  it('merges answers given on both devices and agrees on the schedule', async () => {
    saveTest(pc, test);
    await runSync(pc, store);
    await runSync(phone, store);

    answer(phone, true, new Date(2026, 9, 2));
    answer(pc, true, new Date(2026, 9, 5));
    await runSync(phone, store);
    await runSync(pc, store);
    await runSync(phone, store);

    const later = new Date(2026, 11, 1);
    expect(getToday(phone, later).due).toEqual(getToday(pc, later).due);
    expect(
      (pc.prepare('SELECT COUNT(*) AS n FROM attempts').get() as { n: number })
        .n,
    ).toBe(2);
  });

  it('is safe to run again with nothing new', async () => {
    saveTest(pc, test);
    answer(pc, false, new Date(2026, 9, 1));
    await runSync(pc, store);
    expect(await runSync(pc, store)).toMatchObject({
      uploaded: 0,
      downloaded: 0,
    });
  });

  it('carries hidden mistakes and deleted tests across', async () => {
    saveTest(pc, test);
    answer(pc, false, new Date(2026, 9, 1));
    await runSync(pc, store);
    await runSync(phone, store);

    dismissMistake(phone, getMistakes(phone)[0].id);
    deleteTest(phone, 't1');
    await runSync(phone, store);
    await runSync(pc, store);

    expect(getMistakes(pc)).toEqual([]);
    expect(getLibrary(pc)).toEqual([]);
  });

  it('keeps the newer settings when both devices changed them', async () => {
    saveSettings(pc, { ...getSettings(pc), questionCount: 10 });
    await runSync(pc, store);
    await new Promise((r) => setTimeout(r, 5));
    saveSettings(phone, { ...getSettings(phone), questionCount: 25 });
    await runSync(phone, store);
    await runSync(pc, store);
    expect(getSettings(pc).questionCount).toBe(25);
  });

  it('sends a new skin picture to the other device once', async () => {
    const pcPicture = memoryPicture(new Uint8Array([1, 2, 3]));
    const phonePicture = memoryPicture(null);
    notePictureSaved(pc, 'jpg');
    saveSettings(pc, { ...getSettings(pc), theme: 'custom' });

    await runSync(pc, store, new Date(), pcPicture);
    expect([...store.pictures.values()]).toEqual([new Uint8Array([1, 2, 3])]);

    expect(await runSync(phone, store, new Date(), phonePicture)).toMatchObject(
      { downloaded: 2 },
    );
    expect(phonePicture.bytes).toEqual(new Uint8Array([1, 2, 3]));

    // Nothing changed since, so nothing is sent or fetched again.
    phonePicture.writes = 0;
    await runSync(pc, store, new Date(), pcPicture);
    await runSync(phone, store, new Date(), phonePicture);
    expect(phonePicture.writes).toBe(0);
  });

  it('keeps the picture when the other device runs an older version', async () => {
    const phonePicture = memoryPicture(new Uint8Array([9]));
    notePictureSaved(phone, 'jpg');
    saveSettings(phone, { ...getSettings(phone), theme: 'custom' });
    await runSync(phone, store, new Date(), phonePicture);
    await new Promise((r) => setTimeout(r, 5));
    // An older PC sends settings without a picture name.
    saveSettings(pc, { ...getSettings(pc), questionCount: 20 });
    await runSync(pc, store);
    await runSync(phone, store, new Date(), phonePicture);
    expect(phonePicture.bytes).toEqual(new Uint8Array([9]));
    expect(getSettings(phone).questionCount).toBe(20);
  });
});

function memoryPicture(
  bytes: Uint8Array | null,
): LocalPicture & { bytes: Uint8Array | null; writes: number } {
  const picture = {
    bytes,
    writes: 0,
    read: async () => picture.bytes,
    write: async (next: Uint8Array) => {
      picture.bytes = next;
      picture.writes++;
    },
  };
  return picture;
}
