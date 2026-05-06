// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

export default [{
  ignores: ['dist/**', 'node_modules/**', '*.config.ts', '*.config.js', 'build/**', 'src/__tests__/**'],
}, {
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    globals: {
      console: 'readonly',
      document: 'readonly',
      window: 'readonly',
      setTimeout: 'readonly',
      clearTimeout: 'readonly',
      setInterval: 'readonly',
      clearInterval: 'readonly',
      fetch: 'readonly',
      URL: 'readonly',
      URLSearchParams: 'readonly',
      HTMLElement: 'readonly',
      IntersectionObserver: 'readonly',
      Map: 'readonly',
      Set: 'readonly',
      Promise: 'readonly',
      Date: 'readonly',
      JSON: 'readonly',
      localStorage: 'readonly',
      KeyboardEvent: 'readonly',
      Event: 'readonly',
      navigator: 'readonly',
      RequestInit: 'readonly',
      Response: 'readonly',
      Headers: 'readonly',
      AbortController: 'readonly',
      HTMLDivElement: 'readonly',
      DOMRectReadOnly: 'readonly',
      IntersectionObserverEntry: 'readonly',
      IntersectionObserverCallback: 'readonly',
      MutationObserver: 'readonly',
      ResizeObserver: 'readonly',
      requestAnimationFrame: 'readonly',
      cancelAnimationFrame: 'readonly',
      queueMicrotask: 'readonly',
      global: 'readonly',
      globalThis: 'readonly',
      structuredClone: 'readonly',
      alert: 'readonly',
      HTMLInputElement: 'readonly',
      NodeJS: 'readonly',
      JSX: 'readonly',
    },
  },
  plugins: {
    '@typescript-eslint': typescript,
    'react-hooks': reactHooks,
    'import': importPlugin,
  },
  rules: {
    ...js.configs.recommended.rules,
    ...typescript.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'import/no-duplicates': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'no-restricted-globals': 'off',
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
    },
  },
}, ...storybook.configs["flat/recommended"]];
