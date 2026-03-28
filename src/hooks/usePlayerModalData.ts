import { useState, useEffect, useRef, useCallback } from 'react';
import { formatUnits } from 'viem';
import { getContractData } from '../contracts';
import { readContractCached } from '../utils/contractCache';
import { usePoolInfo, type PriceImpactCalculation } from './usePoolInfo';
import { useAuthentication } from './useAuthentication';
import { useGridCache } from './useGridCache';
import { useTradingPhase } from './useTradingPhase';
import { useTradeQuote } from './useTradeQuote';
import { usePlayerTokenBalance } from './usePlayerTokenBalance';
import { useBondingCurveTrade } from './useBondingCurveTrade';
import { usePublicClient } from './usePublicClient';
import { usePrivy } from '@privy-io/react-auth';
import type { GridDetailedPlayerStats, SeriesState, MatchResult } from '../utils/api';
import { TradingPhase, type TradeQuote, type LaunchInfo, type LaunchProgress } from '../types/trading';

// ─── Player type (matches the interface in both modals) ───

export interface Player {
  id: number;
  name: string;
  game: string;
  position: string;
  price: string;
  trend: 'up' | 'down' | 'stable';
  points: number;
  rating: number;
  image: string;
  gridID?: string;
  teamGridId?: string;
  stats: {
    kills: number;
    deaths: number;
    assists: number;
    winRate: number;
  };
  recentMatches: Array<{
    opponent: string;
    result: 'win' | 'loss';
    score: string;
    performance: number;
  }>;
  level: number;
  xp: number;
  potential: number;
}

// ─── Hook params ───

export interface UsePlayerModalDataParams {
  player: Player | null;
  isOpen: boolean;
  /** Current buy/sell action — needed for quote and price impact */
  action: 'buy' | 'sell';
  /** Current input amount string — needed for quote */
  inputAmount: string;
}

// ─── Hook return type ───

export interface UsePlayerModalDataReturn {
  // Pool info
  poolData: Map<number, { currencyReserve: bigint; playerTokenReserve: bigint }>;
  poolLoading: boolean;
  poolError: string | null;
  fetchPoolInfo: (playerIds: number[]) => Promise<void>;
  calculatePriceImpact: (playerId: number, amount: string, action: 'buy' | 'sell') => PriceImpactCalculation | null;

  // Price
  currentPrice: number;
  formatPriceDisplay: (price: number) => string;

  // Trading phase
  tradingPhase: TradingPhase;
  launchInfo: LaunchInfo | null;
  launchProgress: LaunchProgress | null;
  userCurveBalance: bigint;
  refreshPhase: () => void;

  // Trade quote
  quote: TradeQuote;

  // Player token balance
  playerTokenBalance: bigint;
  playerTokenBalanceFormatted: string;
  refreshTokenBalance: () => void;

  // Bonding curve trade executor
  bondingCurveTrade: ReturnType<typeof useBondingCurveTrade>;

  // USDC balance
  userUsdcBalance: string;
  checkUserUsdcBalance: () => Promise<void>;

  // Grid.gg stats
  gridStats: GridDetailedPlayerStats | null;
  gridStatsLoading: boolean;
  seriesData: SeriesState[];
  seriesLoading: boolean;
  getRealRecentMatches: () => MatchResult[];

  // Auth
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authenticate: () => Promise<void>;
  authError: string | null;
  walletConnected: boolean;

  // Privy user
  user: ReturnType<typeof usePrivy>['user'];

  // Public client (for tx receipt waiting)
  publicClient: ReturnType<typeof usePublicClient>;
}

// ─── Hook implementation ───

export function usePlayerModalData({
  player,
  isOpen,
  action,
  inputAmount,
}: UsePlayerModalDataParams): UsePlayerModalDataReturn {
  // ── Privy ──
  const { user } = usePrivy();

  // ── Authentication ──
  const {
    isAuthenticated,
    isAuthenticating,
    authenticate,
    error: authError,
    walletConnected,
  } = useAuthentication();

  // ── Public client ──
  const publicClient = usePublicClient();

  // ── Pool info ──
  const {
    poolData,
    loading: poolLoading,
    error: poolError,
    fetchPoolInfo,
    calculatePriceImpact,
  } = usePoolInfo();

  // ── Trading phase ──
  const {
    phase: tradingPhase,
    launch: launchInfo,
    progress: launchProgress,
    userCurveBalance,
    refresh: refreshPhase,
  } = useTradingPhase(player?.id ?? null, user?.wallet?.address);

  // ── Trade quote (debounced) ──
  const quote = useTradeQuote({
    playerId: player?.id ?? null,
    action,
    inputAmount,
    phase: tradingPhase,
  });

  // ── Player token balance ──
  const {
    balance: playerTokenBalance,
    formattedBalance: playerTokenBalanceFormatted,
    refresh: refreshTokenBalance,
  } = usePlayerTokenBalance({
    playerId: player?.id ?? null,
    walletAddress: user?.wallet?.address,
    phase: tradingPhase,
  });

  // ── Bonding curve trade executor ──
  const bondingCurveTrade = useBondingCurveTrade();

  // ── Grid.gg data ──
  const { loadPlayerData } = useGridCache();
  const [gridStats, setGridStats] = useState<GridDetailedPlayerStats | null>(null);
  const [gridStatsLoading, setGridStatsLoading] = useState(false);
  const [seriesData, setSeriesData] = useState<SeriesState[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  // ── USDC balance ──
  const [userUsdcBalance, setUserUsdcBalance] = useState<string>('0');

  // ── Track which player IDs already had pool info fetched ──
  const fetchedPlayerIds = useRef<Set<number>>(new Set());

  // ── Check TUSDC balance ──
  const checkUserUsdcBalance = useCallback(async (): Promise<void> => {
    if (!user?.wallet?.address) return;
    try {
      const tusdcContract = getContractData('TUSDC');
      const balance = await readContractCached({
        address: tusdcContract.address as `0x${string}`,
        abi: tusdcContract.abi as any,
        functionName: 'balanceOf',
        args: [user.wallet.address as `0x${string}`],
      });
      setUserUsdcBalance(formatUnits(balance as bigint, 6));
    } catch {
      setUserUsdcBalance('0');
    }
  }, [user?.wallet?.address]);

  // ── Price helpers ──
  const formatPriceDisplay = useCallback((price: number): string => {
    if (price === 0) return '0.00000';
    const beforeDecimal = Math.floor(Math.log10(Math.abs(price))) + 1;
    if (beforeDecimal >= 5) return price.toFixed(0);
    if (beforeDecimal > 0) return price.toFixed(Math.max(0, 5 - beforeDecimal));
    const leadingZeros = Math.floor(-Math.log10(Math.abs(price)));
    return price.toFixed(leadingZeros + 4);
  }, []);

  const getRealPrice = useCallback((): number => {
    if (!player) return 0;
    const poolInfo = poolData.get(player.id);
    if (poolInfo && poolInfo.currencyReserve > 0n && poolInfo.playerTokenReserve > 0n) {
      const usdcReserve = Number(poolInfo.currencyReserve) / 1e6;
      const tokenReserve = Number(poolInfo.playerTokenReserve) / 1e18;
      return usdcReserve / tokenReserve;
    }
    return parseFloat(player.price);
  }, [player, poolData]);

  const currentPrice = getRealPrice();

  // ── Recent matches from Grid.gg series data ──
  const getRealRecentMatches = useCallback((): MatchResult[] => {
    if (!player || seriesData.length === 0) return [];
    const matches: MatchResult[] = [];
    for (const series of seriesData.slice(0, 3)) {
      const playerTeam = series.teams.find((team: any) => team.id === player.teamGridId);
      const opponentTeam = series.teams.find((team: any) => team.id !== player.teamGridId);
      if (!playerTeam || !opponentTeam) continue;
      matches.push({
        opponent: opponentTeam.name,
        result: playerTeam.won ? 'win' : 'loss',
        score: `${playerTeam.score}-${opponentTeam.score}`,
        performance: playerTeam.won
          ? Math.floor(Math.random() * 20) + 80
          : Math.floor(Math.random() * 30) + 50,
      });
    }
    return matches.slice(0, 3);
  }, [player, seriesData]);

  // ── Fetch initial data when modal opens ──
  useEffect(() => {
    if (isOpen && player) {
      // Fetch pool info if not already fetched for this player
      if (!fetchedPlayerIds.current.has(player.id)) {
        fetchedPlayerIds.current.add(player.id);
        fetchPoolInfo([player.id]);
      }

      // Check USDC balance
      if (isAuthenticated && user?.wallet?.address) {
        checkUserUsdcBalance();
      }
    }

    // Reset when modal closes
    if (!isOpen) {
      fetchedPlayerIds.current.clear();
    }
  }, [isOpen, player, isAuthenticated, user?.wallet?.address, fetchPoolInfo, checkUserUsdcBalance]);

  // ── Auto-authenticate ──
  useEffect(() => {
    const autoAuthenticate = async () => {
      if (!isAuthenticated && walletConnected && !isAuthenticating) {
        try {
          await authenticate();
        } catch (error) {
          console.error('Failed to auto-authenticate:', error);
        }
      }
    };
    autoAuthenticate();
  }, [isAuthenticated, walletConnected, isAuthenticating, authenticate]);

  // ── Fetch Grid.gg data ──
  useEffect(() => {
    const fetchAllGridData = async () => {
      if (isOpen && player && player.gridID && player.teamGridId) {
        setGridStatsLoading(true);
        setSeriesLoading(true);
        try {
          const { stats, seriesStates } = await loadPlayerData(player.gridID, player.teamGridId);
          if (stats) setGridStats(stats);
          if (seriesStates.length > 0) setSeriesData(seriesStates);
        } catch (error) {
          console.error('Error loading Grid.gg data:', error);
        } finally {
          setGridStatsLoading(false);
          setSeriesLoading(false);
        }
      }
    };
    fetchAllGridData();
  }, [isOpen, player?.gridID, player?.teamGridId, loadPlayerData]);

  return {
    // Pool
    poolData,
    poolLoading,
    poolError,
    fetchPoolInfo,
    calculatePriceImpact,

    // Price
    currentPrice,
    formatPriceDisplay,

    // Trading phase
    tradingPhase,
    launchInfo,
    launchProgress,
    userCurveBalance,
    refreshPhase,

    // Quote
    quote,

    // Player token balance
    playerTokenBalance,
    playerTokenBalanceFormatted,
    refreshTokenBalance,

    // Bonding curve
    bondingCurveTrade,

    // USDC
    userUsdcBalance,
    checkUserUsdcBalance,

    // Grid
    gridStats,
    gridStatsLoading,
    seriesData,
    seriesLoading,
    getRealRecentMatches,

    // Auth
    isAuthenticated,
    isAuthenticating,
    authenticate,
    authError,
    walletConnected,

    // Privy
    user,

    // Public client
    publicClient,
  };
}
