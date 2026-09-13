import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';

const client = createPublicClient({ transport: http(process.env.BASE_RPC_URL) });

async function verifyAllTokens() {
  const tokens = [
    { key: 'WETH', addr: '0x4200000000000000000000000000000000000006' },
    { key: 'USDC', addr: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { key: 'USDbC', addr: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' },
    { key: 'DAI', addr: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
    { key: 'cbBTC', addr: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' },
    { key: 'AERO', addr: '0x940181a94A35A4569E4529A3CDfB74e38FD98631' },
  ];

  for (const t of tokens) {
    const checksumAddr = getAddress(t.addr);
    const code = await client.getBytecode({ address: checksumAddr });
    const symbol = await client.readContract({
      address: checksumAddr,
      abi: parseAbi(['function symbol() view returns (string)']),
      functionName: 'symbol',
    });
    const decimals = await client.readContract({
      address: checksumAddr,
      abi: parseAbi(['function decimals() view returns (uint8)']),
      functionName: 'decimals',
    });
    console.log(`${t.key} (${checksumAddr}): code len=${code ? code.length : 0}, symbol=${symbol}, decimals=${decimals}`);
  }
}

verifyAllTokens().catch(console.error);
