import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: false,
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
