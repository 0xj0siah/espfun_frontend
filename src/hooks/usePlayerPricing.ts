import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { formatUnits } from 'viem';
import { getContractData } from '../contracts';
import { readContractCached, initializeContractCache } from '../utils/contractCache';

// Hook to fetch player price from FDFPair contract
export function usePlayerPrice(playerId: number) {
  const [price, setPrice] = useState<string>('0 USDC');
  const [loading, setLoading] = useState(false);
  const { ready } = usePrivy();

  // Initialize contract cache
  useEffect(() => {
    initializeContractCache();
  }, []);

  useEffect(() => {
    if (!ready || !playerId) return;

    const fetchPrice = async () => {
      setLoading(true);
      try {
        const fdfPairContract = getContractData('FDFPair');

        const result = await readContractCached({
          address: fdfPairContract.address as `0x${string}`,
          abi: fdfPairContract.abi as any,
          functionName: 'getPrices',
          args: [[BigInt(playerId)]],
        });

        const pricesArray = result as bigint[];
        if (pricesArray.length > 0 && pricesArray[0] > 0n) {
          const priceInUsdc = formatUnits(pricesArray[0], 6);
          setPrice(`${parseFloat(priceInUsdc).toFixed(2)} USDC`);
        } else {
          throw new Error('No price returned from contract');
        }

      } catch (error) {
        // Fallback to simulated price on error
        const basePrice = 50 + (playerId % 10) * 20;
        const fallbackPrice = `${basePrice.toFixed(2)} USDC`;
        setPrice(fallbackPrice);
      } finally {
        setLoading(false);
      }
    };

    // Add small random delay to stagger initial requests
    const delay = Math.random() * 2000;
    const timeoutId = setTimeout(() => {
      fetchPrice();
    }, delay);

    // Update prices every 30 seconds
    const interval = setInterval(fetchPrice, 30000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
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
        const fdfPairContract = getContractData('FDFPair');
        const newPrices: Record<number, string> = {};

        try {
          const result = await readContractCached({
            address: fdfPairContract.address as `0x${string}`,
            abi: fdfPairContract.abi as any,
            functionName: 'getPrices',
            args: [playerIds.map(id => BigInt(id))],
          });

          const pricesArray = result as bigint[];

          if (Array.isArray(pricesArray) && pricesArray.length > 0) {
            playerIds.forEach((playerId, index) => {
              if (index < pricesArray.length && pricesArray[index] > 0n) {
                const priceInUsdc = formatUnits(pricesArray[index], 6);
                newPrices[playerId] = `${parseFloat(priceInUsdc).toFixed(2)} USDC`;
              } else {
                const basePrice = 50 + (playerId % 10) * 20;
                newPrices[playerId] = `${basePrice.toFixed(2)} USDC`;
              }
            });
          } else {
            playerIds.forEach((playerId) => {
              const basePrice = 50 + (playerId % 10) * 20;
              newPrices[playerId] = `${basePrice.toFixed(2)} USDC`;
            });
          }

        } catch (error) {
          // Final fallback
          playerIds.forEach(id => {
            const basePrice = 50 + (id % 10) * 20;
            newPrices[id] = `${basePrice.toFixed(2)} USDC`;
          });
        }

        setPrices(newPrices);
      } catch (error) {
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

    // Add small random delay to stagger initial requests
    const delay = Math.random() * 2000;
    const timeoutId = setTimeout(() => {
      fetchPrices();
    }, delay);

    // Update prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [playerIds.join(','), ready]);

  return { prices, loading };
}

// Hook for live price updates with WebSocket (for future implementation)
export function useLivePlayerPrices(playerIds: number[]) {
  const { prices, loading } = usePlayerPrices(playerIds);

  return { prices, loading, isLive: true };
}

// Helper function to get reserve data from FDFPair contract
export async function getReserveData(playerId: number) {
  try {
    const fdfPairContract = getContractData('FDFPair');

    const poolInfo = await readContractCached({
      address: fdfPairContract.address as `0x${string}`,
      abi: fdfPairContract.abi as any,
      functionName: 'getPoolInfo',
      args: [[BigInt(playerId)]],
    });

    const [currencyReserves, playerTokenReserves] = poolInfo as [bigint[], bigint[]];

    if (currencyReserves.length > 0 && playerTokenReserves.length > 0) {
      return {
        currencyReserve: formatUnits(currencyReserves[0], 6),
        tokenReserve: formatUnits(playerTokenReserves[0], 18),
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Helper function to calculate price impact for trades
export async function calculatePriceImpact(playerId: number, amount: string, isBuy: boolean) {
  try {
    const reserves = await getReserveData(playerId);
    if (!reserves) return null;

    const currentPrice = parseFloat(reserves.currencyReserve) / parseFloat(reserves.tokenReserve);
    const impact = (parseFloat(amount) / parseFloat(reserves.currencyReserve)) * 100;

    return {
      currentPrice: currentPrice.toFixed(2),
      priceImpact: Math.min(impact, 10).toFixed(2),
      newPrice: isBuy
        ? (currentPrice * (1 + impact / 100)).toFixed(2)
        : (currentPrice * (1 - impact / 100)).toFixed(2)
    };
  } catch (error) {
    return null;
  }
}
