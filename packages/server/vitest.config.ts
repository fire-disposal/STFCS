import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,js}'],
  },
  resolve: {
    alias: {
      '@vt/contracts': path.resolve(__dirname, '../contracts/src'),
      '@vt/rules': path.resolve(__dirname, '../rules/src'),
    },
  },
});
