import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';

const rpcUrl = process.env.BASE_RPC_URL;
if (!rpcUrl) {
  console.error('BASE_RPC_URL missing in env');
  process.exit(1);
}

const client = createPublicClient({ transport: http(rpcUrl) });

async function main() {
  const chainId = await client.getChainId();
  const block = await client.getBlockNumber();
  console.log(`Connected to Chain ID: ${chainId}, Block: ${block}`);

  // Canonical Tokens
  const WETH = getAddress('0x4200000000000000000000000000000000000006');
  const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  console.log('\n--- TOKEN VERIFICATION ---');
  for (const [name, addr] of [['WETH', WETH], ['USDC', USDC]]) {
    const code = await client.getBytecode({ address: addr });
    const symbol = await client.readContract({
      address: addr,
      abi: parseAbi(['function symbol() view returns (string)']),
      functionName: 'symbol',
    });
    const decimals = await client.readContract({
      address: addr,
      abi: parseAbi(['function decimals() view returns (uint8)']),
      functionName: 'decimals',
    });
    console.log(`${name}: ${addr} | code: ${code ? 'YES' : 'NO'} | symbol: ${symbol} | decimals: ${decimals}`);
  }

  // Check Uniswap V3 Factory
  console.log('\n--- UNISWAP V3 VERIFICATION ---');
  const UNI_V3_FACTORY = getAddress('0x33128a8fC17869897dcE68Ed026d694621f6FDfD');
  const factoryCode = await client.getBytecode({ address: UNI_V3_FACTORY });
  console.log(`Uni V3 Factory: ${UNI_V3_FACTORY} | code: ${factoryCode ? 'YES' : 'NO'}`);

  const poolWethUsdc500 = await client.readContract({
    address: UNI_V3_FACTORY,
    abi: parseAbi(['function getPool(address, address, uint24) view returns (address)']),
    functionName: 'getPool',
    args: [WETH, USDC, 500],
  });
  console.log(`Uni V3 WETH/USDC 500 pool from factory: ${poolWethUsdc500}`);
  const poolCode = await client.getBytecode({ address: poolWethUsdc500 });
  console.log(`Pool code exists: ${poolCode ? 'YES' : 'NO'}`);

  // Let's test Uniswap Quoter vs QuoterV2
  // Canonical Quoter on Base:
  // Usually Quoter is 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 or 0x3d4e44Eb1374240CE5F1B13678dadB69BA684d0 or similar
  // Let's test known Base Quoters
  const potentialQuoters = [
    '0x3d4e44Eb1374240CE5F1B13678dadB69BA684d0',
    '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', // Uniswap Quoter (V1)
    '0x3d4e44Eb1374240CE5F1B13678dadB69BA684Bb', // missing char?
  ];

  for (const q of potentialQuoters) {
    try {
      const addr = getAddress(q);
      const code = await client.getBytecode({ address: addr });
      console.log(`Quoter test ${addr} -> code: ${code ? code.length : 'NO'}`);
    } catch (e) {
      console.log(`Invalid address format: ${q} (${e.message})`);
    }
  }

  // Aerodrome Factory & Pool
  console.log('\n--- AERODROME VERIFICATION ---');
  // Aerodrome PoolFactory
  const AERO_FACTORY = getAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40D');
  const aeroFactoryCode = await client.getBytecode({ address: AERO_FACTORY });
  console.log(`Aero Factory: ${AERO_FACTORY} | code: ${aeroFactoryCode ? 'YES' : 'NO'}`);

  const aeroPoolVolatile = await client.readContract({
    address: AERO_FACTORY,
    abi: parseAbi(['function getPool(address, address, bool) view returns (address)']),
    functionName: 'getPool',
    args: [WETH, USDC, false],
  });
  console.log(`Aero WETH/USDC volatile pool from factory: ${aeroPoolVolatile}`);

  const aeroPoolStable = await client.readContract({
    address: AERO_FACTORY,
    abi: parseAbi(['function getPool(address, address, bool) view returns (address)']),
    functionName: 'getPool',
    args: [WETH, USDC, true],
  });
  console.log(`Aero WETH/USDC stable pool from factory: ${aeroPoolStable}`);

  if (aeroPoolVolatile && aeroPoolVolatile !== '0x0000000000000000000000000000000000000000') {
    const fee = await client.readContract({
      address: AERO_FACTORY,
      abi: parseAbi(['function getFee(address pool, bool stable) view returns (uint256)']),
      functionName: 'getFee',
      args: [aeroPoolVolatile, false],
    });
    console.log(`Aero volatile pool fee from factory: ${fee}`);

    const poolFee = await client.readContract({
      address: aeroPoolVolatile,
      abi: parseAbi(['function fee() view returns (uint256)']).catch(() => []),
      functionName: 'fee',
    }).catch(err => `fee() call reverted: ${err.message}`);
    console.log(`Aero volatile pool direct fee(): ${poolFee}`);

    const factoryFromPool = await client.readContract({
      address: aeroPoolVolatile,
      abi: parseAbi(['function factory() view returns (address)']),
      functionName: 'factory',
    });
    console.log(`Aero volatile pool factory(): ${factoryFromPool}`);

    const reserves = await client.readContract({
      address: aeroPoolVolatile,
      abi: parseAbi(['function getReserves() view returns (uint256, uint256, uint256)']),
      functionName: 'getReserves',
    });
    console.log(`Aero volatile reserves: ${reserves}`);

    const amountIn = 1000000000000000n; // 0.001 WETH
    const amountOut = await client.readContract({
      address: aeroPoolVolatile,
      abi: parseAbi(['function getAmountOut(uint256, address) view returns (uint256)']),
      functionName: 'getAmountOut',
      args: [amountIn, WETH],
    });
    console.log(`Aero volatile getAmountOut(0.001 WETH): ${amountOut}`);
  }
}

main().catch(console.error);
