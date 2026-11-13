// SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
// SPDX-License-Identifier: Apache-2.0

// ESLint flat config. `npm run lint` runs it with --max-warnings 0, so a warning fails CI like an error.
// Site scripts are classic browser scripts (no modules, no build step); tests and tools are Node ES modules.
import js from '@eslint/js';
import globals from 'globals';

const shared = {
  // CONTRIBUTING.md: no code from strings, no unused code, strict equality except the null check idiom
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-unused-vars': ['error', { caughtErrors: 'none', ignoreRestSiblings: true }],
  eqeqeq: ['error', 'smart'],
};

export default [
  { ignores: ['node_modules/', 'test-results/', 'playwright-report/', 'coverage/', '.coverage/', '.qa/'] },
  js.configs.recommended,
  {
    files: ['site/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      // sanad-core.js also runs under Node for the unit tests (module.exports)
      globals: { ...globals.browser, module: 'readonly' },
    },
    rules: shared,
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
    rules: shared,
  },
  {
    // page.evaluate callbacks in the browser tests run in the page
    files: ['tests/e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
