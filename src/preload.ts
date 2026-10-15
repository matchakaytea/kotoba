import { contextBridge, ipcRenderer } from 'electron';
import type { KotobaApi } from './shared/api';

const api: KotobaApi = {
  saveAttempt: (input) => ipcRenderer.invoke('attempt:save', input),
  getSummary: () => ipcRenderer.invoke('summary:get'),
  getToday: () => ipcRenderer.invoke('today:get'),
};

contextBridge.exposeInMainWorld('kotoba', api);
