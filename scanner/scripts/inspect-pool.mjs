import 'dotenv/config';
import { createPublicClient, http, getAddress } from 'viem';

const client = createPublicClient({ transport: http(process.env.BASE_RPC_URL) });

async function inspectPool() {
  const pool = getAddress('0xd0b53D9277642d899DF5C87A3966A349A798F224'); // WETH/USDC 500
  console.log('Fetching recent transactions to pool:', pool);

  const blockNumber = await client.getBlockNumber();
  console.log('Current block:', blockNumber);

  // Let's search recent blocks for swaps or interactions with the pool to see what router/quoter calls it!
  for (let b = blockNumber; b > blockNumber - 20n; b--) {
    const block = await client.getBlock({ blockNumber: b, includeTransactions: true });
    for (const tx of block.transactions) {
      if (tx.to && getAddress(tx.to) === pool) {
        console.log(`Direct tx to pool in block ${b}:`, tx.hash, 'from/caller:', tx.from);
      }
    }
  }

  // Also, let's look at recent transactions in the block that might be using Uniswap Universal Router or SwapRouter02
  // Universal Router on Base: 0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD or similar?
  const universalRouters = [
    '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    '0x2626664c2603336E57B271c5C0b26F421741e481', // SwapRouter02 on Base?
    '0x198EF79F1F515F02dFE9e3115eCA9f051838d40B',
    '0x3d4e44Eb1374240CE5F1B13678dadB69BA684B9',
  ];

  for (const r of universalRouters) {
    try {
      const code = await client.getBytecode({ address: getAddress(r) });
      if (code && code.length > 2) {
        console.log(`Router found at ${r} (code len: ${code.length})`);
      }
    } catch (e) {}
  }
}

inspectPool().catch(console.error);
