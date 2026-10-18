import { contextBridge, ipcRenderer } from 'electron';
import type { KotobaApi } from './shared/api';

const api: KotobaApi = {
  platform: 'desktop',
  saveAttempt: (input) => ipcRenderer.invoke('attempt:save', input),
  getSummary: () => ipcRenderer.invoke('summary:get'),
  getToday: () => ipcRenderer.invoke('today:get'),
  getSession: () => ipcRenderer.invoke('session:get'),
  importInbox: () => ipcRenderer.invoke('inbox:import'),
  dismissImportReport: () => ipcRenderer.invoke('inbox:dismiss'),
  openInbox: () => ipcRenderer.invoke('inbox:open'),
  copyBrief: () => ipcRenderer.invoke('brief:copy'),
  claudeStatus: () => ipcRenderer.invoke('claude:status'),
  generateTest: () => ipcRenderer.invoke('claude:generate'),
  getMistakes: () => ipcRenderer.invoke('mistakes:get'),
  dismissMistake: (id) => ipcRenderer.invoke('mistakes:dismiss', id),
  getLibrary: () => ipcRenderer.invoke('library:get'),
  deleteTest: (testId) => ipcRenderer.invoke('library:delete', testId),
  translateTest: (testId) => ipcRenderer.invoke('library:translate', testId),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  pickPicture: () => ipcRenderer.invoke('picture:pick'),
  getVocabSummary: () => ipcRenderer.invoke('vocab:summary'),
  getOtherWords: () => ipcRenderer.invoke('vocab:others'),
  saveSkinPicture: (dataUrl) => ipcRenderer.invoke('skin:savePicture', dataUrl),
  getSkinPicture: () => ipcRenderer.invoke('skin:picture'),
  backupData: () => ipcRenderer.invoke('data:backup'),
  pickBackup: () => ipcRenderer.invoke('data:pickRestore'),
  restoreData: () => ipcRenderer.invoke('data:restore'),
  openDataFolder: () => ipcRenderer.invoke('data:openFolder'),
  searchVocab: (query) => ipcRenderer.invoke('vocab:search', query),
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  configureSync: (config) => ipcRenderer.invoke('sync:configure', config),
  signIn: (credentials) => ipcRenderer.invoke('sync:signIn', credentials),
  signUp: (credentials) => ipcRenderer.invoke('sync:signUp', credentials),
  signOut: () => ipcRenderer.invoke('sync:signOut'),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  onSynced: (listener) => {
    const handler = () => listener();
    ipcRenderer.on('sync:changed', handler);
    return () => ipcRenderer.removeListener('sync:changed', handler);
  },
};

contextBridge.exposeInMainWorld('kotoba', api);
