import type { KotobaApi } from '../shared/api';

declare global {
  interface Window {
    kotoba: KotobaApi;
  }
}

export {};
