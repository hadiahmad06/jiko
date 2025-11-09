import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,          // use describe, it, expect globally
    environment: 'node',    // Node test environment
    include: ['./src/tests/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html']
    }
  },
  resolve: {
    alias: [{ find: '@', replacement: '/src' }]
  }
});