import { defineConfig } from 'vitest/config';

// Backend tests run in Node against an in-memory S3 (tests/helpers/s3Mock.ts).
// globals keeps describe/it/expect/vi available without imports, as Jest did.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['services/**', 'routes/**'] },
  },
});
