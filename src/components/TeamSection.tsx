import { useState, useEffect, useMemo } from 'react';
import { usePrivy } from "@privy-io/react-auth";
import type { SmartWallet } from "@privy-io/react-auth";
import { formatEther } from 'viem';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion } from 'motion/react';
import { Users, TrendingUp, Zap, Star, Trophy, Target, Activity } from 'lucide-react';
import PlayerPurchaseModal from './PlayerPurchaseModal';
import { PromotionMenu } from './PromotionMenu';
import { toast } from "sonner";
import { usePlayerPrices } from '../hooks/usePlayerPricing';
import fakeData from '../fakedata.json';
import { getDevelopmentPlayersData, testDevelopmentPlayersContract, getActivePlayerIds, getPlayerBalance } from '../utils/contractInteractions';
import { usePoolInfo } from '../hooks/usePoolInfo';

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
  stats: PlayerStats;
  recentMatches: MatchResult[];
  level: number;
  xp: number;
  potential: number;
  lockedShares?: string; // Optional property for development players
  ownedShares?: bigint; // Owned shares from Player contract
  totalValue?: string; // Total value of owned shares
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
  pricesLoading = false 
}: { 
  preloadedPrices?: Record<number, string>;
  pricesLoading?: boolean;
}) {
  const [activeTab, setActiveTab] = useState('squad');
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [ownedPlayers, setOwnedPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPromotionMenuOpen, setIsPromotionMenuOpen] = useState(false);
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
  const [testResults, setTestResults] = useState<{
    contractAddress: string;
    isConnected: boolean;
    userPlayerIds: bigint[];
    sampleLockedBalance?: bigint;
    error?: string;
  } | null>(null);

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

  // Debug logging
  console.log('🎯 TeamSection: preloadedPrices keys:', Object.keys(preloadedPrices || {}));
  console.log('🎯 TeamSection: pricesLoading:', pricesLoading);

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
          console.log(`🔄 Using real pool price for player ${playerId}: ${pricePerShare.toFixed(8)} USDC per token`);
        } else {
          // Fallback to pricing hook data
          const fallbackPrice = playerPrices[playerId] || '0.000 USDC';
          pricePerShare = parseFloat(fallbackPrice.replace(/[^\d.-]/g, '')) || 0;
          console.log(`⚠️ Using fallback price for player ${playerId}: ${pricePerShare} USDC per token`);
        }
        
        const totalValue = shares * pricePerShare;
        return `${totalValue.toFixed(3)} USDC`;
      } catch (error) {
        console.error('Error calculating total value:', error);
        return '0.000 USDC';
      }
    };
  }, [poolData, playerPrices]);

  // Fetch owned players and their balances using individual balanceOf calls
  const fetchOwnedPlayers = async (userAddress: string) => {
    try {
      // Get all active player IDs
      const activePlayerIds = await getActivePlayerIds();
      console.log('Active player IDs:', activePlayerIds);

      if (activePlayerIds.length === 0) {
        setOwnedPlayers([]);
        return;
      }

      // Get balances for each active player using individual balanceOf calls
      console.log('Calling balanceOf for each active player...');
      const balancePromises = activePlayerIds.map(playerId => {
        console.log(`Calling balanceOf(${userAddress}, ${playerId})`);
        return getPlayerBalance(userAddress, playerId);
      });

      const balances = await Promise.all(balancePromises);
      console.log('Player balances from balanceOf calls:', balances);

      // Filter players that the user owns (balance > 0)
      const ownedPlayerData = activePlayerIds
        .map((playerId, index) => ({
          playerId,
          balance: balances[index]
        }))
        .filter(({ balance }) => balance > BigInt(0));

      if (ownedPlayerData.length === 0) {
        setOwnedPlayers([]);
        return;
      }

      // Create player objects for owned players
      const ownedPlayersList = ownedPlayerData.map(({ playerId, balance }, index) => {
        const playerIdNum = Number(playerId);
        const basePlayerData = fakeData.teamPlayers.find(p => p.id === playerIdNum) ||
          fakeData.teamPlayers[playerIdNum % fakeData.teamPlayers.length];

        return {
          ...basePlayerData,
          id: playerIdNum,
          price: playerPrices[playerIdNum] || '0.000 USDC',
          points: 0, // Will be replaced with total value
          ownedShares: balance,
          totalValue: calculateTotalValue(balance, playerIdNum), // Use player ID instead of price
          // Add required fields for Player interface
          level: 1,
          xp: 50,
          potential: 75,
          // Ensure types are properly cast
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
    } catch (error) {
      console.error('Error fetching owned players:', error);
      setOwnedPlayers([]);
    }
  };

  // Test contract function
  const testContract = async () => {
    if (!authenticated || !user?.wallet?.address) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      const results = await testDevelopmentPlayersContract(user.wallet.address);
      setTestResults(results);
      console.log('Contract test results:', results);

      if (results.isConnected) {
        toast.success(`Contract connected! Found ${results.userPlayerIds.length} players`);
      } else {
        toast.error(`Contract test failed: ${results.error}`);
      }
    } catch (error) {
      console.error('Test failed:', error);
      toast.error('Contract test failed');
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
        // Update with contract data
        price: playerPrices[playerIdNum] || basePlayerData.price,
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
  }, [developmentPlayers.playerIds, developmentPlayers.lockedBalances, playerPrices, poolData]);

  const handleDevelopmentPlayerClick = (player: any) => {
    // Convert the development player to promotion menu format
    const promotionPlayer = {
      id: player.id.toString(),
      name: player.name,
      position: player.position,
      team: player.game, // Using game as team for esports context
      image: `https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop&crop=face&random=${player.id}`,
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
    // Use fake data and merge with preloaded contract prices
    const playersWithPricing: Player[] = fakeData.teamPlayers.map(player => {
      const preloadedPrice = playerPrices[player.id];
      const finalPrice = preloadedPrice || player.price;

      console.log(`🎯 Player ${player.id} (${player.name}):`, {
        preloadedPrice,
        fallbackPrice: player.price,
        finalPrice,
        hasPreloadedPrice: !!preloadedPrice
      });

      return {
        ...player,
        // Add missing fields for interface compatibility (set to fixed values)
        level: 1, // Fixed level
        xp: 50, // Fixed XP value instead of random
        potential: 50, // Fixed potential
        // Ensure types are properly cast
        trend: player.trend as "up" | "down" | "stable",
        recentMatches: player.recentMatches.map(match => ({
          ...match,
          result: match.result as "win" | "loss"
        })),
        // Price will be updated when preloaded prices are available
        price: finalPrice
      };
    });

    console.log('📊 TeamSection: Processed', playersWithPricing.length, 'players with pricing');
    setTeamPlayers(playersWithPricing);

    // Always set loading to false after processing, regardless of pricesLoading state
    // This prevents getting stuck in loading state if price fetching fails
    setLoading(false);
  }, [playerPrices, pricesLoading]); // Update when preloaded prices change

  // Fetch owned players when component mounts or wallet changes
  useEffect(() => {
    const loadOwnedPlayers = async () => {
      if (!authenticated || !user?.wallet?.address) {
        console.log('User not authenticated or no wallet address for owned players');
        setOwnedPlayers([]);
        return;
      }

      console.log('Loading owned players for address:', user.wallet.address);
      setLoading(true);
      try {
        await fetchOwnedPlayers(user.wallet.address);
      } catch (error) {
        console.error('Error loading owned players:', error);
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
        console.log('User not authenticated or no wallet address:', { authenticated, walletAddress: user?.wallet?.address });
        return;
      }

      console.log('Fetching development players for address:', user.wallet.address);
      setDevelopmentLoading(true);
      try {
        const data = await getDevelopmentPlayersData(user.wallet.address);
        console.log('Development players data received:', data);
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

  // Update owned players prices when playerPrices changes (without re-fetching balances)
  useEffect(() => {
    if (ownedPlayers.length > 0 && Object.keys(playerPrices).length > 0) {
      console.log('🎯 Updating owned players with new prices:', playerPrices);
      setOwnedPlayers(prevPlayers =>
        prevPlayers.map(player => {
          const updatedPrice = playerPrices[player.id];
          if (updatedPrice && updatedPrice !== player.price) {
            console.log(`🎯 Updated price for owned player ${player.id} (${player.name}): ${player.price} → ${updatedPrice}`);
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
  }, [playerPrices, calculateTotalValue]);

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
            <p className="text-sm text-muted-foreground">Manage and develop your squad</p>
          </div>
        </motion.div>
        <Badge variant="secondary" className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-0">
          Total Value: {ownedPlayers.reduce((total, player) => {
            const value = parseFloat(player.totalValue?.replace(/[^\d.-]/g, '') || '0');
            return total + value;
          }, 0).toFixed(3)} USDC
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
            Development
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Activity className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="squad" className="space-y-6">
          {loading ? (
            <div>Loading owned players...</div>
          ) : ownedPlayers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Owned Players</h3>
              <p className="text-muted-foreground">You don't own any player shares yet. Purchase some to see them here!</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ownedPlayers.map((player, index) => (
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
                  <Card className="relative overflow-hidden p-4 border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-background via-accent/20 to-accent/40 group-hover:scale-105">
                    {/* Background gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Content container */}
                    <div className="relative z-10">
                      {/* Header row with player info and shares badge */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="relative">
                            <ImageWithFallback
                              src={`https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop&crop=face&random=${player.id}`}
                              alt={player.name}
                              className="w-14 h-14 rounded-xl object-cover shadow-md ring-2 ring-white/20 group-hover:ring-blue-200 transition-all duration-300"
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
                        <div className="flex flex-col items-end ml-3">
                          <Badge 
                            variant="secondary" 
                            className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200/50 px-3 py-1 shadow-sm font-medium"
                          >
                            {formatShares(player.ownedShares || BigInt(0))} shares
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
                          {/* Performance indicator */}
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-xs text-green-600 font-medium">+5.2%</span>
                          </div>
                        </div>
                        
                        {/* Total value with enhanced styling */}
                        <div className="text-right">
                          <div className="text-sm font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            {player.totalValue || '0.000 USDC'}
                          </div>
                          <div className="text-xs text-muted-foreground/60">Total Value</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Hover effect border */}
                    <div className="absolute inset-0 rounded-lg border-2 border-transparent group-hover:border-blue-200/50 transition-colors duration-300" />
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
              }}
              onPurchase={handlePurchase}
            />
          )}
        </TabsContent>

        <TabsContent value="development" className="space-y-6">
          {developmentLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-muted-foreground">Loading development players...</span>
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
                  <Card className="relative overflow-hidden p-4 border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-background via-accent/20 to-accent/40 group-hover:scale-105">
                    {/* Background gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/20 dark:to-pink-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Content container */}
                    <div className="relative z-10">
                      {/* Header row with player info and shares badge */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="relative">
                            <ImageWithFallback
                              src={`https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop&crop=face&random=${player.id}`}
                              alt={player.name}
                              className="w-14 h-14 rounded-xl object-cover shadow-md ring-2 ring-white/20 group-hover:ring-purple-200 transition-all duration-300"
                            />
                            {/* Development badge overlay */}
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
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
                        {/* Locked shares badge with enhanced styling */}
                        <div className="flex flex-col items-end ml-3">
                          <Badge 
                            variant="secondary" 
                            className="text-xs bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-200/50 px-3 py-1 shadow-sm font-medium"
                          >
                            {player.lockedShares} shares
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
                          {/* Development progress indicator */}
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                            <span className="text-xs text-purple-600 font-medium">Developing</span>
                          </div>
                        </div>
                        
                        {/* Total value with enhanced styling */}
                        <div className="text-right">
                          <div className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                            {player.totalValue || '0.000 USDC'}
                          </div>
                          <div className="text-xs text-muted-foreground/60">Total Value</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Hover effect border */}
                    <div className="absolute inset-0 rounded-lg border-2 border-transparent group-hover:border-purple-200/50 transition-colors duration-300" />
                  </Card>
                </motion.div>
              ))}
              
              {developmentPlayers.totalPlayers === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Development Players</h3>
                  <p className="text-sm mb-4">Start developing players to promote them to your active squad</p>
                  <Button 
                    onClick={testContract}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                    size="sm"
                  >
                    Test Contract Connection
                  </Button>
                  {testResults && (
                    <div className="mt-4 p-4 bg-accent/50 rounded-lg text-left max-w-md mx-auto">
                      <p className="text-sm font-medium">Test Results:</p>
                      <p className="text-xs">Connected: {testResults.isConnected ? '✅' : '❌'}</p>
                      <p className="text-xs">Players Found: {testResults.userPlayerIds.length}</p>
                      {testResults.error && <p className="text-xs text-red-600">Error: {testResults.error}</p>}
                    </div>
                  )}
                </div>
              )}
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

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-6 border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">1,227</p>
                  <p className="text-sm text-muted-foreground">Total Points</p>
                </div>
                <Trophy className="w-8 h-8 text-blue-500" />
              </div>
              <div className="mt-4 flex items-center text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-600">+12% this week</span>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">#15</p>
                  <p className="text-sm text-muted-foreground">League Rank</p>
                </div>
                <Star className="w-8 h-8 text-purple-500" />
              </div>
              <div className="mt-4 flex items-center text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-600">+3 positions</span>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">230 USDC</p>
                  <p className="text-sm text-muted-foreground">Rewards Earned</p>
                </div>
                <Zap className="w-8 h-8 text-green-500" />
              </div>
              <div className="mt-4 flex items-center text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-600">+40 USDC this month</span>
              </div>
            </Card>
          </div>

          <Card className="p-6 border-0 shadow-lg">
            <h3 className="mb-4">Performance Timeline</h3>
            <div className="space-y-4">
              {[
                { week: 'Week 8', points: 245, rank: '#15', change: '+3' },
                { week: 'Week 7', points: 198, rank: '#18', change: '-2' },
                { week: 'Week 6', points: 267, rank: '#16', change: '+5' },
                { week: 'Week 5', points: 189, rank: '#21', change: '-1' }
              ].map((week, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-accent/30 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
                    <span className="text-sm font-medium">{week.week}</span>
                  </div>
                  <div className="flex items-center space-x-6 text-sm">
                    <span>{week.points} pts</span>
                    <span>{week.rank}</span>
                    <span className={`${week.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {week.change}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}