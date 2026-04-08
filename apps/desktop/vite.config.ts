import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@dj-vault/core': path.resolve(rootDir, '../../packages/core/src/index.ts'),
      '@dj-vault/corpus': path.resolve(rootDir, '../../packages/corpus/src/index.ts'),
    },
  },
});
