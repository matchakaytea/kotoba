import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The web version: the same app, run in a browser with its data in IndexedDB.
// `npm run web` serves it locally; `npm run web:build` writes dist-web/.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'node:sqlite': fileURLToPath(
        new URL('./src/web/node-sqlite-stub.ts', import.meta.url),
      ),
    },
  },
  build: {
    outDir: 'dist-web',
    rollupOptions: { input: 'web.html' },
  },
  server: { port: 5180, open: '/web.html' },
});
