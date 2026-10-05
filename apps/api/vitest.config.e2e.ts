import { defineConfig } from 'vitest/config';

import { sharedConfig } from './vitest.config.js';

export default defineConfig({
  ...sharedConfig,
  test: { ...sharedConfig.test, include: ['test/**/*.e2e-spec.ts'] },
});
