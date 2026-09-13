// @ts-check

/**
 * SAHIKARA Observer — ESLint Security Configuration
 *
 * Enforces:
 * 1. TypeScript strict type checking
 * 2. Banned patterns for transaction signing / private key handling
 *    (structurally prevents accidental signer code from entering codebase)
 */

import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
    },
    rules: {
      // TypeScript strict rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',

      // ============================================================
      // SECURITY: BAN TRANSACTION SIGNING AND PRIVATE KEY PATTERNS
      // These identifiers must never appear in scanner/src/
      // Violation = immediate build failure
      // ============================================================
      'no-restricted-syntax': [
        'error',
        {
          selector: "Identifier[name='privateKey']",
          message:
            '[SECURITY] "privateKey" identifier is banned in the observation engine. This component is read-only and must not handle private keys.',
        },
        {
          selector: "Identifier[name='signTransaction']",
          message:
            '[SECURITY] "signTransaction" is banned. The observation engine cannot sign transactions.',
        },
        {
          selector: "Identifier[name='sendTransaction']",
          message:
            '[SECURITY] "sendTransaction" is banned. The observation engine cannot submit transactions.',
        },
        {
          selector: "Identifier[name='sendRawTransaction']",
          message:
            '[SECURITY] "sendRawTransaction" is banned. The observation engine cannot submit raw transactions.',
        },
        {
          selector: "Identifier[name='signMessage']",
          message:
            '[SECURITY] "signMessage" is banned in the observation engine.',
        },
        {
          selector: "CallExpression[callee.name='Wallet']",
          message:
            '[SECURITY] Wallet instantiation is banned. Use viem publicClient (read-only) only.',
        },
        {
          selector: "NewExpression[callee.name='Wallet']",
          message:
            '[SECURITY] Wallet instantiation is banned. Use viem publicClient (read-only) only.',
        },
      ],
    },
  },
];
