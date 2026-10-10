import { defineConfig } from 'vitest/config';

// Unit and simulation tests: pure game logic runs in Node; files that need a DOM opt in
// with a `// @vitest-environment jsdom` comment at the top.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
