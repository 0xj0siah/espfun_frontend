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
import { Users, TrendingUp, Zap, Star, Trophy, Target, FileText, Clock } from 'lucide-react';
import PlayerPurchaseModal from './PlayerPurchaseModal';
import MobilePlayerPurchaseModal from './MobilePlayerPurchaseModal';
import ContractExtensionModal from './ContractExtensionModal';
import { PromotionMenu } from './PromotionMenu';
import { toast } from "sonner";
import { useIsMobile } from './ui/use-mobile';
import { usePlayerPrices } from '../hooks/usePlayerPricing';
import fakeData from '../fakedata.json';
import { getDevelopmentPlayersData, testDevelopmentPlayersContract, getActivePlayerIds, getPlayerBalance } from '../utils/contractInteractions';
import { usePoolInfo } from '../hooks/usePoolInfo';
import { useGridCache } from '../hooks/useGridCache';

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
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [selectedContractPlayer, setSelectedContractPlayer] = useState<Player | null>(null);
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
  const isMobile = useIsMobile();
  const { preloadPlayersData } = useGridCache();

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
          price: playerPrices[playerIdNum] || 'Loading...',
          points: 0, // Will be replaced with total value
          ownedShares: balance,
          totalValue: calculateTotalValue(balance, playerIdNum), // Use player ID instead of price
          gamesRemaining: Math.floor(Math.random() * 10) + 1, // Filler data: 1-10 games (will be replaced with backend data)
          // Add required fields for Player interface
          level: 1,
          xp: 50,
          potential: 75,
          // Add GRID fields with defaults
          gridID: basePlayerData.gridID || undefined,
          teamGridId: basePlayerData.teamGridId || undefined,
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

      // Preload Grid.gg data for owned players (with delay to avoid connection issues)
      setTimeout(() => {
        console.log('🔄 Starting Grid.gg data preload for owned players...');
        preloadPlayersData(ownedPlayersList, 150); // 150ms delay between requests
      }, 500); // Wait 500ms after component loads before starting preload
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
        price: playerPrices[playerIdNum] || 'Loading...',
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
    // Use fake data and merge with preloaded contract prices - no fallback to fake data prices
    const playersWithPricing: Player[] = fakeData.teamPlayers.map(player => {
      const preloadedPrice = playerPrices[player.id];
      const finalPrice = preloadedPrice || 'Loading...';

      console.log(`🎯 Player ${player.id} (${player.name}):`, {
        preloadedPrice,
        finalPrice,
        hasPreloadedPrice: !!preloadedPrice
      });

      return {
        ...player,
        // Add missing fields for interface compatibility (set to fixed values)
        level: 1, // Fixed level
        xp: 50, // Fixed XP value instead of random
        potential: 50, // Fixed potential
        // Add GRID fields with defaults
        gridID: player.gridID || undefined,
        teamGridId: player.teamGridId || undefined,
        // Ensure types are properly cast
        trend: player.trend as "up" | "down" | "stable",
        recentMatches: player.recentMatches.map(match => ({
          ...match,
          result: match.result as "win" | "loss"
        })),
        // Price will be updated when preloaded prices are available - no fallback
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
          {
          <TabsTrigger value="contracts" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="w-4 h-4 mr-2" />
            Contracts
          </TabsTrigger>
          }
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
            isMobile ? (
              <MobilePlayerPurchaseModal
                player={selectedPlayer}
                isOpen={isModalOpen}
                onClose={() => {
                  setIsModalOpen(false);
                  setSelectedPlayer(null);
                }}
                onPurchase={handlePurchase}
              />
            ) : (
              <PlayerPurchaseModal
                player={selectedPlayer}
                isOpen={isModalOpen}
                onClose={() => {
                  setIsModalOpen(false);
                  setSelectedPlayer(null);
                }}
                onPurchase={handlePurchase}
              />
            )
          )}
        </TabsContent>

        <TabsContent value="development" className="space-y-6">
          {developmentLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-muted-foreground">Loading development players...</span>
            </div>
          ) : developmentPlayers.totalPlayers === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Development Players</h3>
              <p className="text-muted-foreground">Start developing players to promote them to your active squad</p>
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
                            {/* Development badge overlay */}
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center z-20">
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
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : ownedPlayers.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Active Contracts</h3>
              <p className="text-muted-foreground">You don't own any player shares yet. Purchase some to manage contracts!</p>
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
                {ownedPlayers.map((player, index) => {
                  // Filler data for contract information (will be replaced with backend data later)
                  const gamesRemaining = Math.floor(Math.random() * 10) + 1; // 1-10 games
                  const contractStatus = gamesRemaining <= 3 ? 'expiring' : gamesRemaining <= 6 ? 'active' : 'healthy';
                  const extensionPrice = (parseFloat(player.price) * 0.1).toFixed(4); // 10% of player price as extension cost
                  
                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="relative overflow-hidden p-4 border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-background via-accent/20 to-accent/40">
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
                              {formatShares(player.ownedShares || BigInt(0))} shares
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
                                contractStatus === 'expiring' ? 'text-red-600' :
                                contractStatus === 'active' ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {contractStatus === 'expiring' ? 'Expiring Soon' :
                                 contractStatus === 'active' ? 'Active' :
                                 'Healthy'}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  contractStatus === 'expiring' ? 'bg-red-500' :
                                  contractStatus === 'active' ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${(gamesRemaining / 10) * 100}%` }}
                              />
                            </div>
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