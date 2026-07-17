import { createPublicClient, createWalletClient, http, defineChain, encodeAbiParameters, parseAbiParameters, decodeAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const ritualChain = defineChain({
  id: 1979,
  name: 'Ritual',
  nativeCurrency: { name: 'RITUAL', symbol: 'RITUAL', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.ritualfoundation.org'] } },
});

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error('Set PRIVATE_KEY'); process.exit(1); }

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: ritualChain, transport: http() });
const walletClient = createWalletClient({ account, chain: ritualChain, transport: http() });

const LLM_PRECOMPILE = '0x0000000000000000000000000000000000000802';
const RITUAL_WALLET = '0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948';
const EXECUTOR = '0xB42e435c4252A5a2E7440e37B609F00c61a0c91B';

async function main() {
  console.log('Wallet:', account.address);
  
  const balance = await publicClient.readContract({
    address: RITUAL_WALLET,
    abi: [{ name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('RitualWallet balance:', balance.toString(), 'wei');

  const lock = await publicClient.readContract({
    address: RITUAL_WALLET,
    abi: [{ name: 'lockUntil', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
    functionName: 'lockUntil',
    args: [account.address],
  });
  console.log('Lock until block:', lock.toString());
  
  const currentBlock = await publicClient.getBlockNumber();
  console.log('Current block:', currentBlock.toString());
  console.log(lock < currentBlock ? '⚠️ Lock expired!' : '✅ Lock still active');

  const messagesJson = JSON.stringify([
    { role: 'system', content: 'Reply in one sentence.' },
    { role: 'user', content: 'What is Ritual Chain?' },
  ]);

  const encoded = encodeAbiParameters(
    parseAbiParameters([
      'address, bytes[], uint256, bytes[], bytes,',
      'string, string, int256, string, bool, int256, string, string,',
      'uint256, bool, int256, string, bytes, int256, string, string, bool,',
      'int256, bytes, bytes, int256, int256, string, bool,',
      '(string,string,string)',
    ].join(', ')),
    [
      EXECUTOR, [], 300n, [], '0x',
      messagesJson, 'zai-org/GLM-4.7-FP8',
      0n, '', false, 4096n, '', '',
      1n, true, 0n, 'medium', '0x', -1n, 'auto', '',
      false, 700n, '0x', '0x', -1n, 1000n, '',
      false, ['', '', ''],
    ]
  );

  console.log('\nSending LLM precompile call...');
  console.log('Input length:', encoded.length, 'bytes');

  try {
    const hash = await walletClient.sendTransaction({
      to: LLM_PRECOMPILE,
      data: encoded,
      gas: 3_000_000n,
    });
    console.log('TX hash:', hash);
    console.log('Waiting for receipt...');
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('Status:', receipt.status);
    console.log('Gas used:', receipt.gasUsed.toString());
    
    const spcCalls = receipt.spcCalls;
    if (spcCalls && spcCalls.length > 0) {
      console.log('\nspcCalls found:', spcCalls.length);
      const output = spcCalls[0].output;
      
      const [, actualOutput] = decodeAbiParameters(
        parseAbiParameters('bytes, bytes'),
        output
      );
      const [hasError, completionData, , errorMessage] = decodeAbiParameters(
        parseAbiParameters('bool, bytes, bytes, string'),
        actualOutput
      );
      
      if (hasError) {
        console.log('❌ LLM Error:', errorMessage);
      } else {
        const [, , , , , , , choicesData] = decodeAbiParameters(
          parseAbiParameters('string, string, uint256, string, string, string, uint256, bytes[], bytes'),
          completionData
        );
        if (choicesData.length > 0) {
          const [, , messageData] = decodeAbiParameters(
            parseAbiParameters('uint256, string, bytes'),
            choicesData[0]
          );
          const [, content] = decodeAbiParameters(
            parseAbiParameters('string, string, string, uint256, bytes[]'),
            messageData
          );
          console.log('\n✅ LLM Response:', content);
        }
      }
    } else {
      console.log('No spcCalls in receipt');
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

main().catch(console.error);
