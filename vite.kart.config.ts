import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  root: 'modules/kart-party', base: '/kart-party/', publicDir: false,
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: '../../dist/client/kart-party', emptyOutDir: true },
});
