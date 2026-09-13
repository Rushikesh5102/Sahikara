import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';

const client = createPublicClient({ transport: http(process.env.BASE_RPC_URL) });

async function verifyAll() {
  const WETH = getAddress('0x4200000000000000000000000000000000000006');
  const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  const quoterV2 = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a');

  console.log('QuoterV2 address:', quoterV2);
  const code = await client.getBytecode({ address: quoterV2 });
  console.log('QuoterV2 code length:', code?.length);

  const quoterV2Abi = [
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
    {
      name: 'factory',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'address' }],
    },
  ];

  const factory = await client.readContract({
    address: quoterV2,
    abi: quoterV2Abi,
    functionName: 'factory',
  });
  console.log('QuoterV2 factory():', factory);

  // Test quoteExactInputSingle on QuoterV2
  const amountIn = 1000000000000000n; // 0.001 WETH (~$2.40)
  const quoteResult = await client.readContract({
    address: quoterV2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        tokenIn: WETH,
        tokenOut: USDC,
        amountIn,
        fee: 500,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  console.log('QuoterV2 quoteExactInputSingle Result:', quoteResult);
  console.log(`0.001 WETH yields: ${Number(quoteResult[0]) / 1e6} USDC`);
  console.log(`Estimated gas: ${quoteResult[3].toString()} units`);
}

verifyAll().catch(console.error);
