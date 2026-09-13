import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';

const client = createPublicClient({ transport: http(process.env.BASE_RPC_URL) });

async function verifyAllPairs() {
  const WETH = getAddress('0x4200000000000000000000000000000000000006');
  const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  const USDbC = getAddress('0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA');
  const cbBTC = getAddress('0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf');
  const AERO_TOKEN = getAddress('0x940181a94A35A4569E4529A3CDfB74e38FD98631');

  const UNI_FACTORY = getAddress('0x33128a8fC17869897dcE68Ed026d694621f6FDfD');
  const AERO_FACTORY = getAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40Da');
  const AERO_ROUTER = getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43');

  console.log('=== UNISWAP V3 POOL DISCOVERY ===');
  const uniPairs = [
    { name: 'WETH/USDC (500)', t0: WETH, t1: USDC, fee: 500 },
    { name: 'WETH/USDC (3000)', t0: WETH, t1: USDC, fee: 3000 },
    { name: 'USDC/USDbC (100)', t0: USDC, t1: USDbC, fee: 100 },
    { name: 'WETH/cbBTC (500)', t0: WETH, t1: cbBTC, fee: 500 },
    { name: 'WETH/cbBTC (3000)', t0: WETH, t1: cbBTC, fee: 3000 },
  ];

  for (const p of uniPairs) {
    const pool = await client.readContract({
      address: UNI_FACTORY,
      abi: parseAbi(['function getPool(address, address, uint24) view returns (address)']),
      functionName: 'getPool',
      args: [p.t0, p.t1, p.fee],
    });
    if (pool && pool !== '0x0000000000000000000000000000000000000000') {
      const code = await client.getBytecode({ address: pool });
      const [t0, t1, fee, liq, slot0] = await Promise.all([
        client.readContract({ address: pool, abi: parseAbi(['function token0() view returns (address)']), functionName: 'token0' }),
        client.readContract({ address: pool, abi: parseAbi(['function token1() view returns (address)']), functionName: 'token1' }),
        client.readContract({ address: pool, abi: parseAbi(['function fee() view returns (uint24)']), functionName: 'fee' }),
        client.readContract({ address: pool, abi: parseAbi(['function liquidity() view returns (uint128)']), functionName: 'liquidity' }),
        client.readContract({ address: pool, abi: parseAbi(['function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)']), functionName: 'slot0' }),
      ]);
      console.log(`Uni pool ${p.name}: ${pool} | code: ${code ? 'YES' : 'NO'} | liq: ${liq} | slot0 tick: ${slot0[1]}`);
    } else {
      console.log(`Uni pool ${p.name}: DOES NOT EXIST (0x0)`);
    }
  }

  console.log('\n=== AERODROME POOL DISCOVERY ===');
  const aeroPairs = [
    { name: 'WETH/USDC (volatile)', t0: WETH, t1: USDC, stable: false },
    { name: 'WETH/USDC (stable)', t0: WETH, t1: USDC, stable: true },
    { name: 'USDC/USDbC (stable)', t0: USDC, t1: USDbC, stable: true },
    { name: 'USDC/USDbC (volatile)', t0: USDC, t1: USDbC, stable: false },
    { name: 'WETH/AERO (volatile)', t0: WETH, t1: AERO_TOKEN, stable: false },
  ];

  for (const p of aeroPairs) {
    const pool = await client.readContract({
      address: AERO_FACTORY,
      abi: parseAbi(['function getPool(address, address, bool) view returns (address)']),
      functionName: 'getPool',
      args: [p.t0, p.t1, p.stable],
    });
    if (pool && pool !== '0x0000000000000000000000000000000000000000') {
      const code = await client.getBytecode({ address: pool });
      const fee = await client.readContract({
        address: AERO_FACTORY,
        abi: parseAbi(['function getFee(address, bool) view returns (uint256)']),
        functionName: 'getFee',
        args: [pool, p.stable],
      });
      const reserves = await client.readContract({
        address: pool,
        abi: parseAbi(['function getReserves() view returns (uint256, uint256, uint256)']),
        functionName: 'getReserves',
      });
      console.log(`Aero pool ${p.name}: ${pool} | fee: ${fee} bps | res0: ${reserves[0]} | res1: ${reserves[1]}`);
    } else {
      console.log(`Aero pool ${p.name}: DOES NOT EXIST`);
    }
  }
}

verifyAllPairs().catch(console.error);
