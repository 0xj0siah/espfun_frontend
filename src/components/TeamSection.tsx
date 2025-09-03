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
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user, authenticated } = usePrivy();

  // Get player IDs for pricing - use useMemo to prevent recreation
  const playerIds = useMemo(() => fakeData.teamPlayers.map(player => player.id), []);
  const { prices: playerPrices, loading: pricesLoading } = usePlayerPrices(playerIds);

  useEffect(() => {
    // Use fake data and merge with contract prices
    const playersWithPricing: Player[] = fakeData.teamPlayers.map(player => ({
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
    
    setTeamPlayers(playersWithPricing);
    setLoading(false); // Set loading to false regardless of pricesLoading
  }, [playerPrices]); // Remove pricesLoading from dependencies

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
          Total Value: 550 USDC
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
            <div>Loading team...</div>
          ) : (
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
                  <Card className="p-4 border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-background to-accent/30">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <ImageWithFallback
                          src={`https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop&crop=face&random=${player.id}`}
                          alt={player.name}
                          className="w-14 h-14 rounded-xl object-cover shadow-md"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium">{player.name}</h3>
                        <p className="text-xs text-muted-foreground">{player.game} • {player.position}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-xs">{player.price}</Badge>
                          <span className="text-sm text-primary font-medium">{player.points} pts</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
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
                Player Development
              </h3>
              <div className="bg-accent/30 border border-border/50 rounded-lg p-6 text-center">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto">
                    <Zap className="w-6 h-6 text-yellow-600" />
                  </div>
                  <h4 className="text-sm font-medium">Development Tools</h4>
                  <p className="text-xs text-muted-foreground">
                    Player development and training features will be available here soon.
                  </p>
                  <Badge variant="outline" className="mt-3">Coming Soon</Badge>
                </div>
              </div>
            </Card>

          </div>
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