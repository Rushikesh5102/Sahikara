import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';

const client = createPublicClient({ transport: http(process.env.BASE_RPC_URL) });

// Uniswap v3 Quoter addresses on EVM usually come from standard CREATE2 deployments or Uniswap docs.
// Let's test standard QuoterV2 / Quoter addresses:
// Notice: In Uniswap docs, Quoter is 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 (Quoter v1).
// Wait, in Quoter V1, quoteExactInputSingle is non-view and throws an error or reverts with the quote in its return data!
// In Solidity/EVM, Quoter v1 returns data by REVERTING or returning if called via eth_call.
// Wait! Let's check what Quoter contract is at 0x3d4e44Eb1374240CE5F1B13678dadB69BA684...
// Let's test every 40-character hex starting with 0x3d4e44Eb1374240CE5F1B13678dadB69BA684:
async function findQuoterV2() {
  const prefix = '3d4e44eb1374240ce5f1b13678dadb69ba684'; // 39 chars
  const hexChars = '0123456789abcdef';
  console.log('Testing 16 permutations for 39-char prefix:', prefix);
  for (const c of hexChars) {
    const candidate = '0x' + prefix + c;
    try {
      const addr = getAddress(candidate);
      const code = await client.getBytecode({ address: addr });
      if (code && code.length > 2) {
        console.log(`MATCH FOUND: ${addr} (code len: ${code.length})`);
        return addr;
      }
    } catch (e) {
      // not valid checksum or error
    }
  }

  // What if the missing char was somewhere else? Let's check common QuoterV2 on Base:
  // Let's check Uniswap Deployments GitHub or docs:
  // "QuoterV2": "0x3d4e44Eb1374240CE5F1B13678dadB69Ba684d0"? Wait, 3d4e44Eb1374240CE5F1B13678dadB69Ba684bB?
  // Let's search inside node_modules/@uniswap for Base deployments!
}

findQuoterV2().catch(console.error);
