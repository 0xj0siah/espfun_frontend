import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy } from "@privy-io/react-auth";
import type { SmartWallet } from "@privy-io/react-auth";
import { formatEther } from 'viem';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Skeleton } from './ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion } from 'motion/react';
import { Users, TrendingUp, Zap, Star, Trophy, Target, FileText, Clock } from 'lucide-react';
import PlayerPurchaseModal from './PlayerPurchaseModal';
import ContractExtensionModal from './ContractExtensionModal';
import { PromotionMenu } from './PromotionMenu';
import { toast } from "sonner";
import { usePlayerPrices } from '../hooks/usePlayerPricing';
import fakeData from '../fakedata.json';
import { getDevelopmentPlayersData, testDevelopmentPlayersContract, getActivePlayerIds, getPlayerBalance, getMultiplePlayerBalances } from '../utils/contractInteractions';
import { getContractData } from '../contracts';
import { readContractCached, contractCache } from '../utils/contractCache';
import { usePoolInfo } from '../hooks/usePoolInfo';
import { useGridCache } from '../hooks/useGridCache';
import { useGameContext } from '../context/GameContext';
import { apiService } from '../services/apiService';

const formatUSDC = (value: number): string => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B USDC`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M USDC`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K USDC`;
  if (value >= 1) return `$${value.toFixed(2)} USDC`;
  if (value >= 0.01) return `$${value.toFixed(4)} USDC`;
  if (value > 0) {
    const leadingZeros = Math.max(0, Math.floor(-Math.log10(value)));
    return `$${value.toFixed(leadingZeros + 2)} USDC`;
  }
  return '$0.00 USDC';
};

interface PlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  winRate: number;
}

interface MatchResult {
  opponent: string;
  result: "win" | "loss";
  score: string;
  performance: number;
}

interface Player {
  id: number;
  name: string;
  game: string;
  position: string;
  price: string;
  points: number;
  trend: "up" | "down" | "stable";
  rating: number;
  image: string;
  gridID?: string; // Optional - from GRID API
  teamGridId?: string; // Optional - from GRID API
  stats: PlayerStats;
  recentMatches: MatchResult[];
  level: number;
  xp: number;
  potential: number;
  lockedShares?: string; // Optional property for development players
  ownedShares?: bigint; // Owned shares from Player contract
  unclaimedBalance?: bigint; // Unclaimed tokens from graduated bonding curve
  totalValue?: string; // Total value of owned shares
  gamesRemaining?: number; // Games remaining on contract
}

// Type for Privy's wallet
interface EmbeddedWallet {
  sendTransaction: (tx: {
    to: string;
    value: string;
    data?: string;
  }) => Promise<string>;
}

interface PrivyWallet extends SmartWallet {
  address: string;
  embeddedWallet: EmbeddedWallet;
}

export default function TeamSection({
  preloadedPrices = {},
  pricesLoading = false,
  onAdvancedView,
}: {
  preloadedPrices?: Record<number, string>;
  pricesLoading?: boolean;
  onAdvancedView?: (player: any) => void;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('squad');
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [ownedPlayers, setOwnedPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [selectedContractPlayer, setSelectedContractPlayer] = useState<Player | null>(null);
  const [isPromotionMenuOpen, setIsPromotionMenuOpen] = useState(false);
  const [priceChanges, setPriceChanges] = useState<Record<string, number | null>>({});
  const [selectedPromotionPlayer, setSelectedPromotionPlayer] = useState<any | null>(null);
  const [developmentPlayers, setDevelopmentPlayers] = useState<{
    playerIds: bigint[];
    lockedBalances: bigint[];
    totalPlayers: number;
  }>({
    playerIds: [],
    lockedBalances: [],
    totalPlayers: 0
  });
  const [developmentLoading, setDevelopmentLoading] = useState(false);
  const { user, authenticated } = usePrivy();
  const { preloadPlayersData } = useGridCache();
  const { selectedGame } = useGameContext();

  // Fetch real 24h price changes
  useEffect(() => {
    apiService.getPlayerPriceChanges()
      .then((data: any) => {
        const map: Record<string, number | null> = {};
        for (const p of data.players || []) {
          map[p.playerTokenId] = p.change24h;
        }
        setPriceChanges(map);
      })
      .catch(() => {});
  }, []);

  // Add pool data hook for accurate pricing
  const { poolData, fetchPoolInfo } = usePoolInfo();

  // Helper function to format shares from wei to readable number
  const formatShares = (wei: bigint): string => {
    try {
      // If the value is in wei (18 decimals), convert to ether and round to whole number
      const etherValue = formatEther(wei);
      const numValue = parseFloat(etherValue);
      return Math.round(numValue).toString();
    } catch (error) {
      console.error('Error formatting shares:', error);
      return '0';
    }
  };

  // Use preloaded prices from App component
  const playerPrices = preloadedPrices;

  // Derive effective prices: pool reserves take precedence over getPrices hook
  const effectivePrices = useMemo(() => {
    const combined: Record<number, string> = { ...playerPrices };

    poolData.forEach((pool, playerId) => {
      if (pool.currencyReserve > 0n && pool.playerTokenReserve > 0n) {
        const usdcReserve = Number(pool.currencyReserve) / 1e6;
        const tokenReserve = Number(pool.playerTokenReserve) / 1e18;
        const price = usdcReserve / tokenReserve;
        // Keep full precision so total value calculations aren't truncated
        if (price >= 1) {
          combined[playerId] = `${price.toFixed(2)} USDC`;
        } else if (price >= 0.01) {
          combined[playerId] = `${price.toFixed(4)} USDC`;
        } else if (price > 0) {
          const leadingZeros = Math.max(0, Math.floor(-Math.log10(price)));
          combined[playerId] = `${price.toFixed(leadingZeros + 2)} USDC`;
        }
      }
    });

    return combined;
  }, [playerPrices, poolData]);

  // Memoize calculateTotalValue to prevent unnecessary recalculations
  const calculateTotalValue = useMemo(() => {
    return (ownedShares: bigint, playerId: number): string => {
      try {
        const shares = parseFloat(formatEther(ownedShares));
        
        // Try to get real price from pool data first
        const poolInfo = poolData.get(playerId);
        let pricePerShare = 0;
        
        if (poolInfo && poolInfo.currencyReserve > 0n && poolInfo.playerTokenReserve > 0n) {
          // Calculate real price from pool reserves: USDC reserve / token reserve
          const usdcReserve = Number(poolInfo.currencyReserve) / 1e6; // USDC has 6 decimals
          const tokenReserve = Number(poolInfo.playerTokenReserve) / 1e18; // Tokens have 18 decimals
          pricePerShare = usdcReserve / tokenReserve;
          // Real pool price calculated from reserves
        } else {
          // Fallback to pricing hook data
          const fallbackPrice = playerPrices[playerId] || '0.000 USDC';
          pricePerShare = parseFloat(fallbackPrice.replace(/[^\d.-]/g, '')) || 0;
          // Fallback to pricing hook data
        }
        
        const totalValue = shares * pricePerShare;
        return formatUSDC(totalValue);
      } catch (error) {
        console.error('Error calculating total value:', error);
        return '0.000 USDC';
      }
    };
  }, [poolData, playerPrices]);

  // Fetch owned players and their balances using batched balanceOfBatch call
  // Also checks BondingCurve for graduated launches with unclaimed tokens
  const fetchOwnedPlayers = async (userAddress: string) => {
    try {
      // Get all active player IDs
      const activePlayerIds = await getActivePlayerIds();
      console.log('Active player IDs:', activePlayerIds);

      // Get balances for all active players in a single batched call (avoids rate limiting)
      console.log('Calling balanceOfBatch for all active players...');
      const balances = await getMultiplePlayerBalances(userAddress, activePlayerIds);

      // Filter players that the user owns (balance > 0)
      const ownedPlayerData = activePlayerIds
        .map((playerId, index) => ({
          playerId,
          balance: balances[index],
          unclaimedBalance: 0n,
        }))
        .filter(({ balance }) => balance > 0n);

      // Also check BondingCurve for graduated launches with unclaimed tokens
      const bondingCurveContract = getContractData('BondingCurve');
      const hasBC = bondingCurveContract.address && bondingCurveContract.address !== '0x0000000000000000000000000000000000000000';

      let unclaimedPlayers: { playerId: bigint; unclaimedBalance: bigint }[] = [];
      if (hasBC) {
        try {
          const allLaunchIds = await readContractCached({
            address: bondingCurveContract.address as `0x${string}`,
            abi: bondingCurveContract.abi as any,
            functionName: 'getAllLaunchIds',
            args: [],
          }) as bigint[];

          if (allLaunchIds.length > 0) {
            // For each launched player, check if graduated and user has unclaimed balance
            const launchChecks = await Promise.all(
              allLaunchIds.map(async (pid) => {
                try {
                  const launchInfo = await readContractCached({
                    address: bondingCurveContract.address as `0x${string}`,
                    abi: bondingCurveContract.abi as any,
                    functionName: 'getLaunchInfo',
                    args: [pid],
                  }) as any;

                  const graduated = launchInfo.graduated ?? launchInfo[10] ?? false;
                  if (!graduated) return null;

                  const userBalance = await readContractCached({
                    address: bondingCurveContract.address as `0x${string}`,
                    abi: bondingCurveContract.abi as any,
                    functionName: 'getUserBalance',
                    args: [pid, userAddress],
                  }) as bigint;

                  if (userBalance > 0n) {
                    return { playerId: pid, unclaimedBalance: userBalance };
                  }
                } catch {
                  // Skip this player on error
                }
                return null;
              })
            );

            unclaimedPlayers = launchChecks.filter((x): x is NonNullable<typeof x> => x !== null);
            console.log('Unclaimed graduated players:', unclaimedPlayers);
          }
        } catch (err) {
          console.error('Error checking bonding curve unclaimed balances:', err);
        }
      }

      // Merge unclaimed players into owned list (avoid duplicates)
      const ownedIds = new Set(ownedPlayerData.map(p => Number(p.playerId)));
      for (const unclaimed of unclaimedPlayers) {
        const pid = Number(unclaimed.playerId);
        if (ownedIds.has(pid)) {
          // Player already in owned list — attach unclaimedBalance
          const existing = ownedPlayerData.find(p => Number(p.playerId) === pid);
          if (existing) existing.unclaimedBalance = unclaimed.unclaimedBalance;
        } else {
          // Player not in owned list — add as unclaimed-only entry
          ownedPlayerData.push({
            playerId: unclaimed.playerId,
            balance: 0n,
            unclaimedBalance: unclaimed.unclaimedBalance,
          });
        }
      }

      if (ownedPlayerData.length === 0) {
        setOwnedPlayers([]);
        return;
      }

      // Create player objects for owned players
      const ownedPlayersList = ownedPlayerData.map(({ playerId, balance, unclaimedBalance }) => {
        const playerIdNum = Number(playerId);
        const basePlayerData = fakeData.teamPlayers.find(p => p.id === playerIdNum) ||
          fakeData.teamPlayers[playerIdNum % fakeData.teamPlayers.length];

        // Use whichever balance is available for value calculation
        const displayBalance = balance > 0n ? balance : unclaimedBalance;

        return {
          ...basePlayerData,
          id: playerIdNum,
          price: effectivePrices[playerIdNum] || (pricesLoading ? 'Loading...' : '0.00 USDC'),
          points: 0,
          ownedShares: balance,
          unclaimedBalance: unclaimedBalance > 0n ? unclaimedBalance : undefined,
          totalValue: calculateTotalValue(displayBalance, playerIdNum),
          gamesRemaining: (playerIdNum % 10) + 1,
          level: 1,
          xp: 50,
          potential: 75,
          gridID: basePlayerData.gridID || undefined,
          teamGridId: basePlayerData.teamGridId || undefined,
          trend: (basePlayerData.trend as "up" | "down" | "stable") || "stable",
          recentMatches: basePlayerData.recentMatches.map(match => ({
            ...match,
            result: match.result as "win" | "loss"
          }))
        };
      });

      setOwnedPlayers(ownedPlayersList);

      // Fetch pool data for accurate pricing
      const playerIdsForPool = ownedPlayerData.map(({ playerId }) => Number(playerId));
      if (playerIdsForPool.length > 0) {
        await fetchPoolInfo(playerIdsForPool);
      }

      // Preload Grid.gg data for owned players (with delay to avoid connection issues)
      setTimeout(() => {
        console.log('🔄 Starting Grid.gg data preload for owned players...');
        preloadPlayersData(ownedPlayersList, 150);
      }, 500);
    } catch (error) {
      console.error('Error fetching owned players:', error);
      setOwnedPlayers([]);
    }
  };

  // Create development player objects from contract data and fake data
  const developmentPlayersWithData = useMemo(() => {
    return developmentPlayers.playerIds.map((playerId, index) => {
      const playerIdNum = Number(playerId);
      const lockedBalance = developmentPlayers.lockedBalances[index] || BigInt(0);
      
      // Find matching player data from fakeData, or create a default one
      const basePlayerData = fakeData.teamPlayers.find(p => p.id === playerIdNum) || {
        id: playerIdNum,
        name: `Player ${playerIdNum}`,
        game: "Unknown",
        position: "Development",
        price: "0 USDC",
        trend: "stable" as const,
        points: 0,
        rating: 50,
        image: "/images/default-player.webp",
        stats: {
          kills: 0,
          deaths: 0,
          assists: 0,
          winRate: 0
        },
        recentMatches: []
      };

      return {
        ...basePlayerData,
        // Add missing fields for interface compatibility
        level: 1,
        xp: 50,
        potential: 75, // Higher potential for development players
        // Update with contract data - no fallback to fake data
        price: effectivePrices[playerIdNum] || (pricesLoading ? 'Loading...' : '0.00 USDC'),
        // Add development-specific info with formatted shares
        lockedShares: formatShares(lockedBalance),
        // Calculate total value using the same logic as active players
        totalValue: calculateTotalValue(lockedBalance, playerIdNum),
        // Ensure types are properly cast
        trend: basePlayerData.trend as "up" | "down" | "stable",
        recentMatches: basePlayerData.recentMatches.map(match => ({
          ...match,
          result: match.result as "win" | "loss"
        }))
      };
    });
  }, [developmentPlayers.playerIds, developmentPlayers.lockedBalances, effectivePrices, poolData]);

  const handleDevelopmentPlayerClick = (player: any) => {
    // Convert the development player to promotion menu format
    const promotionPlayer = {
      id: player.id.toString(),
      name: player.name,
      position: player.position,
      team: player.game, // Using game as team for esports context
      image: player.image,
      tier: 'rookie' as const, // All development players start as rookie
      price: parseFloat(player.price.replace(/[^\d.-]/g, '')) || 0,
      change: 0,
      canPromote: true, // All development players can be promoted
      canCut: true, // Allow cutting development players too
      lockedShares: player.lockedShares // Pass through the formatted locked shares
    };
    
    setSelectedPromotionPlayer(promotionPlayer);
    setIsPromotionMenuOpen(true);
  };

  useEffect(() => {
    // Use fake data and merge with effective prices (pool reserves + hook data)
    const playersWithPricing: Player[] = fakeData.teamPlayers.filter(player => player.game === selectedGame).map(player => {
      const price = effectivePrices[player.id];
      const finalPrice = price || (pricesLoading ? 'Loading...' : '0.00 USDC');

      return {
        ...player,
        level: 1,
        xp: 50,
        potential: 50,
        gridID: player.gridID || undefined,
        teamGridId: player.teamGridId || undefined,
        trend: player.trend as "up" | "down" | "stable",
        recentMatches: player.recentMatches.map(match => ({
          ...match,
          result: match.result as "win" | "loss"
        })),
        price: finalPrice
      };
    });

    setTeamPlayers(playersWithPricing);
    setLoading(false);
  }, [effectivePrices, pricesLoading, selectedGame]);

  // Fetch owned players when component mounts or wallet changes
  useEffect(() => {
    const loadOwnedPlayers = async () => {
      if (!authenticated || !user?.wallet?.address) {
        setOwnedPlayers([]);
        return;
      }
      setLoading(true);
      try {
        await fetchOwnedPlayers(user.wallet.address);
      } catch (error) {
        setOwnedPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    loadOwnedPlayers();
  }, [authenticated, user?.wallet?.address]); // Revert dependency array

  // Fetch development players data
  useEffect(() => {
    const fetchDevelopmentPlayers = async () => {
      if (!authenticated || !user?.wallet?.address) {
        return;
      }
      setDevelopmentLoading(true);
      try {
        const data = await getDevelopmentPlayersData(user.wallet.address);
        setDevelopmentPlayers(data);
      } catch (error) {
        console.error('Error fetching development players:', error);
        toast.error('Failed to load development players data');
      } finally {
        setDevelopmentLoading(false);
      }
    };

    fetchDevelopmentPlayers();
  }, [authenticated, user?.wallet?.address]);

  // Filter owned players by selected game
  const filteredOwnedPlayers = useMemo(() => {
    return ownedPlayers.filter(player => player.game === selectedGame);
  }, [ownedPlayers, selectedGame]);

  // Update owned players prices when effectivePrices changes (without re-fetching balances)
  useEffect(() => {
    if (ownedPlayers.length > 0 && Object.keys(effectivePrices).length > 0) {
      setOwnedPlayers(prevPlayers =>
        prevPlayers.map(player => {
          const updatedPrice = effectivePrices[player.id];
          if (updatedPrice && updatedPrice !== player.price) {
            return {
              ...player,
              price: updatedPrice,
              totalValue: calculateTotalValue(player.ownedShares || BigInt(0), player.id)
            };
          }
          return player;
        })
      );
    }
  }, [effectivePrices, calculateTotalValue]);

  const handlePurchase = async (player: Player, usdcAmount: string, action: 'buy' | 'sell', slippage: number) => {
    if (!authenticated || !user?.wallet?.address) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      // Transaction is already handled by PlayerPurchaseModal
      // This callback is only for UI state updates
      
      if (action === 'buy') {
        // Update local state to reflect purchase
        setTeamPlayers(prevPlayers => [...prevPlayers, player]);
        toast.success(`Successfully purchased ${player.name}!`);
      } else {
        // For sell action, remove from team or update state as needed
        setTeamPlayers(prevPlayers => prevPlayers.filter(p => p.id !== player.id));
        toast.success(`Successfully sold ${player.name}!`);
      }
      
      // No automatic modal close - user controls when to close

    } catch (error) {
      console.error("Purchase state update failed:", error);
      toast.error("Failed to update player state. Please refresh the page.");
    }
  };

  const handleContractExtension = async (player: Player, numberOfGames: number, totalCost: string) => {
    if (!authenticated || !user?.wallet?.address) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      // TODO: Integrate with PlayerContracts contract
      // This will call the renewContract function:
      // renewContract(address _user, uint256 _playerId, uint256 _price, uint256 _numberOfMatches, address _paymentToken)
      
      console.log('Extending contract:', {
        player: player.name,
        playerId: player.id,
        numberOfGames,
        totalCost,
        userAddress: user.wallet.address
      });

      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update local state to reflect extension
      setOwnedPlayers(prevPlayers => 
        prevPlayers.map(p => 
          p.id === player.id 
            ? { ...p, gamesRemaining: (p.gamesRemaining || 0) + numberOfGames }
            : p
        )
      );

      toast.success(`Successfully extended ${player.name}'s contract by ${numberOfGames} games!`);

    } catch (error) {
      console.error("Contract extension failed:", error);
      throw error; // Re-throw to be handled by modal
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-3"
        >
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Your Fantasy Team
            </h2>
            <p className="text-sm text-muted-foreground">{t('team.manageSquad')}</p>
          </div>
        </motion.div>
        <Badge variant="secondary" className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-0">
          Total Value: {formatUSDC(filteredOwnedPlayers.reduce((total, player) => {
            const value = parseFloat(player.totalValue?.replace(/[^\d.-]/g, '') || '0');
            return total + value;
          }, 0))}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-accent/50 rounded-xl p-1">
          <TabsTrigger value="squad" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="w-4 h-4 mr-2" />
            Active
          </TabsTrigger>
          <TabsTrigger value="development" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <TrendingUp className="w-4 h-4 mr-2" />
            Benched
          </TabsTrigger>
          {
          <TabsTrigger value="contracts" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="w-4 h-4 mr-2" />
            Contracts
          </TabsTrigger>
          }
        </TabsList>

        <TabsContent value="squad" className="space-y-6">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="relative overflow-hidden p-4 border-0 shadow-lg bg-gradient-to-br from-background via-accent/20 to-accent/40">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3 flex-1">
                      <Skeleton className="w-14 h-14 rounded-xl" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredOwnedPlayers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Owned Players</h3>
              <p className="text-muted-foreground">{t('team.noPlayersOwned')}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredOwnedPlayers.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => {
                    setSelectedPlayer(player);
                    setIsModalOpen(true);
                  }}
                  className="cursor-pointer group"
                >
                  <Card className={`relative overflow-hidden p-4 border-0 shadow-lg hover:shadow-xl hover:ring-1 hover:ring-primary/10 transition-all duration-300 bg-gradient-to-br from-background via-accent/20 to-accent/40 group-hover:scale-105 active:scale-[0.98] active:shadow-inner ${player.unclaimedBalance ? 'ring-2 ring-green-400/60' : ''}`}>
                    {/* Unclaimed banner */}
                    {player.unclaimedBalance && (
                      <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-semibold text-center py-1 z-20">
                        {t('team.graduatedClaim')}
                      </div>
                    )}
                    {/* Background gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-300" />

                    {/* Content container */}
                    <div className={`relative z-10 ${player.unclaimedBalance ? 'mt-4' : ''}`}>
                      {/* Header row with player info and shares badge */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="relative">
                            {/* Team logo background */}
                            <div
                              className="absolute inset-0 rounded-xl opacity-50 z-0"
                              style={{
                                backgroundImage: `url(${player.image.replace(/\/[^\/]*$/, '/logo.webp')})`,
                                backgroundSize: 'contain',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat'
                              }}
                            />
                            <ImageWithFallback
                              src={player.image}
                              alt={player.name}
                              className="relative z-10 w-14 h-14 rounded-xl object-contain shadow-md ring-2 ring-white/20 group-hover:ring-blue-200 transition-all duration-300 opacity-85"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground group-hover:text-blue-700 transition-colors duration-200 truncate">
                              {player.name}
                            </h3>
                            <p className="text-xs text-muted-foreground/80 truncate flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                              {player.game} • {player.position}
                            </p>
                          </div>
                        </div>
                        {/* Shares badge with enhanced styling */}
                        <div className="flex flex-col items-end ml-3 gap-1">
                          {player.ownedShares && player.ownedShares > 0n ? (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200/50 px-3 py-1 shadow-sm font-medium"
                            >
                              {formatShares(player.ownedShares)} {t('team.shares')}
                            </Badge>
                          ) : null}
                          {player.unclaimedBalance && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200/50 px-3 py-1 shadow-sm font-medium"
                            >
                              {formatShares(player.unclaimedBalance)} {t('team.unclaimed')}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant="outline"
                            className="text-xs px-3 py-1 bg-background/50 border-border/40 hover:bg-accent/50 transition-colors font-medium"
                          >
                            {player.price}
                          </Badge>
                          {/* 24h price change */}
                          {(() => {
                            const change = priceChanges[String(player.id)];
                            if (change == null) return null;
                            const isPositive = change >= 0;
                            return (
                              <div className="flex items-center space-x-1">
                                <div className={`w-2 h-2 ${isPositive ? 'bg-green-500' : 'bg-red-500'} rounded-full`} />
                                <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {isPositive ? '+' : ''}{change.toFixed(1)}%
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Total value with enhanced styling */}
                        <div className="text-right">
                          <div className="text-sm font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            {player.totalValue || '0.000 USDC'}
                          </div>
                          <div className="text-xs text-muted-foreground/60">{t('team.totalValue')}</div>
                        </div>
                      </div>
                    </div>

                    {/* Hover effect border */}
                    <div className={`absolute inset-0 rounded-lg border-2 border-transparent ${player.unclaimedBalance ? 'group-hover:border-green-300/50' : 'group-hover:border-blue-200/50'} transition-colors duration-300`} />
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
          {/* PlayerPurchaseModal - moved outside TabsContent to prevent layout conflicts */}
          {selectedPlayer && (
            <PlayerPurchaseModal
              player={selectedPlayer}
              isOpen={isModalOpen}
              onClose={() => {
                setIsModalOpen(false);
                setSelectedPlayer(null);
                // Invalidate all relevant caches so claimed tokens and new balances appear immediately
                contractCache.invalidateCache(undefined, 'balanceOf');
                contractCache.invalidateCache(undefined, 'balanceOfBatch');
                contractCache.invalidateCache(undefined, 'getUserBalance');
                contractCache.invalidateCache(undefined, 'getActivePlayerIds');
                contractCache.invalidateCache(undefined, 'getAllLaunchIds');
                contractCache.invalidateCache(undefined, 'getLaunchInfo');
                if (user?.wallet?.address) {
                  fetchOwnedPlayers(user.wallet.address);
                }
              }}
              onPurchase={handlePurchase}
              onAdvancedView={onAdvancedView}
            />
          )}
        </TabsContent>

        <TabsContent value="development" className="space-y-6">
          {developmentLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="relative overflow-hidden p-4 border-0 shadow-lg bg-gradient-to-br from-background via-accent/20 to-accent/40">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3 flex-1">
                      <Skeleton className="w-14 h-14 rounded-xl" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </Card>
              ))}
            </div>
          ) : developmentPlayers.totalPlayers === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Benched Players</h3>
              <p className="text-muted-foreground">Players from packs start here. Spend skill points to activate them in your lineup.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {developmentPlayersWithData.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleDevelopmentPlayerClick(player)}
                  className="cursor-pointer group"
                >
                  <Card className="relative overflow-hidden p-4 border-0 shadow-lg hover:shadow-xl hover:ring-1 hover:ring-primary/10 transition-all duration-300 bg-gradient-to-br from-background via-accent/20 to-accent/40 group-hover:scale-105 active:scale-[0.98] active:shadow-inner">
                    {/* Background gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/20 dark:to-pink-900/20 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-300" />
                    
                    {/* Content container */}
                    <div className="relative z-10">
                      {/* Header row with player info and shares badge */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="relative">
                            {/* Team logo background */}
                            <div 
                              className="absolute inset-0 rounded-xl opacity-50 z-0"
                              style={{
                                backgroundImage: `url(${player.image.replace(/\/[^\/]*$/, '/logo.webp')})`,
                                backgroundSize: 'contain',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat'
                              }}
                            />
                            <ImageWithFallback
                              src={player.image}
                              alt={player.name}
                              className="relative z-10 w-14 h-14 rounded-xl object-contain shadow-md ring-2 ring-white/20 group-hover:ring-purple-200 transition-all duration-300 opacity-85"
                            />
                            {/* Benched badge overlay */}
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center z-20">
                              <TrendingUp className="w-3 h-3 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground group-hover:text-purple-700 transition-colors duration-200 truncate">
                              {player.name}
                            </h3>
                            <p className="text-xs text-muted-foreground/80 truncate flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                              {player.game} • {player.position}
                            </p>
                          </div>
                        </div>
                        {/* Locked shares badge */}
                        <div className="flex flex-col items-end ml-3">
                          <Badge
                            variant="secondary"
                            className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200/50 px-3 py-1 shadow-sm font-medium"
                          >
                            {player.lockedShares} {t('team.shares')}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Stats row */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant="outline" 
                            className="text-xs px-3 py-1 bg-background/50 border-border/40 hover:bg-accent/50 transition-colors font-medium"
                          >
                            {player.price}
                          </Badge>
                          {/* Benched status indicator */}
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-amber-500 rounded-full" />
                            <span className="text-xs text-amber-600 font-medium">Benched</span>
                          </div>
                        </div>
                        
                        {/* Total value with enhanced styling */}
                        <div className="text-right">
                          <div className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                            {player.totalValue || '0.000 USDC'}
                          </div>
                          <div className="text-xs text-muted-foreground/60">{t('team.totalValue')}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Hover effect border */}
                    <div className="absolute inset-0 rounded-lg border-2 border-transparent group-hover:border-purple-200/50 transition-colors duration-300" />
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
          {/* PromotionMenu for development players */}
          <PromotionMenu
            isOpen={isPromotionMenuOpen}
            onClose={() => {
              setIsPromotionMenuOpen(false);
              setSelectedPromotionPlayer(null);
            }}
            player={selectedPromotionPlayer}
          />
        </TabsContent>

        <TabsContent value="contracts" className="space-y-6">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start space-x-3 mb-4">
                    <Skeleton className="w-14 h-14 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                  <div className="space-y-3 pt-3 border-t">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2 w-full rounded-full" />
                    <Skeleton className="h-9 w-full rounded" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredOwnedPlayers.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Active Contracts</h3>
              <p className="text-muted-foreground">{t('team.noPlayersOwned')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Contract Extensions Available
                    </h4>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Extend your player contracts to keep them performing in your roster. Each extension adds more games to their contract.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredOwnedPlayers.map((player, index) => {
                  // Deterministic placeholder (will be replaced with backend data later)
                  const gamesRemaining = player.gamesRemaining ?? ((player.id % 10) + 1);
                  const contractStatus = gamesRemaining <= 3 ? 'expiring' : gamesRemaining <= 6 ? 'active' : 'healthy';
                  const extensionPrice = (parseFloat(player.price) * 0.1).toFixed(4); // 10% of player price as extension cost
                  
                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="relative overflow-hidden p-4 border-0 shadow-lg hover:shadow-xl hover:ring-1 hover:ring-primary/10 transition-all duration-300 bg-gradient-to-br from-background via-accent/20 to-accent/40">
                        {/* Status indicator */}
                        <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
                          contractStatus === 'expiring' ? 'bg-red-500 animate-pulse' :
                          contractStatus === 'active' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`} />
                        
                        {/* Player Header */}
                        <div className="flex items-start space-x-3 mb-4">
                          <div className="relative">
                            <div 
                              className="absolute inset-0 rounded-xl opacity-50"
                              style={{
                                backgroundImage: `url(${player.image.replace(/\/[^\/]*$/, '/logo.webp')})`,
                                backgroundSize: 'contain',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat'
                              }}
                            />
                            <ImageWithFallback
                              src={player.image}
                              alt={player.name}
                              className="relative w-14 h-14 rounded-xl object-contain shadow-md ring-2 ring-white/20"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground truncate">
                              {player.name}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">
                              {player.game} • {player.position}
                            </p>
                            <Badge 
                              variant="secondary" 
                              className="mt-1 text-xs"
                            >
                              {formatShares(player.ownedShares || BigInt(0))} {t('team.shares')}
                            </Badge>
                          </div>
                        </div>

                        {/* Contract Status */}
                        <div className="space-y-3 pt-3 border-t border-border/30">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Games Remaining</span>
                            <span className={`text-sm font-bold ${
                              contractStatus === 'expiring' ? 'text-red-600' :
                              contractStatus === 'active' ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {gamesRemaining} games
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Extension Cost</span>
                            <span className="text-sm font-semibold">
                              {extensionPrice} USDC
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Contract Status</span>
                              <span className={`font-medium ${
                                contractStatus === 'expiring' ? 'text-red-600 dark:text-red-400' :
                                contractStatus === 'active' ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-green-600 dark:text-green-400'
                              }`}>
                                {contractStatus === 'expiring' ? 'Expiring Soon' :
                                 contractStatus === 'active' ? 'Active' :
                                 'Healthy'}
                              </span>
                            </div>
                            <Progress
                              value={Math.min((gamesRemaining / 10) * 100, 100)}
                              className={`h-2 ${
                                contractStatus === 'expiring' ? '[&>[data-slot=progress-indicator]]:bg-red-500' :
                                contractStatus === 'active' ? '[&>[data-slot=progress-indicator]]:bg-yellow-500' :
                                '[&>[data-slot=progress-indicator]]:bg-green-500'
                              }`}
                            />
                          </div>

                          {/* Extend Button */}
                          <Button 
                            className={`w-full mt-2 ${
                              contractStatus === 'expiring' 
                                ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700' 
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                            }`}
                            size="sm"
                            onClick={() => {
                              setSelectedContractPlayer({ ...player, gamesRemaining });
                              setIsContractModalOpen(true);
                            }}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Extend Contract
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Contract Extension Modal */}
      <ContractExtensionModal
        player={selectedContractPlayer}
        isOpen={isContractModalOpen}
        onClose={() => {
          setIsContractModalOpen(false);
          setSelectedContractPlayer(null);
        }}
        onExtend={handleContractExtension}
      />
    </div>
  );
}