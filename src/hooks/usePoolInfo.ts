import { useState } from 'react';
import { getContractData } from '../contracts';
import { readContractCached, initializeContractCache } from '../utils/contractCache';

interface PoolInfo {
  playerId: number;
  currencyReserve: bigint;
  playerTokenReserve: bigint;
}

export interface PriceImpactCalculation {
  priceImpact: number; // Absolute value for display
  priceImpactSigned: number; // Signed value for logic (+/-)
  newPrice: number;
  currentPrice: number;
  tokensTraded: number;
  effectivePrice: number;
}

export function usePoolInfo() {
  const [poolData, setPoolData] = useState<Map<number, PoolInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize contract cache
  initializeContractCache();

  const fetchPoolInfo = async (playerIds: number[]) => {
    if (playerIds.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fdfPairContract = getContractData('FDFPair');

      // Call the actual contract to get pool info
      const result = await readContractCached({
        address: fdfPairContract.address as `0x${string}`,
        abi: fdfPairContract.abi as any,
        functionName: 'getPoolInfo',
        args: [playerIds.map(id => BigInt(id))],
      });

      // Parse the result - getPoolInfo should return [currencyReserves[], playerTokenReserves[]]
      const [currencyReserves, playerTokenReserves] = result as [bigint[], bigint[]];

      if (!currencyReserves || !playerTokenReserves) {
        throw new Error('Invalid contract response: missing reserves data');
      }

      if (currencyReserves.length !== playerIds.length || playerTokenReserves.length !== playerIds.length) {
        throw new Error(`Contract response length mismatch: expected ${playerIds.length} entries, got currency: ${currencyReserves?.length}, tokens: ${playerTokenReserves?.length}`);
      }

      // Create pool data from real contract data
      const realPoolData = new Map<number, PoolInfo>();
      playerIds.forEach((playerId, index) => {
        const poolInfo = {
          playerId,
          currencyReserve: currencyReserves[index],
          playerTokenReserve: playerTokenReserves[index],
        };
        realPoolData.set(playerId, poolInfo);
      });

      setPoolData(realPoolData);

    } catch (err) {
      console.error('Error fetching pool info from contract:', err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching pool data');

      // Provide fallback empty data instead of mock data
      const fallbackPoolData = new Map<number, PoolInfo>();
      playerIds.forEach((playerId) => {
        const poolInfo = {
          playerId,
          currencyReserve: BigInt(0), // Empty reserves indicate no liquidity
          playerTokenReserve: BigInt(0),
        };
        fallbackPoolData.set(playerId, poolInfo);
      });
      setPoolData(fallbackPoolData);
    } finally {
      setLoading(false);
    }
  };

  const calculatePriceImpact = (
    playerId: number,
    tradeAmount: string,
    action: 'buy' | 'sell'
  ): PriceImpactCalculation | null => {
    const poolInfo = poolData.get(playerId);
    if (!poolInfo) {
      return null;
    }

    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      return null;
    }

    const { currencyReserve, playerTokenReserve } = poolInfo;

    // Check if pool has liquidity
    if (currencyReserve === BigInt(0) || playerTokenReserve === BigInt(0)) {
      return null;
    }

    // Convert reserves to numbers for calculation (with proper precision handling)
    const currencyReserveNum = Number(currencyReserve) / 1e6; // USDC has 6 decimals
    const playerTokenReserveNum = Number(playerTokenReserve) / 1e18; // Player tokens have 18 decimals
    const tradeAmountNum = parseFloat(tradeAmount);

    // Current price: USDC per token
    const currentPrice = currencyReserveNum / playerTokenReserveNum;

    // Validate current price
    if (!isFinite(currentPrice) || currentPrice <= 0) {
      console.error('Invalid current price calculated:', currentPrice);
      return null;
    }

    // Use constant product AMM formula: x * y = k
    const k = currencyReserveNum * playerTokenReserveNum;

    let newCurrencyReserve: number;
    let newPlayerTokenReserve: number;
    let newPrice: number;
    let tokensTraded: number;

    if (action === 'buy') {
      // User spends USDC to get player tokens
      // New currency reserve = current + USDC spent
      newCurrencyReserve = currencyReserveNum + tradeAmountNum;
      // New player token reserve = k / new currency reserve
      newPlayerTokenReserve = k / newCurrencyReserve;
      // Tokens received by user
      tokensTraded = playerTokenReserveNum - newPlayerTokenReserve;

      newPrice = newCurrencyReserve / newPlayerTokenReserve;
    } else {
      // User sells player tokens to get USDC
      // New player token reserve = current + player tokens sold
      newPlayerTokenReserve = playerTokenReserveNum + tradeAmountNum;
      // New currency reserve = k / new player token reserve
      newCurrencyReserve = k / newPlayerTokenReserve;
      // USDC received by user
      tokensTraded = currencyReserveNum - newCurrencyReserve;

      newPrice = newCurrencyReserve / newPlayerTokenReserve;
    }

    // Validate new price
    if (!isFinite(newPrice) || newPrice <= 0) {
      console.error('Invalid new price calculated:', newPrice);
      return null;
    }

    // Calculate price impact as percentage (positive for price increase, negative for price decrease)
    // For buying: price should increase (positive impact)
    // For selling: price should decrease (negative impact)
    const priceImpact = ((newPrice - currentPrice) / currentPrice) * 100;

    // For display purposes, we typically show the absolute value but keep sign for logic
    const priceImpactMagnitude = Math.abs(priceImpact);

    const result = {
      priceImpact: priceImpactMagnitude, // Always positive for display
      priceImpactSigned: priceImpact, // Signed version for logic
      newPrice,
      currentPrice,
      tokensTraded: Math.abs(tokensTraded),
      effectivePrice: action === 'buy'
        ? tradeAmountNum / Math.abs(tokensTraded) // USDC spent per token received
        : Math.abs(tokensTraded) / tradeAmountNum // USDC received per token sold
    };

    return result;
  };

  return {
    poolData,
    loading,
    error,
    fetchPoolInfo,
    calculatePriceImpact,
  };
}
