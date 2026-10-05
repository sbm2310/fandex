import { defineConfig } from 'tsdown';

// Builds dist/ for Node consumers (the API). The app, Metro and all test runners read the
// TypeScript source directly via the "source"/"react-native"/"browser" export conditions.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'neutral',
  dts: true,
  clean: true,
});
