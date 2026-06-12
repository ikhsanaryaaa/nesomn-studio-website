import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/', '**/build/', '**/out/', '**/node_modules/'] },

  // Base JS + TS rules for all workspaces
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React-specific rules (scoped to client)
  {
    files: ['client/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
    languageOptions: {
      globals: globals.browser,
    },
  },

  // Node/Bun globals for server-side
  {
    files: ['api/**/*.ts', 'worker/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        Bun: 'readonly',
      },
    },
  },

  // Disable formatting rules that conflict with Prettier
  prettier,
);
