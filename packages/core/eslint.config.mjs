import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['coverage/', 'dist/', 'jest.config.js'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Allow `const { omitted: _, ...rest } = obj` and deliberately unused `_args`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
);
