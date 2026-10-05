import { defineConfig } from 'vitest/config';

// Shared by unit and e2e configs. The "source" condition makes @fandex/core resolve to its
// TypeScript source, so tests don't need core to be built first.
export const sharedConfig = defineConfig({
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: { globals: true, root: './' },
});

export default defineConfig({
  ...sharedConfig,
  test: { ...sharedConfig.test, include: ['src/**/*.spec.ts'] },
});
