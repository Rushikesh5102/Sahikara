/**
 * SAHIKARA Observer — Security Verification Tests
 *
 * CRITICAL: This test suite verifies that the observation engine contains
 * ZERO transaction-signing or private-key-handling code.
 *
 * Tests scan every TypeScript source file in scanner/src/ for banned patterns:
 *   - privateKey (any form)
 *   - signTransaction
 *   - sendTransaction
 *   - sendRawTransaction
 *   - signMessage
 *   - new Wallet(
 *   - Wallet(  (ethers.js / viem wallet patterns)
 *   - createWalletClient (viem wallet client — signing-capable)
 *   - eth_sendRawTransaction (RPC method for broadcasting)
 *   - eth_sendTransaction    (RPC method for signing+sending)
 *
 * A single match in ANY source file is a test FAILURE.
 *
 * This test must pass before Phase 1C can be declared complete.
 * It runs as part of `npm test` — not a separate step.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// File Scanner Utility
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SRC_DIR = join(__dirname, '..', 'src');

function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllTypeScriptFiles(fullPath));
    } else if (extname(entry) === '.ts') {
      files.push(fullPath);
    }
  }
  return files;
}

// ─────────────────────────────────────────────────────────────────────────────
// Banned Patterns
// ─────────────────────────────────────────────────────────────────────────────

interface BannedPattern {
  pattern: RegExp;
  description: string;
  severity: 'CRITICAL' | 'HIGH';
}

const BANNED_PATTERNS: BannedPattern[] = [
  {
    pattern: /privateKey/g,
    description: 'Private key identifier — must never appear in observation engine source',
    severity: 'CRITICAL',
  },
  {
    pattern: /signTransaction/g,
    description: 'Transaction signing — observation engine cannot sign transactions',
    severity: 'CRITICAL',
  },
  {
    pattern: /sendTransaction/g,
    description: 'Transaction submission — observation engine cannot send transactions',
    severity: 'CRITICAL',
  },
  {
    pattern: /sendRawTransaction/g,
    description: 'Raw transaction broadcast — observation engine cannot broadcast',
    severity: 'CRITICAL',
  },
  {
    pattern: /signMessage/g,
    description: 'Message signing — observation engine has no signing capability',
    severity: 'CRITICAL',
  },
  {
    pattern: /new\s+Wallet\s*\(/g,
    description: 'Wallet instantiation — only publicClient is permitted',
    severity: 'CRITICAL',
  },
  {
    pattern: /createWalletClient/g,
    description: 'viem wallet client (signing-capable) — only publicClient permitted',
    severity: 'CRITICAL',
  },
  {
    pattern: /eth_sendRawTransaction/g,
    description: 'RPC broadcast method — read-only engine must never call this',
    severity: 'CRITICAL',
  },
  {
    pattern: /eth_sendTransaction/g,
    description: 'RPC send method — read-only engine must never call this',
    severity: 'CRITICAL',
  },
  {
    pattern: /mnemonic/gi,
    description: 'Mnemonic seed phrase — forbidden from all source files',
    severity: 'CRITICAL',
  },
  {
    pattern: /from\s*:\s*'0x[0-9a-fA-F]{64}'/g,
    description: 'Hardcoded private key (hex) — forbidden',
    severity: 'CRITICAL',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Security Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Security: No transaction signing or private key code in scanner/src/', () => {
  const sourceFiles = getAllTypeScriptFiles(SRC_DIR);

  // Verify we found source files (sanity check)
  it('finds TypeScript source files to scan', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
    console.log(`[Security] Scanning ${sourceFiles.length} TypeScript source files in scanner/src/`);
    for (const f of sourceFiles) {
      console.log(`  - ${f.replace(SRC_DIR, 'src/')}`);
    }
  });

  // One test per banned pattern — each must pass independently
  for (const { pattern, description, severity } of BANNED_PATTERNS) {
    it(`[${severity}] No "${pattern.source}" in any source file`, () => {
      const violations: string[] = [];

      for (const file of sourceFiles) {
        const content = readFileSync(file, 'utf-8');
        const matches = content.match(pattern);

        if (matches && matches.length > 0) {
          // Find line numbers for better diagnostics
          const lines = content.split('\n');
          const matchingLines: string[] = [];
          lines.forEach((line, idx) => {
            // Reset regex lastIndex for each line test
            const linePattern = new RegExp(pattern.source, 'g');
            if (linePattern.test(line)) {
              matchingLines.push(`  Line ${idx + 1}: ${line.trim()}`);
            }
          });

          violations.push(
            `FILE: ${file.replace(SRC_DIR, 'src/')}\n` +
            matchingLines.join('\n')
          );
        }
      }

      if (violations.length > 0) {
        const message =
          `[SECURITY FAILURE] Banned pattern "${pattern.source}" found:\n` +
          `Description: ${description}\n` +
          `Violations:\n${violations.join('\n\n')}`;
        expect.fail(message);
      }

      // If no violations — test passes silently
      expect(violations.length).toBe(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional Security Invariants
// ─────────────────────────────────────────────────────────────────────────────

describe('Security: viem client usage verification', () => {
  it('scanner/src uses createPublicClient (not createWalletClient)', () => {
    const sourceFiles = getAllTypeScriptFiles(SRC_DIR);
    let publicClientUsed = false;

    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('createPublicClient')) {
        publicClientUsed = true;
      }
    }

    // At least one file must use publicClient (RpcDataSource.ts)
    expect(publicClientUsed).toBe(true);
  });

  it('no file imports from viem/accounts (signing module)', () => {
    const sourceFiles = getAllTypeScriptFiles(SRC_DIR);
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes("from 'viem/accounts'") || content.includes('from "viem/accounts"')) {
        violations.push(file.replace(SRC_DIR, 'src/'));
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `[SECURITY] viem/accounts import found in: ${violations.join(', ')}. ` +
        `The observation engine must not import signing modules.`
      );
    }
    expect(violations.length).toBe(0);
  });
});

describe('Security: .env.example contains no real credentials', () => {
  it('.env.example has no non-empty values for RPC URL variables', () => {
    const envExamplePath = join(__dirname, '..', '.env.example');
    const content = readFileSync(envExamplePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed === '') continue;

      // Parse KEY=VALUE
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();

      // Sensitive keys must have empty values in the example file
      const sensitiveKeys = ['BASE_RPC_URL', 'BASE_WS_URL', 'BASE_RPC_URL_SECONDARY', 'RPC_ENDPOINT_ID'];
      if (sensitiveKeys.includes(key) && value !== '') {
        expect.fail(
          `[SECURITY] .env.example has a non-empty value for sensitive key "${key}". ` +
          `Example files must contain placeholder names only, never real credentials.`
        );
      }
    }

    // Test passes if no violation found
    expect(true).toBe(true);
  });
});
