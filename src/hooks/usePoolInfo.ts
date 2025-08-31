import { useState } from 'react';
import { createPublicClient, http } from 'viem';
import { getContractData, NETWORK_CONFIG } from '../contracts';

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

// Create public client for reading contract data
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
  transport: http(NETWORK_CONFIG.rpcUrl),
});

export function usePoolInfo() {
  const [poolData, setPoolData] = useState<Map<number, PoolInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPoolInfo = async (playerIds: number[]) => {
    if (playerIds.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching real pool info for players:', playerIds);
      
      const fdfPairContract = getContractData('FDFPair');
      console.log('Using FDFPair contract:', fdfPairContract.address);
      
      // Call the actual contract to get pool info
      const result = await publicClient.readContract({
        address: fdfPairContract.address as `0x${string}`,
        abi: fdfPairContract.abi,
        functionName: 'getPoolInfo',
        args: [playerIds.map(id => BigInt(id))],
      });

      console.log('Contract getPoolInfo result:', result);
      
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
        
        console.log(`Real pool info for player ${playerId}:`, {
          playerId,
          currencyReserve: poolInfo.currencyReserve.toString(),
          playerTokenReserve: poolInfo.playerTokenReserve.toString(),
          currencyReserveFormatted: (Number(poolInfo.currencyReserve) / 1e6).toFixed(2) + ' USDC',
          playerTokenReserveFormatted: (Number(poolInfo.playerTokenReserve) / 1e18).toFixed(2) + ' tokens',
          currentPrice: poolInfo.currencyReserve > 0n && poolInfo.playerTokenReserve > 0n 
            ? ((Number(poolInfo.currencyReserve) / 1e6) / (Number(poolInfo.playerTokenReserve) / 1e18)).toFixed(4) + ' USDC per token'
            : 'No liquidity'
        });
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
        console.warn(`Using fallback empty pool data for player ${playerId} due to contract error`);
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
      console.log('Cannot calculate price impact: no pool data for player', playerId);
      return null;
    }
    
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      console.log('Cannot calculate price impact: invalid trade amount', tradeAmount);
      return null;
    }

    const { currencyReserve, playerTokenReserve } = poolInfo;
    
    // Check if pool has liquidity
    if (currencyReserve === BigInt(0) || playerTokenReserve === BigInt(0)) {
      console.log('Cannot calculate price impact: no liquidity in pool', {
        playerId,
        currencyReserve: currencyReserve.toString(),
        playerTokenReserve: playerTokenReserve.toString()
      });
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

    console.log('Price impact calculation inputs:', {
      playerId,
      action,
      tradeAmountInput: tradeAmount,
      tradeAmountNum,
      currencyReserveNum: currencyReserveNum.toFixed(2),
      playerTokenReserveNum: playerTokenReserveNum.toFixed(6),
      currentPrice: currentPrice.toFixed(6),
      k: k.toFixed(2),
      currencyReserveRaw: currencyReserve.toString(),
      playerTokenReserveRaw: playerTokenReserve.toString()
    });

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
    
    console.log('Price impact calculation result:', {
      ...result,
      priceImpact: result.priceImpact.toFixed(4) + '%',
      priceImpactSigned: result.priceImpactSigned.toFixed(4) + '%',
      currentPrice: result.currentPrice.toFixed(6) + ' USDC/token',
      newPrice: result.newPrice.toFixed(6) + ' USDC/token',
      tokensTraded: result.tokensTraded.toFixed(6),
      effectivePrice: result.effectivePrice?.toFixed(6) + ' USDC/token'
    });
    
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
