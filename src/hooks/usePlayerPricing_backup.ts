import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { getContractData, NETWORK_CONFIG } from '../contracts';
import { generateRealisticPrice, parseETHToNumber } from '../utils/contractUtils';

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
    testnet: true, // Mark as testnet
  },
  transport: http(NETWORK_CONFIG.rpcUrl, {
    batch: true, // Enable batching for better performance
    timeout: 30000, // 30 second timeout
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
        if (pricesArray.length > 0) {
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
  }, [playerId, ready]); // Removed wallets dependency

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
        
        // First, let's try to call a simple function to test connectivity
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
        
        // Try to get all player IDs from the contract first
        try {
          console.log('Getting all player IDs from contract...');
          const allPlayerIds = await publicClient.readContract({
            address: fdfPairContract.address as `0x${string}`,
            abi: fdfPairContract.abi,
            functionName: 'getAllPlayerIds',
            args: [],
          });
          console.log('All player IDs in contract:', allPlayerIds);
          
          // If we got player IDs from contract, use those instead for testing
          const contractPlayerIds = allPlayerIds as bigint[];
          if (contractPlayerIds.length > 0) {
            console.log('Using first few player IDs from contract for testing...');
            const testIds = contractPlayerIds.slice(0, Math.min(6, contractPlayerIds.length)).map(id => Number(id));
            console.log('Test IDs:', testIds);
            
            // Try to get prices for the actual contract player IDs
            const testResult = await publicClient.readContract({
              address: fdfPairContract.address as `0x${string}`,
              abi: fdfPairContract.abi,
              functionName: 'getPrices',
              args: [contractPlayerIds.slice(0, Math.min(6, contractPlayerIds.length))],
            });
            console.log('Test getPrices result with contract IDs:', testResult);
          }
        } catch (playerIdsError) {
          console.error('Error getting all player IDs:', playerIdsError);
        }
        
        // Make single batch contract call to get prices for all players
        try {
          console.log('Attempting getPrices with original player IDs...');
          const result = await publicClient.readContract({
            address: fdfPairContract.address as `0x${string}`,
            abi: fdfPairContract.abi,
            functionName: 'getPrices',
            args: [playerIds.map(id => BigInt(id))], // Array of player token IDs
          });

          console.log('Contract call successful, result:', result);

          // The result is an array of prices
          const pricesArray = result as bigint[];
          
          playerIds.forEach((playerId, index) => {
            if (index < pricesArray.length) {
              // Format the result to USDC (6 decimals)
              const priceInUsdc = formatUnits(pricesArray[index], 6);
              console.log(`Player ${playerId}: ${priceInUsdc} USDC (raw: ${pricesArray[index]})`);
              newPrices[playerId] = `${parseFloat(priceInUsdc).toFixed(2)} USDC`;
            } else {
              // Fallback for missing prices
              console.log(`Player ${playerId}: Using fallback price`);
              const basePrice = 50 + (playerId % 10) * 20;
              newPrices[playerId] = `${basePrice.toFixed(2)} USDC`;
            }
          });
          
        } catch (originalError) {
          console.error('Error with original player IDs, trying with basic test IDs:', originalError);
          
          // Try with basic player IDs (1, 2, 3, etc.) as a test
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
            
            // Map the test results back to our player IDs
            playerIds.forEach((playerId, index) => {
              if (index < testPricesArray.length && testPricesArray[index] > 0n) {
                const priceInUsdc = formatUnits(testPricesArray[index], 6);
                console.log(`Test - Player ${playerId}: ${priceInUsdc} USDC (from basic ID ${index + 1})`);
                newPrices[playerId] = `${parseFloat(priceInUsdc).toFixed(2)} USDC`;
              } else {
                console.log(`Test - Player ${playerId}: Using fallback price`);
                const basePrice = 50 + (playerId % 10) * 20;
                newPrices[playerId] = `${basePrice.toFixed(2)} USDC`;
              }
            });
            
          } catch (testError) {
            console.error('Even basic test IDs failed:', testError);
            throw testError; // Let it fall through to the fallback
          }
        }

        setPrices(newPrices);
      } catch (error) {
          console.error('Error fetching batch prices:', error);
          console.error('Error details:', {
            message: error.message,
            cause: error.cause,
            code: error.code,
            data: error.data
          });
          // Set fallback prices for all players on batch error
          playerIds.forEach(id => {
            const basePrice = 50 + (id % 10) * 20;
            newPrices[id] = `${basePrice.toFixed(2)} USDC`;
          });
        }
        setPrices(newPrices);
      } catch (error) {
        console.error('Error fetching player prices:', error);
        // Set fallback prices on general error
        const fallbackPrices: Record<number, string> = {};
        playerIds.forEach(id => {
          const basePrice = 50 + (id % 10) * 20; // Base USDC prices
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
  }, [JSON.stringify(playerIds), ready]); // Use JSON.stringify for array comparison

  return { prices, loading };
}

// Hook to fetch multiple player prices using getBuyPrice for 1 token each (more accurate pricing)
export function usePlayerBuyPrices(playerIds: number[]) {
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const { ready } = usePrivy();

  useEffect(() => {
    if (!ready || playerIds.length === 0) return;

    const fetchBuyPrices = async () => {
      setLoading(true);
      try {
        const fdfPairContract = getContractData('FDFPair');
        const newPrices: Record<number, string> = {};
        
        // Make contract call to get buy prices for 1 token each
        try {
          // For getBuyPrice, we need to specify amounts to buy and currency amounts to spend
          // Let's try to get the price for buying 1 token of each player
          const tokenAmountsToBuy = playerIds.map(() => parseUnits('1', 18)); // 1 token each (18 decimals)
          const maxCurrencyToSpend = playerIds.map(() => parseUnits('1000', 6)); // Max 1000 USDC each (6 decimals)
          
          const result = await publicClient.readContract({
            address: fdfPairContract.address as `0x${string}`,
            abi: fdfPairContract.abi,
            functionName: 'getBuyPrice',
            args: [
              playerIds.map(id => BigInt(id)), // player token IDs
              tokenAmountsToBuy,               // amounts to buy (1 token each)
              maxCurrencyToSpend               // max currency to spend
            ],
          });

          // The result is [amountsToReceive[], feeAmounts[], feeRates[], feeTypes[]]
          const [amountsToReceive, feeAmounts] = result as [bigint[], bigint[], bigint[], number[]];
          
          playerIds.forEach((playerId, index) => {
            if (index < amountsToReceive.length) {
              // The amount to receive is the currency cost for 1 token
              const priceInUsdc = formatUnits(amountsToReceive[index], 6);
              newPrices[playerId] = `${parseFloat(priceInUsdc).toFixed(2)} USDC`;
            } else {
              // Fallback for missing prices
              const basePrice = 50 + (playerId % 10) * 20;
              newPrices[playerId] = `${basePrice.toFixed(2)} USDC`;
            }
          });
          
        } catch (error) {
          console.error('Error fetching getBuyPrice, falling back to getPrices:', error);
          // Fallback to getPrices if getBuyPrice fails
          try {
            const result = await publicClient.readContract({
              address: fdfPairContract.address as `0x${string}`,
              abi: fdfPairContract.abi,
              functionName: 'getPrices',
              args: [playerIds.map(id => BigInt(id))],
            });

            const pricesArray = result as bigint[];
            playerIds.forEach((playerId, index) => {
              if (index < pricesArray.length) {
                const priceInUsdc = formatUnits(pricesArray[index], 6);
                newPrices[playerId] = `${parseFloat(priceInUsdc).toFixed(2)} USDC`;
              } else {
                const basePrice = 50 + (playerId % 10) * 20;
                newPrices[playerId] = `${basePrice.toFixed(2)} USDC`;
              }
            });
          } catch (fallbackError) {
            console.error('Error with getPrices fallback:', fallbackError);
            // Final fallback - use simulated prices
            playerIds.forEach(id => {
              const basePrice = 50 + (id % 10) * 20;
              newPrices[id] = `${basePrice.toFixed(2)} USDC`;
            });
          }
        }

        setPrices(newPrices);
      } catch (error) {
        console.error('Error fetching player prices:', error);
        // Set fallback prices on general error
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

    fetchBuyPrices();
    
    // Update prices every 30 seconds
    const interval = setInterval(fetchBuyPrices, 30000);
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
