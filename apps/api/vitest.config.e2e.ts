import { defineConfig } from 'vitest/config';

import { TEST_DATABASE_URL } from './test/test-database.js';
import { sharedConfig } from './vitest.config.js';

export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // process.env takes precedence over .env, so the app under test uses the test database.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      // Test-only secret (not used anywhere else).
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-1234',
      BETTER_AUTH_URL: 'http://localhost:3000',
      TRUSTED_ORIGINS: 'http://localhost:8081,fandex://',
    },
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
  },
});
