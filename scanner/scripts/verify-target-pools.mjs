import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';

const client = createPublicClient({ transport: http(process.env.BASE_RPC_URL) });

async function verifyAllTargetPools() {
  const WETH = getAddress('0x4200000000000000000000000000000000000006');
  const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  const USDbC = getAddress('0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA');
  const cbBTC = getAddress('0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf');

  const UNI_FACTORY = getAddress('0x33128a8fC17869897dcE68Ed026d694621f6FDfD');
  const AERO_FACTORY = getAddress('0x420DD381b31aEf6683db6B902084cB0FFECe40Da');

  console.log('--- Checking Uniswap V3 WETH/cbBTC (fee 500 & 3000) ---');
  const uniCbBtc500 = await client.readContract({
    address: UNI_FACTORY,
    abi: parseAbi(['function getPool(address, address, uint24) view returns (address)']),
    functionName: 'getPool',
    args: [WETH, cbBTC, 500],
  });
  console.log('WETH/cbBTC (500):', uniCbBtc500);

  const uniCbBtc3000 = await client.readContract({
    address: UNI_FACTORY,
    abi: parseAbi(['function getPool(address, address, uint24) view returns (address)']),
    functionName: 'getPool',
    args: [WETH, cbBTC, 3000],
  });
  console.log('WETH/cbBTC (3000):', uniCbBtc3000);

  console.log('\n--- Checking Aerodrome Pools for WETH/USDC and USDC/USDbC ---');
  const aeroWethUsdcVolatile = await client.readContract({
    address: AERO_FACTORY,
    abi: parseAbi(['function getPool(address, address, bool) view returns (address)']),
    functionName: 'getPool',
    args: [WETH, USDC, false],
  });
  console.log('Aerodrome WETH/USDC volatile:', aeroWethUsdcVolatile);

  const aeroUsdcUsdbcStable = await client.readContract({
    address: AERO_FACTORY,
    abi: parseAbi(['function getPool(address, address, bool) view returns (address)']),
    functionName: 'getPool',
    args: [USDC, USDbC, true],
  });
  console.log('Aerodrome USDC/USDbC stable:', aeroUsdcUsdbcStable);

  // Let's test getAmountOut on both Aerodrome pools
  const aeroVolatileAmountOut = await client.readContract({
    address: aeroWethUsdcVolatile,
    abi: parseAbi(['function getAmountOut(uint256, address) view returns (uint256)']),
    functionName: 'getAmountOut',
    args: [1000000000000000n, WETH], // 0.001 WETH (~$2.50)
  });
  console.log('Aero Volatile getAmountOut(0.001 WETH) -> USDC:', Number(aeroVolatileAmountOut) / 1e6);

  const aeroStableAmountOut = await client.readContract({
    address: aeroUsdcUsdbcStable,
    abi: parseAbi(['function getAmountOut(uint256, address) view returns (uint256)']),
    functionName: 'getAmountOut',
    args: [1000000n, USDC], // 1 USDC -> USDbC
  });
  console.log('Aero Stable getAmountOut(1 USDC) -> USDbC:', Number(aeroStableAmountOut) / 1e6);
}

verifyAllTargetPools().catch(console.error);
