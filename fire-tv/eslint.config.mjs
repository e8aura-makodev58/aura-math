import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {ignores: ['node_modules/**', 'build/**', 'src/generated/**']},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', '__tests__/**/*.ts', '*.js', 'scripts/**/*.js'],
    languageOptions: {globals: {...globals.node, ...globals.es2021}},
  },
  {
    // Metro, Babel and Node scripts are CommonJS by design.
    files: ['*.js', 'scripts/**/*.js'],
    rules: {'@typescript-eslint/no-require-imports': 'off'},
  },
);
