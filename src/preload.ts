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
};

contextBridge.exposeInMainWorld('kotoba', api);
