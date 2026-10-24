// eslint.config.mjs
// Keep lint focused on defects; Prettier owns layout and line wrapping.
import globals from 'globals';

const defectRules = {
  'no-constant-binary-expression': 'error',
  'no-debugger': 'error',
  'no-dupe-else-if': 'error',
  'no-unsafe-finally': 'error',
  'no-unreachable': 'error',
};

export default [
  {
    ignores: ['node_modules/**', 'test-results/**', 'playwright-report/**', 'evidence/**'],
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      sourceType: 'module',
    },
    rules: defectRules,
  },
  {
    files: ['signalk-plugin-telltales/**/*.js'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
    rules: defectRules,
  },
];
