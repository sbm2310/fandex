import { defineConfig } from 'tsdown';

// Builds dist/ for Node consumers (the API). The app, Metro and all test runners read the
// TypeScript source directly via the "source"/"react-native"/"browser" export conditions.
export default defineConfig({
  // The curated figure list is its own entry, so the app's bundle never includes it.
  entry: { index: 'src/index.ts', 'figure-seed': 'src/figures/figure-seed.ts' },
  format: 'esm',
  platform: 'neutral',
  dts: true,
  clean: true,
});
