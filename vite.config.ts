/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'data',
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
