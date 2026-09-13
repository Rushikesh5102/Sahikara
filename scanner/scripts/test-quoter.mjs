import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';

const client = createPublicClient({ transport: http(process.env.BASE_RPC_URL) });

async function testQuoter() {
  const WETH = getAddress('0x4200000000000000000000000000000000000006');
  const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  const candidates = [
    '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    '0x3d4e44Eb1374240CE5F1B13678dadB69ba684Bb',
    '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
  ];

  // Let's test 0x61fFE014bA17989E743c5F6cB21bF9697530B21e for Uniswap QuoterV2
  const quoterAbi = [
    {
      name: 'quoteExactInputSingle',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        {
          name: 'params',
          type: 'tuple',
          components: [
            { name: 'tokenIn', type: 'address' },
            { name: 'tokenOut', type: 'address' },
            { name: 'amountIn', type: 'uint256' },
            { name: 'fee', type: 'uint24' },
            { name: 'sqrtPriceLimitX96', type: 'uint160' },
          ],
        },
      ],
      outputs: [
        { name: 'amountOut', type: 'uint256' },
        { name: 'sqrtPriceX96After', type: 'uint160' },
        { name: 'initializedTicksCrossed', type: 'uint32' },
        { name: 'gasEstimate', type: 'uint256' },
      ],
    },
  ];

  for (const c of ['0x61fFE014bA17989E743c5F6cB21bF9697530B21e']) {
    try {
      const res = await client.readContract({
        address: getAddress(c),
        abi: quoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [
          {
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1000000000000000n, // 0.001 WETH
            fee: 500,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      console.log(`SUCCESS QuoterV2 at ${c}:`, res);
    } catch (e) {
      console.log(`Failed at ${c}:`, e.message);
    }
  }

  // Also check if 0x3d4e44Eb1374240CE5F1B13678dadB69ba684... exists with an extra character or what:
  // Wait, let's look at Uniswap official Base deployments:
  // Is 0x3d4e44... Quoter or QuoterV2 or something else?
  // Let's test if 0x3d4e44Eb1374240CE5F1B13678dadB69ba684Bb was a typo for 0x3d4e44Eb1374240CE5F1B13678dadB69ba684d0 or something?
  // 0x61fFE014bA17989E743c5F6cB21bF9697530B21e is the CANONICAL Uniswap V3 QuoterV2 deployment across Arbitrum, Optimism, Base, Polygon!
  // Wait, let's verify if 0x33128a8fC17869897dcE68Ed026d694621f6FDfD is factory() on QuoterV2:
  try {
    const factory = await client.readContract({
      address: getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e'),
      abi: parseAbi(['function factory() view returns (address)']),
      functionName: 'factory',
    });
    console.log('QuoterV2 factory():', factory);
  } catch (e) {
    console.log('Could not read factory from QuoterV2:', e.message);
  }
}

testQuoter().catch(console.error);
