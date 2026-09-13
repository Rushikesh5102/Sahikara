import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';

const client = createPublicClient({ transport: http(process.env.BASE_RPC_URL) });

async function testRoundTrip() {
  const WETH = getAddress('0x4200000000000000000000000000000000000006');
  const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  const quoterV2 = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a');
  const aeroWethUsdc = getAddress('0xcDAC0d6c6C59727a65F871236188350531885C43');

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
  ];

  const aeroPoolAbi = parseAbi(['function getAmountOut(uint256, address) view returns (uint256)']);

  // Test trade sizes: $1, $5, $10 with ETH price ~$2400
  // $1 = ~0.000416666666666667 WETH (416666666666667 wei)
  // $5 = ~0.002083333333333333 WETH (2083333333333333 wei)
  // $10 = ~0.004166666666666667 WETH (4166666666666667 wei)
  const tradeSizes = [
    { name: '$1', amountIn: 416666666666667n },
    { name: '$5', amountIn: 2083333333333333n },
    { name: '$10', amountIn: 4166666666666667n },
  ];

  for (const { name, amountIn } of tradeSizes) {
    console.log(`\n================== TRADE SIZE: ${name} (${amountIn} wei WETH) ==================`);
    
    // Route A: WETH -> UniV3 -> USDC -> Aero -> WETH
    console.log('--- Route A: WETH -> UniV3 -> USDC -> Aero -> WETH ---');
    const uniLeg1 = await client.readContract({
      address: quoterV2,
      abi: quoterV2Abi,
      functionName: 'quoteExactInputSingle',
      args: [{ tokenIn: WETH, tokenOut: USDC, amountIn, fee: 500, sqrtPriceLimitX96: 0n }],
    });
    const usdcOutA = uniLeg1[0];
    console.log(`Leg 1 (UniV3 WETH->USDC): ${amountIn} WETH -> ${usdcOutA} USDC (${Number(usdcOutA)/1e6} USDC)`);

    const aeroLeg2 = await client.readContract({
      address: aeroWethUsdc,
      abi: aeroPoolAbi,
      functionName: 'getAmountOut',
      args: [usdcOutA, USDC],
    });
    console.log(`Leg 2 (Aero USDC->WETH): ${usdcOutA} USDC -> ${aeroLeg2} WETH`);
    const diffA = aeroLeg2 - amountIn;
    console.log(`Route A Round-Trip Gross Diff: ${diffA} wei WETH (${Number(diffA)/1e18} WETH, ${(Number(diffA)/Number(amountIn)*100).toFixed(4)}%)`);

    // Route B: WETH -> Aero -> USDC -> UniV3 -> WETH
    console.log('--- Route B: WETH -> Aero -> USDC -> UniV3 -> WETH ---');
    const aeroLeg1 = await client.readContract({
      address: aeroWethUsdc,
      abi: aeroPoolAbi,
      functionName: 'getAmountOut',
      args: [amountIn, WETH],
    });
    console.log(`Leg 1 (Aero WETH->USDC): ${amountIn} WETH -> ${aeroLeg1} USDC (${Number(aeroLeg1)/1e6} USDC)`);

    const uniLeg2 = await client.readContract({
      address: quoterV2,
      abi: quoterV2Abi,
      functionName: 'quoteExactInputSingle',
      args: [{ tokenIn: USDC, tokenOut: WETH, amountIn: aeroLeg1, fee: 500, sqrtPriceLimitX96: 0n }],
    });
    const wethOutB = uniLeg2[0];
    console.log(`Leg 2 (UniV3 USDC->WETH): ${aeroLeg1} USDC -> ${wethOutB} WETH`);
    const diffB = wethOutB - amountIn;
    console.log(`Route B Round-Trip Gross Diff: ${diffB} wei WETH (${Number(diffB)/1e18} WETH, ${(Number(diffB)/Number(amountIn)*100).toFixed(4)}%)`);
  }
}

testRoundTrip().catch(console.error);
