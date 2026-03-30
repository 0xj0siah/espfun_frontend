import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { formatUnits } from 'viem';
import { getContractData } from '../contracts';
import { readContractCached, initializeContractCache } from '../utils/contractCache';
import { PRICE_POLL_INTERVAL_MS } from '../constants/trading';

/** Format a USDC price with enough precision to show meaningful digits */
function formatPrice(price: number): string {
  if (price === 0) return '0.00 USDC';
  if (price >= 1) return `${price.toFixed(2)} USDC`;
  if (price >= 0.01) return `${price.toFixed(4)} USDC`;
  // Sub-cent: show 2 significant figures after leading zeros
  const leadingZeros = Math.max(0, Math.floor(-Math.log10(Math.abs(price))));
  return `${price.toFixed(leadingZeros + 2)} USDC`;
}

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
          setPrice(formatPrice(parseFloat(priceInUsdc)));
        } else {
          throw new Error('No price returned from contract');
        }

      } catch (error) {
        // Contract call failed - return empty string so components use fake data
        console.log('⚠️ usePlayerPrice: Contract failed for player', playerId, '- using fake data price');
        setPrice('');
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
    const interval = setInterval(fetchPrice, PRICE_POLL_INTERVAL_MS);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [playerId, ready]);

  return { price, loading };
}

// Hook to fetch multiple player prices at once (more efficient)
// Queries FDFPair first, then falls back to BondingCurve virtual prices
export function usePlayerPrices(playerIds: number[]) {
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const { ready, user, authenticated } = usePrivy();

  useEffect(() => {
    if (playerIds.length === 0) return;

    // Always fetch prices - don't wait for wallet if not authenticated
    // Only wait for wallet if authenticated but not ready
    if (authenticated && !ready) {
      return;
    }

    const fetchPrices = async () => {
      setLoading(true);

      try {
        const fdfPairContract = getContractData('FDFPair');
        const bondingCurveContract = getContractData('BondingCurve');
        const newPrices: Record<number, string> = {};

        // Query each player individually so one failure doesn't kill the batch.
        // viem's batch transport combines these into a single JSON-RPC multicall.
        const results = await Promise.allSettled(
          playerIds.map(async (playerId) => {
            // Try FDFPair pool reserves first
            try {
              const result = await readContractCached({
                address: fdfPairContract.address as `0x${string}`,
                abi: fdfPairContract.abi as any,
                functionName: 'getPoolInfo',
                args: [[BigInt(playerId)]],
              });

              const [currencyReserves, playerTokenReserves] = result as [bigint[], bigint[]];
              const currency = currencyReserves?.[0] ?? 0n;
              const tokens = playerTokenReserves?.[0] ?? 0n;

              if (currency > 0n && tokens > 0n) {
                const price = (Number(currency) / 1e6) / (Number(tokens) / 1e18);
                return { playerId, price: formatPrice(price) };
              }
            } catch {
              // Pool doesn't exist for this player
            }

            // Fallback: BondingCurve getCurrentPrice
            if (bondingCurveContract.address && bondingCurveContract.address !== '0x0000000000000000000000000000000000000000') {
              try {
                const curvePrice = await readContractCached({
                  address: bondingCurveContract.address as `0x${string}`,
                  abi: bondingCurveContract.abi as any,
                  functionName: 'getCurrentPrice',
                  args: [BigInt(playerId)],
                });

                if ((curvePrice as bigint) > 0n) {
                  const priceInUsdc = formatUnits(curvePrice as bigint, 6);
                  return { playerId, price: formatPrice(parseFloat(priceInUsdc)) };
                }
              } catch {
                // No bonding curve price either
              }
            }

            return { playerId, price: null };
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.price) {
            newPrices[result.value.playerId] = result.value.price;
          }
        }

        setPrices(newPrices);
      } catch (error) {
        setPrices({});
      } finally {
        setLoading(false);
      }
    };

    // Small random delay to stagger initial requests
    const delay = Math.random() * 2000;
    const timeoutId = setTimeout(fetchPrices, delay);

    // Update prices every 30 seconds
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL_MS);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [playerIds.length > 0 ? playerIds.join(',') : '', ready || !authenticated]);

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
