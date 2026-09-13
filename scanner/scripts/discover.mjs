import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';

const client = createPublicClient({ transport: http(process.env.BASE_RPC_URL) });

async function discover() {
  const WETH = getAddress('0x4200000000000000000000000000000000000006');
  const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  const UNI_V3_FACTORY = getAddress('0x33128a8fC17869897dcE68Ed026d694621f6FDfD');

  const poolWethUsdc = await client.readContract({
    address: UNI_V3_FACTORY,
    abi: parseAbi(['function getPool(address, address, uint24) view returns (address)']),
    functionName: 'getPool',
    args: [WETH, USDC, 500],
  });
  console.log('Uniswap V3 WETH/USDC (500) pool:', poolWethUsdc);

  // Read transactions from pool or check known contracts
  // Let's test Uniswap V3 Quoter V1 (0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6)
  const quoterV1 = getAddress('0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6');
  try {
    const quoteOut = await client.readContract({
      address: quoterV1,
      abi: parseAbi([
        'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) returns (uint256 amountOut)'
      ]),
      functionName: 'quoteExactInputSingle',
      args: [WETH, USDC, 500, 1000000000000000n, 0n],
    });
    console.log('Uniswap QuoterV1 Quote for 0.001 WETH -> USDC:', quoteOut);
  } catch (err) {
    console.log('Uniswap QuoterV1 test call failed:', err.message);
  }

  // Find QuoterV2 address on Base!
  // QuoterV2 is typically deployed across chains. On Base, let's test if 0x3d4e44Eb1374240CE5F1B13678dadB69BA684d0 or similar:
  // Wait, let's look at 0x3d4e44Eb1374240CE5F1B13678dadB69BA684...
  // Let's compute checksum for 0x3d4e44eb1374240ce5f1b13678dadb69ba684bb (length 39 chars) - wait!
  // In Uniswap docs, QuoterV2 is `0x3d4e44Eb1374240CE5F1B13678dadB69BA684d0`? Or what?
  // Let's check bytecode of addresses that differ by 1 char or common addresses
  const commonUniV3QuoterV2 = [
    '0x3d4e44Eb1374240CE5F1B13678dadB69BA6844d',
    '0x3d4e44Eb1374240CE5F1B13678dadB69BA684d0',
    '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // Common Uniswap QuoterV2 on multiple chains
    '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    '0x231b02F88B21379C31db130444415717bD58E1f1',
    '0x0C3a436928e469502EB9938883b16A658A463B8f',
  ];

  for (const addr of commonUniV3QuoterV2) {
    try {
      const code = await client.getBytecode({ address: getAddress(addr) });
      if (code && code.length > 2) {
        console.log(`Candidate QuoterV2 FOUND: ${addr} (code len: ${code.length})`);
      }
    } catch {}
  }

  // Aerodrome: Let's find Aerodrome Factory and Router
  // Current AERODROME_ROUTER in config: 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43
  const aeroRouter = getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43');
  const routerCode = await client.getBytecode({ address: aeroRouter });
  console.log('Aerodrome Router code len:', routerCode?.length);

  if (routerCode) {
    try {
      const defaultFactory = await client.readContract({
        address: aeroRouter,
        abi: parseAbi(['function defaultFactory() view returns (address)']),
        functionName: 'defaultFactory',
      });
      console.log('Aerodrome Router defaultFactory():', defaultFactory);

      const poolFactory = await client.readContract({
        address: aeroRouter,
        abi: parseAbi(['function poolFactory() view returns (address)']),
        functionName: 'poolFactory',
      }).catch(() => null);
      if (poolFactory) console.log('Aerodrome Router poolFactory():', poolFactory);

      const factory = defaultFactory || poolFactory;
      if (factory) {
        const factoryCode = await client.getBytecode({ address: factory });
        console.log(`Aerodrome Factory from Router: ${factory} (code: ${factoryCode?.length})`);

        // Check pools from factory
        const volatilePool = await client.readContract({
          address: factory,
          abi: parseAbi(['function getPool(address, address, bool) view returns (address)']),
          functionName: 'getPool',
          args: [WETH, USDC, false],
        });
        console.log(`Aerodrome WETH/USDC Volatile Pool: ${volatilePool}`);

        const stablePool = await client.readContract({
          address: factory,
          abi: parseAbi(['function getPool(address, address, bool) view returns (address)']),
          functionName: 'getPool',
          args: [WETH, USDC, true],
        });
        console.log(`Aerodrome WETH/USDC Stable Pool: ${stablePool}`);

        // Check fee via factory.getFee(pool, stable)
        if (volatilePool && volatilePool !== '0x0000000000000000000000000000000000000000') {
          const fee = await client.readContract({
            address: factory,
            abi: parseAbi(['function getFee(address, bool) view returns (uint256)']),
            functionName: 'getFee',
            args: [volatilePool, false],
          });
          console.log(`Aerodrome Volatile Pool Fee from Factory: ${fee} (bps)`);

          const out = await client.readContract({
            address: volatilePool,
            abi: parseAbi(['function getAmountOut(uint256, address) view returns (uint256)']),
            functionName: 'getAmountOut',
            args: [1000000000000000n, WETH],
          });
          console.log(`Aerodrome Volatile getAmountOut(0.001 WETH): ${out}`);
        }
      }
    } catch (e) {
      console.log('Error querying Aerodrome router:', e);
    }
  }
}

discover().catch(console.error);
