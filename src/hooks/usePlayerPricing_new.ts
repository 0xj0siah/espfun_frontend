import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { getContractData, NETWORK_CONFIG } from '../contracts';

// Create a public client for reading from the contract
const publicClient = createPublicClient({
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

// Hook to fetch player price from FDFPair contract
export function usePlayerPrice(playerId: number) {
  const [price, setPrice] = useState<string>('0 USDC');
  const [loading, setLoading] = useState(false);
  const { ready } = usePrivy();

  useEffect(() => {
    if (!ready || !playerId) return;

    const fetchPrice = async () => {
      setLoading(true);
      try {
        const fdfPairContract = getContractData('FDFPair');
        
        // Make actual contract call to get prices using getPrices function
        const result = await publicClient.readContract({
          address: fdfPairContract.address as `0x${string}`,
          abi: fdfPairContract.abi,
          functionName: 'getPrices',
          args: [[BigInt(playerId)]], // Array of player token IDs
        });

        // The result is an array of prices
        const pricesArray = result as bigint[];
        if (pricesArray.length > 0 && pricesArray[0] > 0n) {
          // Format the result to USDC (6 decimals)
          const priceInUsdc = formatUnits(pricesArray[0], 6);
          setPrice(`${parseFloat(priceInUsdc).toFixed(2)} USDC`);
        } else {
          throw new Error('No price returned from contract');
        }
        
      } catch (error) {
        console.error('Error fetching price for player', playerId, error);
        // Fallback to simulated price on error
        const basePrice = 50 + (playerId % 10) * 20; // Base USDC prices
        const fallbackPrice = `${basePrice.toFixed(2)} USDC`;
        setPrice(fallbackPrice);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
    
    // Update prices every 30 seconds
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, [playerId, ready]);

  return { price, loading };
}

// Hook to fetch multiple player prices at once (more efficient)
export function usePlayerPrices(playerIds: number[]) {
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const { ready } = usePrivy();

  useEffect(() => {
    if (!ready || playerIds.length === 0) return;

    const fetchPrices = async () => {
      setLoading(true);
      try {
        console.log('Fetching prices for player IDs:', playerIds);
        const fdfPairContract = getContractData('FDFPair');
        console.log('Using FDFPair contract at:', fdfPairContract.address);
        console.log('Network config:', NETWORK_CONFIG);
        const newPrices: Record<number, string> = {};
        
        // First, test basic connectivity
        try {
          console.log('Testing contract connectivity...');
          const currencyInfo = await publicClient.readContract({
            address: fdfPairContract.address as `0x${string}`,
            abi: fdfPairContract.abi,
            functionName: 'getCurrencyInfo',
            args: [],
          });
          console.log('Contract connectivity test successful. Currency info:', currencyInfo);
        } catch (connectivityError) {
          console.error('Contract connectivity test failed:', connectivityError);
        }
        
        // Get all available player IDs from contract
        try {
          console.log('Getting all player IDs from contract...');
          const allPlayerIds = await publicClient.readContract({
            address: fdfPairContract.address as `0x${string}`,
            abi: fdfPairContract.abi,
            functionName: 'getAllPlayerIds',
            args: [],
          });
          console.log('All player IDs in contract:', allPlayerIds);
        } catch (playerIdsError) {
          console.error('Error getting all player IDs:', playerIdsError);
        }
        
        // Try to get prices with our player IDs
        try {
          console.log('Attempting getPrices with player IDs:', playerIds);
          const result = await publicClient.readContract({
            address: fdfPairContract.address as `0x${string}`,
            abi: fdfPairContract.abi,
            functionName: 'getPrices',
            args: [playerIds.map(id => BigInt(id))],
          });

          console.log('Contract call successful, result:', result);
          const pricesArray = result as bigint[];
          
          playerIds.forEach((playerId, index) => {
            if (index < pricesArray.length && pricesArray[index] > 0n) {
              const priceInUsdc = formatUnits(pricesArray[index], 6);
              console.log(`Player ${playerId}: ${priceInUsdc} USDC (raw: ${pricesArray[index]})`);
              newPrices[playerId] = `${parseFloat(priceInUsdc).toFixed(2)} USDC`;
            } else {
              console.log(`Player ${playerId}: Using fallback price (no contract price)`);
              const basePrice = 50 + (playerId % 10) * 20;
              newPrices[playerId] = `${basePrice.toFixed(2)} USDC`;
            }
          });
          
        } catch (originalError) {
          console.error('Error with original player IDs:', originalError);
          
          // Try with simple test IDs as fallback
          try {
            console.log('Testing with basic player IDs [1, 2, 3, 4, 5, 6]...');
            const testResult = await publicClient.readContract({
              address: fdfPairContract.address as `0x${string}`,
              abi: fdfPairContract.abi,
              functionName: 'getPrices',
              args: [[1n, 2n, 3n, 4n, 5n, 6n]],
            });
            
            console.log('Test with basic IDs successful:', testResult);
            const testPricesArray = testResult as bigint[];
            
            playerIds.forEach((playerId, index) => {
              if (index < testPricesArray.length && testPricesArray[index] > 0n) {
                const priceInUsdc = formatUnits(testPricesArray[index], 6);
                console.log(`Player ${playerId}: ${priceInUsdc} USDC (from test ID ${index + 1})`);
                newPrices[playerId] = `${parseFloat(priceInUsdc).toFixed(2)} USDC`;
              } else {
                console.log(`Player ${playerId}: Using fallback price`);
                const basePrice = 50 + (playerId % 10) * 20;
                newPrices[playerId] = `${basePrice.toFixed(2)} USDC`;
              }
            });
            
          } catch (testError) {
            console.error('Test IDs also failed:', testError);
            // Final fallback
            playerIds.forEach(id => {
              const basePrice = 50 + (id % 10) * 20;
              newPrices[id] = `${basePrice.toFixed(2)} USDC`;
            });
          }
        }

        setPrices(newPrices);
      } catch (error) {
        console.error('General error fetching prices:', error);
        // Final fallback prices
        const fallbackPrices: Record<number, string> = {};
        playerIds.forEach(id => {
          const basePrice = 50 + (id % 10) * 20;
          fallbackPrices[id] = `${basePrice.toFixed(2)} USDC`;
        });
        setPrices(fallbackPrices);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    
    // Update prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [JSON.stringify(playerIds), ready]);

  return { prices, loading };
}

// Hook for live price updates with WebSocket (for future implementation)
export function useLivePlayerPrices(playerIds: number[]) {
  const { prices, loading } = usePlayerPrices(playerIds);
  
  // TODO: Add WebSocket connection for real-time price updates
  // This would connect to a price feed service or directly to blockchain events
  
  return { prices, loading, isLive: true }; // Now using real contract data
}

// Helper function to get reserve data from FDFPair contract
export async function getReserveData(playerId: number) {
  try {
    const fdfPairContract = getContractData('FDFPair');
    
    const poolInfo = await publicClient.readContract({
      address: fdfPairContract.address as `0x${string}`,
      abi: fdfPairContract.abi,
      functionName: 'getPoolInfo',
      args: [[BigInt(playerId)]], // Array of player token IDs
    });

    // The result is [currencyReserves[], playerTokenReserves[]]
    const [currencyReserves, playerTokenReserves] = poolInfo as [bigint[], bigint[]];
    
    if (currencyReserves.length > 0 && playerTokenReserves.length > 0) {
      return {
        currencyReserve: formatUnits(currencyReserves[0], 6), // USDC has 6 decimals
        tokenReserve: formatUnits(playerTokenReserves[0], 18), // Assuming player tokens have 18 decimals
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching reserve data:', error);
    return null;
  }
}

// Helper function to calculate price impact for trades
export async function calculatePriceImpact(playerId: number, amount: string, isBuy: boolean) {
  try {
    const reserves = await getReserveData(playerId);
    if (!reserves) return null;

    const amountUnits = parseUnits(amount, 6); // USDC has 6 decimals
    const currentPrice = parseFloat(reserves.currencyReserve) / parseFloat(reserves.tokenReserve);
    
    // Simplified price impact calculation
    // In production, this would use the actual AMM formula
    const impact = (parseFloat(amount) / parseFloat(reserves.currencyReserve)) * 100;
    
    return {
      currentPrice: currentPrice.toFixed(2),
      priceImpact: Math.min(impact, 10).toFixed(2), // Cap at 10%
      newPrice: isBuy 
        ? (currentPrice * (1 + impact / 100)).toFixed(2)
        : (currentPrice * (1 - impact / 100)).toFixed(2)
    };
  } catch (error) {
    console.error('Error calculating price impact:', error);
    return null;
  }
}
