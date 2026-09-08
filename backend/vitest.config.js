import { defineConfig } from 'vitest/config';
import path from 'path';

const alias = [{ find: '@', replacement: path.resolve(import.meta.dirname, 'src') }];

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: { reporter: ['text', 'json', 'html'] },
    projects: [
      {
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['src/tests/unit/**/*.test.ts'],
        },
        resolve: { alias },
      },
      {
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          include: ['src/tests/integration/**/*.test.ts'],
          // integration tests share one Postgres/DDB; run files serially
          fileParallelism: false,
          setupFiles: ['src/tests/integration/setup.ts'],
        },
        resolve: { alias },
      },
    ],
  },
});
