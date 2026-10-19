import type { DatabaseSync } from 'node:sqlite';
import {
  AttemptInput,
  Settings,
  VocabQuery,
  type KotobaApi,
} from '../shared/api';
import {
  buildSession,
  deleteTest,
  dismissMistake,
  getLibrary,
  getMistakes,
  getSettings,
  getSummary,
  getToday,
  recordAttempt,
  saveSettings,
} from '../main/database';
import type { SyncManager } from '../main/sync/manager';
import { notePictureSaved } from '../main/sync/sync';
import {
  otherWords,
  searchVocab,
  vocabSummary,
  withReadings,
  wordStatuses,
} from '../main/vocab';
import { loadPicture, savePicture } from './storage';

const DESKTOP_ONLY = 'This only works in the Kotoba desktop app.';

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the picture.'));
    reader.readAsDataURL(file);
  });
}

/** The same API the desktop app's window gets, answered inside the browser. */
export function webApi(
  db: DatabaseSync,
  sync: SyncManager,
  onSynced: Set<() => void>,
): KotobaApi {
  const changed = () => sync.schedule();
  return {
    platform: 'web',
    // Signed out, nothing the learner does is kept (see SyncManager.signedIn).
    saveAttempt: async (input) => {
      const attempt = AttemptInput.parse(input);
      if (!(await sync.signedIn())) return;
      recordAttempt(db, attempt);
      changed();
    },
    getSummary: async () => getSummary(db),
    getToday: async () => getToday(db),
    getSession: async () => buildSession(db),
    importInbox: async () => ({ imported: [], rejected: [] }),
    dismissImportReport: async () => {},
    openInbox: async () => {
      throw new Error(DESKTOP_ONLY);
    },
    copyBrief: async () => {
      throw new Error(DESKTOP_ONLY);
    },
    claudeStatus: async () => ({ found: false }),
    generateTest: async () => {
      throw new Error(DESKTOP_ONLY);
    },
    getMistakes: async () => withReadings(getMistakes(db)),
    dismissMistake: async (id) => {
      if (await sync.signedIn()) {
        dismissMistake(db, id);
        changed();
      }
      return withReadings(getMistakes(db));
    },
    getLibrary: async () => getLibrary(db),
    deleteTest: async (testId) => {
      if (await sync.signedIn()) {
        deleteTest(db, testId);
        changed();
      }
      return getLibrary(db);
    },
    translateTest: async () => {
      throw new Error(DESKTOP_ONLY);
    },
    getSettings: async () => getSettings(db),
    saveSettings: async (settings) => {
      const saved = saveSettings(db, Settings.parse(settings));
      changed();
      return saved;
    },
    pickPicture: async () => {
      const file = await pickFile('image/*');
      if (!file) return null;
      if (file.size > 15 * 1024 * 1024) {
        throw new Error('That picture is larger than 15 MB.');
      }
      return readAsDataUrl(file);
    },
    saveSkinPicture: async (dataUrl) => {
      const type = /^data:image\/(jpeg|png|webp|gif|bmp);base64,/.exec(dataUrl);
      if (!type) throw new Error('That is not a picture Kotoba can use.');
      await savePicture(dataUrl);
      notePictureSaved(db, type[1] === 'jpeg' ? 'jpg' : type[1]);
    },
    getSkinPicture: () => loadPicture(),
    getVocabSummary: async () => vocabSummary(wordStatuses(db)),
    searchVocab: async (query) =>
      searchVocab(VocabQuery.parse(query), wordStatuses(db)),
    getOtherWords: async () => otherWords(db),
    backupData: async () => {
      throw new Error(DESKTOP_ONLY);
    },
    pickBackup: async () => {
      throw new Error(DESKTOP_ONLY);
    },
    restoreData: async () => {
      throw new Error(DESKTOP_ONLY);
    },
    openDataFolder: async () => {
      throw new Error(DESKTOP_ONLY);
    },
    syncStatus: () => sync.status(),
    configureSync: (config) => sync.configure(config),
    signIn: (credentials) => sync.signIn(credentials),
    signUp: (credentials) => sync.signUp(credentials),
    signOut: () => sync.signOut(),
    syncNow: () => sync.syncNow(true),
    onSynced: (listener) => {
      onSynced.add(listener);
      return () => onSynced.delete(listener);
    },
    // The web version is always the latest one Cloudflare serves.
    getUpdateState: async () => ({ status: 'unsupported' }),
    checkForUpdates: async () => ({ status: 'unsupported' }),
    installUpdate: async () => {},
    onUpdateState: () => () => {},
  };
}
