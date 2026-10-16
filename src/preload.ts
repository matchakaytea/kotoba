import { contextBridge, ipcRenderer } from 'electron';
import type { KotobaApi } from './shared/api';

const api: KotobaApi = {
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
  getLibrary: () => ipcRenderer.invoke('library:get'),
  deleteTest: (testId) => ipcRenderer.invoke('library:delete', testId),
  translateTest: (testId) => ipcRenderer.invoke('library:translate', testId),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  pickPicture: () => ipcRenderer.invoke('picture:pick'),
};

contextBridge.exposeInMainWorld('kotoba', api);
