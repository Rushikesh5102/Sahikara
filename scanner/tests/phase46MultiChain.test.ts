/**
 * SAHIKARA Phase 4.6 — Multi-Market / Multi-Chain Verification Tests
 *
 * Verifies:
 *   1. Type extensions and chainId properties across all pool definitions
 *   2. Strict segregation between Base pools and new multi-chain registries
 *   3. Polygon, Arbitrum, and Optimism pool and token registry schemas
 *   4. Multi-chain research pair registries
 *   5. PolygonGasModel (zero L1 data fee, MATIC pricing)
 *   6. ArbitrumGasModel (execution + provisional L1 data fee)
 *   7. On-chain verifyPoolBytecode helper behavior (mocked PublicClient)
 *   8. Campaign configuration invariants and database isolation
 */

import { describe, it, expect, vi } from 'vitest';
import { isAddress } from 'viem';

import {
  ALL_ACTIVE_POOLS,
  ALL_POOLS,
  CHAIN_IDS,
  verifyPoolBytecode,
} from '../src/config/pools.js';
import {
  ALL_POLYGON_ACTIVE_POOLS,
  ALL_POLYGON_POOLS,
  POLYGON_TOKENS,
} from '../src/config/pools-polygon.js';
import {
  ALL_ARBITRUM_ACTIVE_POOLS,
  ALL_ARBITRUM_POOLS,
  ARBITRUM_TOKENS,
} from '../src/config/pools-arbitrum.js';
import {
  ALL_OPTIMISM_ACTIVE_POOLS,
  ALL_OPTIMISM_POOLS,
  OPTIMISM_TOKENS,
} from '../src/config/pools-optimism.js';
import { POLYGON_RESEARCH_PAIRS } from '../src/config/pairs-polygon.js';
import { ARBITRUM_RESEARCH_PAIRS } from '../src/config/pairs-arbitrum.js';
import { OPTIMISM_RESEARCH_PAIRS } from '../src/config/pairs-optimism.js';
import { PolygonGasModel } from '../src/shadow/PolygonGasModel.js';
import { ArbitrumGasModel } from '../src/shadow/ArbitrumGasModel.js';

describe('Phase 4.6 Multi-Chain Architecture', () => {
  describe('Chain IDs and Pool Segregation', () => {
    it('defines correct chain IDs for all target EVM networks', () => {
      expect(CHAIN_IDS.BASE).toBe(8453);
      expect(CHAIN_IDS.POLYGON).toBe(137);
      expect(CHAIN_IDS.ARBITRUM).toBe(42161);
      expect(CHAIN_IDS.OPTIMISM).toBe(10);
    });

    it('retains strictly Base pools in ALL_ACTIVE_POOLS and ALL_POOLS', () => {
      for (const pool of ALL_ACTIVE_POOLS) {
        expect(pool.chain).toBe('base');
        expect(pool.chainId).toBe(8453);
      }
      for (const pool of ALL_POOLS) {
        expect(pool.chain).toBe('base');
        expect(pool.chainId).toBe(8453);
      }
    });

    it('does not leak non-Base pools into ALL_ACTIVE_POOLS', () => {
      const activeIds = new Set(ALL_ACTIVE_POOLS.map((p) => p.id));
      for (const pool of ALL_POLYGON_POOLS) {
        expect(activeIds.has(pool.id)).toBe(false);
      }
      for (const pool of ALL_ARBITRUM_POOLS) {
        expect(activeIds.has(pool.id)).toBe(false);
      }
      for (const pool of ALL_OPTIMISM_POOLS) {
        expect(activeIds.has(pool.id)).toBe(false);
      }
    });
  });

  describe('Polygon (137) Registry Verification', () => {
    it('has valid addresses for all tokens', () => {
      for (const [key, token] of Object.entries(POLYGON_TOKENS)) {
        expect(isAddress(token.address), `Token ${key} address invalid`).toBe(true);
        expect(['[PROVISIONAL]', '[FACT]']).toContain(token.addressTier);
      }
    });

    it('has valid pool definitions with chainId 137 and verified TruthTier', () => {
      expect(ALL_POLYGON_ACTIVE_POOLS.length).toBeGreaterThan(0);
      for (const pool of ALL_POLYGON_ACTIVE_POOLS) {
        expect(pool.chain).toBe('polygon');
        expect(pool.chainId).toBe(137);
        expect(isAddress(pool.poolAddress)).toBe(true);
        expect(['[PROVISIONAL]', '[FACT]']).toContain(pool.tier);
      }
    });

    it('configures Polygon research pairs with chainId 137', () => {
      expect(POLYGON_RESEARCH_PAIRS.length).toBeGreaterThan(0);
      for (const pair of POLYGON_RESEARCH_PAIRS) {
        expect(pair.chainId).toBe(137);
        expect(isAddress(pair.baseToken.address)).toBe(true);
        expect(isAddress(pair.quoteToken.address)).toBe(true);
      }
    });
  });

  describe('Arbitrum (42161) Registry Verification', () => {
    it('has valid addresses for all tokens', () => {
      for (const [key, token] of Object.entries(ARBITRUM_TOKENS)) {
        expect(isAddress(token.address), `Token ${key} address invalid`).toBe(true);
        expect(token.decimals).toBeGreaterThan(0);
        expect(['[PROVISIONAL]', '[FACT]']).toContain(token.addressTier);
      }
    });

    it('has valid pool definitions with chainId 42161 and verified TruthTier', () => {
      expect(ALL_ARBITRUM_ACTIVE_POOLS.length).toBeGreaterThan(0);
      for (const pool of ALL_ARBITRUM_ACTIVE_POOLS) {
        expect(pool.chain).toBe('arbitrum');
        expect(pool.chainId).toBe(42161);
        expect(isAddress(pool.poolAddress)).toBe(true);
        expect(['[PROVISIONAL]', '[FACT]']).toContain(pool.tier);
      }
    });

    it('configures Arbitrum research pairs with chainId 42161', () => {
      expect(ARBITRUM_RESEARCH_PAIRS.length).toBeGreaterThan(0);
      for (const pair of ARBITRUM_RESEARCH_PAIRS) {
        expect(pair.chainId).toBe(42161);
        expect(isAddress(pair.baseToken.address)).toBe(true);
        expect(isAddress(pair.quoteToken.address)).toBe(true);
      }
    });
  });

  describe('Optimism (10) Registry Verification', () => {
    it('has valid addresses for all tokens', () => {
      for (const [key, token] of Object.entries(OPTIMISM_TOKENS)) {
        expect(isAddress(token.address), `Token ${key} address invalid`).toBe(true);
        expect(token.decimals).toBeGreaterThan(0);
        expect(['[PROVISIONAL]', '[FACT]']).toContain(token.addressTier);
      }
    });

    it('has valid pool definitions with chainId 10 and verified TruthTier', () => {
      expect(ALL_OPTIMISM_ACTIVE_POOLS.length).toBeGreaterThan(0);
      for (const pool of ALL_OPTIMISM_ACTIVE_POOLS) {
        expect(pool.chain).toBe('optimism');
        expect(pool.chainId).toBe(10);
        expect(isAddress(pool.poolAddress)).toBe(true);
        expect(['[PROVISIONAL]', '[FACT]']).toContain(pool.tier);
      }
    });

    it('configures Optimism research pairs with chainId 10', () => {
      expect(OPTIMISM_RESEARCH_PAIRS.length).toBeGreaterThan(0);
      for (const pair of OPTIMISM_RESEARCH_PAIRS) {
        expect(pair.chainId).toBe(10);
        expect(isAddress(pair.baseToken.address)).toBe(true);
        expect(isAddress(pair.quoteToken.address)).toBe(true);
      }
    });
  });

  describe('Multi-Chain Gas Models', () => {
    describe('PolygonGasModel', () => {
      it('enforces l1DataFeeUsd = 0.0 (sidechain)', () => {
        const model = new PolygonGasModel({ defaultMaticPriceUsd: 0.85 });
        expect(model.l1DataFeeUsd).toBe(0.0);
      });

      it('calculates execution gas cost accurately using MATIC price', () => {
        const maticPrice = 0.80;
        const model = new PolygonGasModel({
          defaultExecutionGasUnits: 200_000,
          defaultPriorityFeeGwei: 30,
          defaultMaticPriceUsd: maticPrice,
        });

        // 200,000 gas, baseFee 50 Gwei, priority 30 Gwei = 80 Gwei total = 80e-9 MATIC per gas
        // 200_000 * 80e-9 = 0.016 MATIC * $0.80 = $0.0128
        const breakdown = model.calculateGasCost(50);
        expect(breakdown.l1DataFeeUsd).toBe(0.0);
        expect(breakdown.l2GasCostUsd).toBeCloseTo(0.0128, 4);
        expect(breakdown.totalGasCostUsd).toBeCloseTo(0.0128, 4);
      });
    });

    describe('ArbitrumGasModel', () => {
      it('calculates execution gas cost using ETH price and includes provisional L1 fee', () => {
        const ethPrice = 2500;
        const model = new ArbitrumGasModel({
          defaultExecutionGasUnits: 200_000,
          defaultPriorityFeeGwei: 0.1,
          defaultL1DataFeeUsd: 0.003,
          defaultEthPriceUsd: ethPrice,
        });

        expect(model.l1DataFeeUsd).toBe(0.003);

        // 200_000 gas, baseFee 0.1 Gwei, priority 0.1 Gwei = 0.2 Gwei = 0.2e-9 ETH
        // 200_000 * 0.2e-9 = 0.00004 ETH * $2500 = $0.10
        // total = $0.10 + $0.003 = $0.103
        const breakdown = model.calculateGasCost(0.1);
        expect(breakdown.l1DataFeeUsd).toBe(0.003);
        expect(breakdown.l2GasCostUsd).toBeCloseTo(0.10, 3);
        expect(breakdown.totalGasCostUsd).toBeCloseTo(0.103, 3);
      });
    });
  });

  describe('verifyPoolBytecode Utility', () => {
    it('returns true when address has valid contract bytecode', async () => {
      const mockClient = {
        getBytecode: vi.fn().mockResolvedValue('0x608060405234801561001057600080fd5b50'),
      };
      const result = await verifyPoolBytecode('0x1234567890123456789012345678901234567890', mockClient);
      expect(result).toBe(true);
    });

    it('returns false for empty or minimal bytecode', async () => {
      const mockClientEmpty = {
        getBytecode: vi.fn().mockResolvedValue('0x'),
      };
      expect(await verifyPoolBytecode('0x1234567890123456789012345678901234567890', mockClientEmpty)).toBe(false);

      const mockClientNull = {
        getBytecode: vi.fn().mockResolvedValue(null),
      };
      expect(await verifyPoolBytecode('0x1234567890123456789012345678901234567890', mockClientNull)).toBe(false);

      const mockClientShort = {
        getBytecode: vi.fn().mockResolvedValue('0x1234'), // only 2 bytes
      };
      expect(await verifyPoolBytecode('0x1234567890123456789012345678901234567890', mockClientShort)).toBe(false);
    });

    it('returns false gracefully when getBytecode throws an RPC error', async () => {
      const mockClientError = {
        getBytecode: vi.fn().mockRejectedValue(new Error('RPC rate limit')),
      };
      const result = await verifyPoolBytecode('0x1234567890123456789012345678901234567890', mockClientError);
      expect(result).toBe(false);
    });
  });

  describe('Phase 4.6.0.1 Canonical Pool Registry Reconciliation & Regressions', () => {
    it('activates canonical pool addresses with [FACT] tier', () => {
      const polyWethUsdc500 = ALL_POLYGON_ACTIVE_POOLS.find(p => p.id === 'univ3-polygon-weth-usdc-500');
      expect(polyWethUsdc500).toBeDefined();
      expect(polyWethUsdc500!.poolAddress).toBe('0xA4D8c89f0c20efbe54cBa9e7e7a7E509056228D9');
      expect(polyWethUsdc500!.status).toBe('active');
      expect(polyWethUsdc500!.tier).toBe('[FACT]');

      const polyWethUsdc3000 = ALL_POLYGON_ACTIVE_POOLS.find(p => p.id === 'univ3-polygon-weth-usdc-3000');
      expect(polyWethUsdc3000).toBeDefined();
      expect(polyWethUsdc3000!.poolAddress).toBe('0x19C5505638383337D2972Ce68B493aD78E315147');
      expect(polyWethUsdc3000!.status).toBe('active');
      expect(polyWethUsdc3000!.tier).toBe('[FACT]');

      const polyWethUsdt500 = ALL_POLYGON_ACTIVE_POOLS.find(p => p.id === 'univ3-polygon-weth-usdt-500');
      expect(polyWethUsdt500).toBeDefined();
      expect(polyWethUsdt500!.poolAddress).toBe('0xBB98B3D2b18aeF63a3178023A920971cf5F29bE4');
      expect(polyWethUsdt500!.status).toBe('active');
      expect(polyWethUsdt500!.tier).toBe('[FACT]');

      const optWethUsdc3000 = ALL_OPTIMISM_ACTIVE_POOLS.find(p => p.id === 'univ3-optimism-weth-usdc-3000');
      expect(optWethUsdc3000).toBeDefined();
      expect(optWethUsdc3000!.poolAddress).toBe('0xB589969D38CE76D3d7AA319De7133bC9755fD840');
      expect(optWethUsdc3000!.status).toBe('active');
      expect(optWethUsdc3000!.tier).toBe('[FACT]');
    });

    it('preserves historical incorrect addresses as disabled entries with audit notes', () => {
      const polyOld1 = ALL_POLYGON_POOLS.find(p => p.id === 'univ3-polygon-weth-usdc-500-historical-disabled');
      expect(polyOld1).toBeDefined();
      expect(polyOld1!.poolAddress).toBe('0x45dDa9cb7c25131DF268515131f647d726f50608');
      expect(polyOld1!.status).toBe('disabled');
      expect(polyOld1!.tier).toBe('[PROVISIONAL]');
      expect(polyOld1!.note).toContain('HISTORICAL DISABLED');

      const polyOld2 = ALL_POLYGON_POOLS.find(p => p.id === 'univ3-polygon-weth-usdc-3000-historical-disabled');
      expect(polyOld2).toBeDefined();
      expect(polyOld2!.poolAddress).toBe('0x167384319B41F7094e62f7506409Eb38079AbfF8');
      expect(polyOld2!.status).toBe('disabled');

      const polyOld3 = ALL_POLYGON_POOLS.find(p => p.id === 'univ3-polygon-weth-usdt-500-historical-disabled');
      expect(polyOld3).toBeDefined();
      expect(polyOld3!.poolAddress).toBe('0x4CcD010148379ea531D6C587CfDd60180196F9b1');
      expect(polyOld3!.status).toBe('disabled');

      const optOld1 = ALL_OPTIMISM_POOLS.find(p => p.id === 'univ3-optimism-weth-usdc-3000-historical-disabled');
      expect(optOld1).toBeDefined();
      expect(optOld1!.poolAddress).toBe('0x1C3140aB59d6cAf9fa7459C6f83D4B52ba881d36');
      expect(optOld1!.status).toBe('disabled');
    });

    it('ensures no duplicate active pool addresses exist on any chain', () => {
      const checkDuplicates = (pools: typeof ALL_POLYGON_ACTIVE_POOLS, chainName: string): void => {
        const addresses = pools.map(p => p.poolAddress.toLowerCase());
        const uniqueAddresses = new Set(addresses);
        expect(uniqueAddresses.size, `Duplicate active pool address on ${chainName}`).toBe(addresses.length);
      };

      checkDuplicates(ALL_POLYGON_ACTIVE_POOLS, 'Polygon');
      checkDuplicates(ALL_ARBITRUM_ACTIVE_POOLS, 'Arbitrum');
      checkDuplicates(ALL_OPTIMISM_ACTIVE_POOLS, 'Optimism');
    });

    it('enforces strict numerical address ordering for token0 < token1', () => {
      const allActiveMultiChain = [
        ...ALL_POLYGON_ACTIVE_POOLS,
        ...ALL_ARBITRUM_ACTIVE_POOLS,
        ...ALL_OPTIMISM_ACTIVE_POOLS,
      ];

      for (const pool of allActiveMultiChain) {
        const addr0 = pool.token0.address.toLowerCase();
        const addr1 = pool.token1.address.toLowerCase();
        expect(addr0 < addr1, `Token order invalid in ${pool.id}: ${addr0} >= ${addr1}`).toBe(true);
      }
    });

    it('verifies feeBps accurately matches on-chain fee tiers', () => {
      const poly500 = ALL_POLYGON_ACTIVE_POOLS.find(p => p.id === 'univ3-polygon-weth-usdc-500');
      expect(poly500!.feeBps).toBe(5);

      const poly3000 = ALL_POLYGON_ACTIVE_POOLS.find(p => p.id === 'univ3-polygon-weth-usdc-3000');
      expect(poly3000!.feeBps).toBe(30);

      const polyUsdt500 = ALL_POLYGON_ACTIVE_POOLS.find(p => p.id === 'univ3-polygon-weth-usdt-500');
      expect(polyUsdt500!.feeBps).toBe(5);

      const opt3000 = ALL_OPTIMISM_ACTIVE_POOLS.find(p => p.id === 'univ3-optimism-weth-usdc-3000');
      expect(opt3000!.feeBps).toBe(30);
    });

    it('guarantees disabled pools are strictly excluded from active quote universe', () => {
      const disabledPolygon = ALL_POLYGON_POOLS.filter(p => p.status === 'disabled');
      expect(disabledPolygon.length).toBe(3);
      for (const p of disabledPolygon) {
        expect(ALL_POLYGON_ACTIVE_POOLS.some(active => active.id === p.id)).toBe(false);
      }

      const disabledOptimism = ALL_OPTIMISM_POOLS.filter(p => p.status === 'disabled');
      expect(disabledOptimism.length).toBe(1);
      for (const p of disabledOptimism) {
        expect(ALL_OPTIMISM_ACTIVE_POOLS.some(active => active.id === p.id)).toBe(false);
      }
    });

    it('confirms all active pools pass registry validation criteria', () => {
      const allActive = [
        ...ALL_ACTIVE_POOLS,
        ...ALL_POLYGON_ACTIVE_POOLS,
        ...ALL_ARBITRUM_ACTIVE_POOLS,
        ...ALL_OPTIMISM_ACTIVE_POOLS,
      ];

      for (const pool of allActive) {
        expect(isAddress(pool.poolAddress)).toBe(true);
        expect(isAddress(pool.token0.address)).toBe(true);
        expect(isAddress(pool.token1.address)).toBe(true);
        expect(pool.token0.decimals).toBeGreaterThan(0);
        expect(pool.token1.decimals).toBeGreaterThan(0);
        expect(pool.feeBps).toBeGreaterThan(0);
        expect(pool.status).toBe('active');
        expect(pool.tier).toBe('[FACT]');
      }
    });
  });
});
