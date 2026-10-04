// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  // Formatting is Prettier's job (checked in CI); turn off conflicting style rules.
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
]);
