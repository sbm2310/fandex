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
    env: { NODE_ENV: 'test', DATABASE_URL: TEST_DATABASE_URL },
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
  },
});
