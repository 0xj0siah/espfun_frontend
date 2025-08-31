import { createPublicClient, http } from 'viem';
import { getContractData, NETWORK_CONFIG } from '../contracts';

// Create a debug client
const debugClient = createPublicClient({
  chain: {
    id: NETWORK_CONFIG.chainId,
    name: NETWORK_CONFIG.name,
    rpcUrls: {
      default: { http: [NETWORK_CONFIG.rpcUrl] },
      public: { http: [NETWORK_CONFIG.rpcUrl] },
    },
    blockExplorers: {
      default: { name: 'MonadScan', url: NETWORK_CONFIG.blockExplorer },
    },
    nativeCurrency: {
      name: 'MON',
      symbol: 'MON',
      decimals: 18,
    },
    testnet: true,
  },
  transport: http(NETWORK_CONFIG.rpcUrl, {
    batch: true,
    timeout: 30000,
  }),
});

export async function debugContractConnection() {
  console.log('=== CONTRACT DEBUG START ===');
  
  try {
    const fdfPairContract = getContractData('FDFPair');
    console.log('Contract address:', fdfPairContract.address);
    console.log('Network RPC:', NETWORK_CONFIG.rpcUrl);
    
    // Test 1: Check if we can get basic chain info
    console.log('\n1. Testing basic chain connectivity...');
    const chainId = await debugClient.getChainId();
    console.log('Chain ID:', chainId);
    
    const blockNumber = await debugClient.getBlockNumber();
    console.log('Latest block:', blockNumber);
    
    // Test 2: Check if contract exists
    console.log('\n2. Testing contract existence...');
    const code = await debugClient.getBytecode({ 
      address: fdfPairContract.address as `0x${string}` 
    });
    console.log('Contract code exists:', code && code !== '0x');
    
    // Test 3: Try simple contract calls
    console.log('\n3. Testing basic contract calls...');
    
    try {
      const currencyInfo = await debugClient.readContract({
        address: fdfPairContract.address as `0x${string}`,
        abi: fdfPairContract.abi,
        functionName: 'getCurrencyInfo',
        args: [],
      });
      console.log('getCurrencyInfo success:', currencyInfo);
    } catch (error) {
      console.error('getCurrencyInfo failed:', error);
    }
    
    try {
      const allPlayerIds = await debugClient.readContract({
        address: fdfPairContract.address as `0x${string}`,
        abi: fdfPairContract.abi,
        functionName: 'getAllPlayerIds',
        args: [],
      });
      console.log('getAllPlayerIds success:', allPlayerIds);
    } catch (error) {
      console.error('getAllPlayerIds failed:', error);
    }
    
    // Test 4: Try getPrices with simple IDs
    console.log('\n4. Testing getPrices function...');
    
    const testCases = [
      [1n],
      [1n, 2n, 3n],
      [0n],
      [BigInt(4000000)],
      [BigInt(4000001), BigInt(4000002)],
    ];
    
    for (const testIds of testCases) {
      try {
        console.log(`Testing getPrices with IDs: [${testIds.join(', ')}]`);
        const result = await debugClient.readContract({
          address: fdfPairContract.address as `0x${string}`,
          abi: fdfPairContract.abi,
          functionName: 'getPrices',
          args: [testIds],
        });
        console.log('Result:', result);
        console.log('Result type:', typeof result);
        console.log('Is array:', Array.isArray(result));
        if (Array.isArray(result)) {
          console.log('Array length:', result.length);
          result.forEach((price, i) => {
            console.log(`  [${i}]: ${price} (${price > 0n ? 'non-zero' : 'zero'})`);
          });
        }
      } catch (error) {
        console.error(`getPrices failed for [${testIds.join(', ')}]:`, error);
      }
    }
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
  
  console.log('=== CONTRACT DEBUG END ===');
}

// Make it available globally for browser console
(window as any).debugContractConnection = debugContractConnection;
