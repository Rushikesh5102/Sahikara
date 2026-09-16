import { createPublicClient, http } from 'viem';
import { base, arbitrum, optimism, polygon } from 'viem/chains';

const chains = {
  base: { client: createPublicClient({ chain: base, transport: http('https://mainnet.base.org') }) },
  arbitrum: { client: createPublicClient({ chain: arbitrum, transport: http('https://arb1.arbitrum.io/rpc') }) },
  optimism: { client: createPublicClient({ chain: optimism, transport: http('https://mainnet.optimism.io') }) },
  polygon: { client: createPublicClient({ chain: polygon, transport: http('https://polygon-bor-rpc.publicnode.com') }) },
};

const deployments = [
  // Balancer Vault (Common on all chains)
  { chain: 'base', name: 'Balancer Vault', address: '0xBA12222222228d8Ba53147432925ca53833b1023' as `0x${string}` },
  { chain: 'arbitrum', name: 'Balancer Vault', address: '0xBA12222222228d8Ba53147432925ca53833b1023' as `0x${string}` },
  { chain: 'optimism', name: 'Balancer Vault', address: '0xBA12222222228d8Ba53147432925ca53833b1023' as `0x${string}` },
  { chain: 'polygon', name: 'Balancer Vault', address: '0xBA12222222228d8Ba53147432925ca53833b1023' as `0x${string}` },

  // Camelot (Arbitrum)
  { chain: 'arbitrum', name: 'Camelot v2 Factory', address: '0x6EcCab4224c0B6107d43d2074f4E8DD9ec0F2870' as `0x${string}` },
  { chain: 'arbitrum', name: 'Camelot v2 Router', address: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d' as `0x${string}` },

  // Velodrome (Optimism)
  { chain: 'optimism', name: 'Velodrome v2 Factory', address: '0xF1046053aa5682b4F9a81b5481394DA16BE5FFCE' as `0x${string}` },
  { chain: 'optimism', name: 'Velodrome v2 Router', address: '0xa062aE8A9c5e11aaA026fc2670B0D65cCc8B2858' as `0x${string}` },

  // QuickSwap (Polygon)
  { chain: 'polygon', name: 'QuickSwap v2 Factory', address: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32' as `0x${string}` },
  { chain: 'polygon', name: 'QuickSwap v2 Router', address: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff' as `0x${string}` },

  // SushiSwap v2
  { chain: 'arbitrum', name: 'SushiSwap v2 Factory', address: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4' as `0x${string}` },
  { chain: 'polygon', name: 'SushiSwap v2 Factory', address: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4' as `0x${string}` },

  // Curve Address Provider / Pools
  { chain: 'arbitrum', name: 'Curve 2pool (USDC/USDT)', address: '0x7f90122BF0700F9E7e1F688fe926940E8839F353' as `0x${string}` },
  { chain: 'arbitrum', name: 'Curve AddressProvider', address: '0x0000000022D53366457F9d5E68Ec105046FC4383' as `0x${string}` },
  { chain: 'polygon', name: 'Curve aave pool', address: '0x445FE580eF8d70FF569aB36e80c647af338db351' as `0x${string}` },
  { chain: 'base', name: 'Curve Base 3pool / crvUSD', address: '0x0000000022D53366457F9d5E68Ec105046FC4383' as `0x${string}` },
];

async function verify() {
  console.log('=== VERIFYING DEX CONTRACT DEPLOYMENTS ===\n');
  for (const dep of deployments) {
    const c = chains[dep.chain as keyof typeof chains];
    try {
      const code = await c.client.getBytecode({ address: dep.address });
      const hasCode = code && code.length > 2;
      console.log(`[${dep.chain.toUpperCase()}] ${dep.name} (${dep.address}): ${hasCode ? 'VERIFIED (Bytecode ' + code.length + ' bytes)' : 'NO BYTECODE'}`);
    } catch (err: any) {
      console.log(`[${dep.chain.toUpperCase()}] ${dep.name} (${dep.address}): ERROR - ${err.message.slice(0, 80)}`);
    }
  }
}

verify().catch(console.error);
