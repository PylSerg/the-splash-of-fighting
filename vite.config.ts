import { defineConfig } from 'vite';
export default defineConfig({
  base: '/the-splash-of-fighting/',
  build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: 0 }
});
