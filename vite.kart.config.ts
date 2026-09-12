import { defineConfig } from 'vite';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  root: realpathSync('packages/games/kart-party'), base: '/kart-party/', publicDir: false,
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: resolve('dist/client/kart-party'), emptyOutDir: true },
});
