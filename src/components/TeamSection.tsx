import { useState, useEffect, useMemo } from 'react';
import { usePrivy } from "@privy-io/react-auth";
import type { SmartWallet } from "@privy-io/react-auth";
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion } from 'motion/react';
import { Users, TrendingUp, Zap, Star, Trophy, Target, Activity } from 'lucide-react';
import PlayerPurchaseModal from './PlayerPurchaseModal';
import { toast } from "sonner";
import { usePlayerPrices } from '../hooks/usePlayerPricing';
import { createPublicClient, http } from 'viem';
import { CONTRACTS, NETWORK_CONFIG } from '../contracts';
import { ContractDebugger } from './ContractDebugger';
import fakeData from '../fakedata.json';

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

export default function TeamSection() {
  const [activeTab, setActiveTab] = useState('squad');
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [ownedPlayerIds, setOwnedPlayerIds] = useState<number[]>([]);
  const [playerBalances, setPlayerBalances] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user, authenticated } = usePrivy();

  // Create public client for contract interactions
  const publicClient = useMemo(() => createPublicClient({
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
  }), []);

  // Fetch owned player IDs from Player contract (ERC-1155 NFT contract)
  useEffect(() => {
    const fetchOwnedPlayers = async () => {
      if (!authenticated || !user?.wallet?.address) {
        console.log('User not authenticated or no wallet address available');
        setOwnedPlayerIds([]);
        setPlayerBalances({});
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Fetching owned players for address:', user.wallet.address);
        console.log('🔍 Player contract:', CONTRACTS.Player.address);

        // First, get all active player IDs from the Player contract
        const activePlayerIds = await publicClient.readContract({
          address: CONTRACTS.Player.address as `0x${string}`,
          abi: CONTRACTS.Player.abi,
          functionName: 'getActivePlayerIds',
          args: [],
        });

        console.log('✅ Active player IDs:', activePlayerIds);

        // Then check the user's balance for each active player
        const ownedIds: number[] = [];
        const balances: Record<number, number> = {};
        
        for (const playerId of activePlayerIds as bigint[]) {
          try {
            const balance = await publicClient.readContract({
              address: CONTRACTS.Player.address as `0x${string}`,
              abi: CONTRACTS.Player.abi,
              functionName: 'balanceOf',
              args: [user.wallet.address as `0x${string}`, playerId],
            });

            const balanceNum = Number(balance) / 1e18; // Convert from wei to normal units
            if (balanceNum > 0) {
              ownedIds.push(Number(playerId));
              balances[Number(playerId)] = balanceNum;
              console.log(`✅ Player ${playerId}: owns ${balanceNum} shares`);
            }
          } catch (balanceError) {
            console.error(`❌ Failed to check balance for player ${playerId}:`, balanceError);
          }
        }

        console.log('✅ Final owned player IDs:', ownedIds);
        console.log('✅ Player balances:', balances);
        setOwnedPlayerIds(ownedIds);
        setPlayerBalances(balances);
        
        if (ownedIds.length === 0) {
          console.log('ℹ️ No players owned by this address');
        }
      } catch (error) {
        console.error('❌ Failed to fetch owned players:', error);
        // Set empty array on error
        setOwnedPlayerIds([]);
        setPlayerBalances({});
      } finally {
        setLoading(false);
      }
    };

    fetchOwnedPlayers();
  }, [authenticated, user?.wallet?.address, publicClient]);

  // Get player IDs for pricing - use owned player IDs if available, otherwise empty array
  const playerIds = useMemo(() => {
    return ownedPlayerIds.length > 0 ? ownedPlayerIds : [];
  }, [ownedPlayerIds]);
  
  const { prices: playerPrices, loading: pricesLoading } = usePlayerPrices(playerIds);

  useEffect(() => {
    if (loading) return; // Wait for owned players to load first

    // Filter fake data to only show players that the user owns
    const ownedPlayers: Player[] = fakeData.teamPlayers
      .filter(player => ownedPlayerIds.includes(player.id))
      .map(player => ({
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
        // Price will be updated when contract prices load
        price: playerPrices[player.id] || player.price
      }));
    
    console.log('🎮 Filtered owned players:', ownedPlayers.length, 'out of', fakeData.teamPlayers.length);
    setTeamPlayers(ownedPlayers);
  }, [ownedPlayerIds, playerPrices, loading]);

  const trainingPrograms = [
    { id: 1, name: 'Aim Training', duration: '2 hours', cost: '50 USDC', boost: '+5 Accuracy' },
    { id: 2, name: 'Strategy Workshop', duration: '4 hours', cost: '100 USDC', boost: '+8 Game IQ' },
    { id: 3, name: 'Team Synergy', duration: '6 hours', cost: '150 USDC', boost: '+10 Teamwork' },
    { id: 4, name: 'Mental Coaching', duration: '3 hours', cost: '80 USDC', boost: '+6 Focus' }
  ];

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
      
      // Close modal
      setIsModalOpen(false);

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
          {authenticated && ownedPlayerIds.length > 0 
            ? `${ownedPlayerIds.length} Player${ownedPlayerIds.length !== 1 ? 's' : ''} Owned` 
            : 'Total Value: 550 USDC'
          }
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
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground">Loading your owned players...</p>
              </div>
            </div>
          ) : !authenticated ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <Users className="w-12 h-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">Connect Your Wallet</h3>
                  <p className="text-muted-foreground">Connect your wallet to see your owned players</p>
                </div>
              </div>
            </div>
          ) : teamPlayers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <Users className="w-12 h-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">No Players Owned</h3>
                  <p className="text-muted-foreground">You don't own any players yet. Purchase some from the Transfers section!</p>
                </div>
                <Button 
                  onClick={() => window.location.hash = '#transfers'} 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                >
                  Browse Players
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Your Active Squad</h3>
                  <p className="text-sm text-muted-foreground">
                    Showing {teamPlayers.length} owned player{teamPlayers.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Badge variant="secondary" className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-0">
                  Owned: {ownedPlayerIds.length} NFT{ownedPlayerIds.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {teamPlayers.map((player, index) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => {
                      setSelectedPlayer(player);
                      setIsModalOpen(true);
                    }}
                    className="cursor-pointer"
                  >
                    <Card className="p-4 border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-background to-accent/30 relative">
                      {/* Shares owned indicator */}
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                          {playerBalances[player.id]?.toFixed(2) || '0.00'} Owned
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <ImageWithFallback
                            src={`https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop&crop=face&random=${player.id}`}
                            alt={player.name}
                            className="w-14 h-14 rounded-xl object-cover shadow-md"
                          />
                          {/* NFT indicator */}
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">#{player.id}</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-medium">{player.name}</h3>
                          <p className="text-xs text-muted-foreground">{player.game} • {player.position}</p>
                          <div className="flex items-center justify-between mt-2">
                            <Badge variant="outline" className="text-xs">{player.price}</Badge>
                            <span className="text-sm text-primary font-medium">
                              {(() => {
                                const shares = playerBalances[player.id] || 0;
                                const priceStr = playerPrices[player.id] || player.price;
                                const priceNum = parseFloat(priceStr.replace(/[^\d.]/g, ''));
                                const totalValue = shares * priceNum;
                                return `$${totalValue.toFixed(2)}`;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </>
          )}
          
          {/* PlayerPurchaseModal */}
          {selectedPlayer && (
            <PlayerPurchaseModal
              player={selectedPlayer}
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onPurchase={handlePurchase} // This will now receive both player and usdcAmount
            />
          )}
        </TabsContent>

        <TabsContent value="development" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6 border-0 shadow-lg">
              <h3 className="mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                Training Programs
              </h3>
              <div className="space-y-4">
                {trainingPrograms.map((program) => (
                  <div key={program.id} className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium">{program.name}</h4>
                      <p className="text-xs text-muted-foreground">{program.duration} • {program.boost}</p>
                    </div>
                    <div className="text-right space-y-2">
                      <Badge variant="outline">{program.cost}</Badge>
                      <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
                        Start
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Debug Section */}
          <ContractDebugger />
          
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