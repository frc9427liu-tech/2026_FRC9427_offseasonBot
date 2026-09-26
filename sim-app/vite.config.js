import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  publicDir: 'public',
  base: './',
  server: { host: true, port: 5173 },
  build: { outDir: '../dist', emptyOutDir: true },
});
