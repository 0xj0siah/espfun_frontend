import { useState, useEffect, useMemo } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ImageWithFallback } from './figma/ImageWithFallback';
import PlayerPurchaseModal from './PlayerPurchaseModal';
import { motion } from 'motion/react';
import { Search, Filter, TrendingUp, TrendingDown, ShoppingCart, DollarSign, Users, Star } from 'lucide-react';
import { usePlayerPrices } from '../hooks/usePlayerPricing';
import fakeData from '../fakedata.json';

interface Player {
  id: number;
  name: string;
  game: string;
  position: string;
  price: string;
  trend: 'up' | 'down' | 'stable';
  points: number;
  rating: number;
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

export default function TransfersSection() {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price');
  const [filterGame, setFilterGame] = useState('all');
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

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
    
    setAvailablePlayers(playersWithPricing);
    setLoading(false); // Set loading to false regardless of pricesLoading
  }, [playerPrices]); // Remove pricesLoading from dependencies

  const recentTransfers = [
    { player: 'CyberNinja', action: 'Bought', price: '80 USDC', time: '2 hours ago', buyer: 'CryptoGamer23' },
    { player: 'VoidWalker', action: 'Sold', price: '90 USDC', time: '1 day ago', buyer: 'ProPlayer99' },
    { player: 'QuantumFlash', action: 'Bought', price: '150 USDC', time: '3 days ago', buyer: 'EliteStrat' }
  ];

  const filteredPlayers = availablePlayers
    .filter(player => 
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterGame === 'all' || player.game === filterGame)
    )
    .sort((a, b) => {
      if (sortBy === 'price') return parseFloat(a.price.replace(' USDC', '')) - parseFloat(b.price.replace(' USDC', ''));
      if (sortBy === 'points') return b.points - a.points;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0;
    });

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player);
    setIsModalOpen(true);
  };

    const handlePurchase = async (player: Player, usdcAmount: string, action: 'buy' | 'sell', slippage: number): Promise<void> => {
    // Handle the purchase/sale logic here
    console.log('Purchasing player:', player.name, usdcAmount, action, slippage);
    setIsModalOpen(false);
    setSelectedPlayer(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-3"
        >
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-3 rounded-xl">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Transfer Market
            </h2>
            <p className="text-sm text-muted-foreground">Buy and sell fantasy players</p>
          </div>
        </motion.div>
        <Badge variant="secondary" className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-0">
          Balance: 210 USDC
        </Badge>
      </div>

      {/* Search and Filters */}
      <Card className="p-6 border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-0 bg-accent/50"
            />
          </div>
          <Select value={filterGame} onValueChange={setFilterGame}>
            <SelectTrigger className="w-48 border-0 bg-accent/50">
              <SelectValue placeholder="Filter by game" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Games</SelectItem>
              <SelectItem value="Valorant">Valorant</SelectItem>
              <SelectItem value="CS2">Counter-Strike 2</SelectItem>
              <SelectItem value="League of Legends">League of Legends</SelectItem>
              <SelectItem value="Dota 2">Dota 2</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48 border-0 bg-accent/50">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="points">Points</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Available Players */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 border-0 shadow-lg">
            <h3 className="mb-6 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-500" />
              Available Players ({filteredPlayers.length})
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredPlayers.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handlePlayerClick(player)}
                  className="cursor-pointer group"
                >
                  <Card className="p-4 border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-background to-accent/20 group-hover:scale-105">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <ImageWithFallback
                          src={`https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop&crop=face&random=${player.id}`}
                          alt={player.name}
                          className="w-14 h-14 rounded-xl object-cover shadow-md"
                        />
                        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {player.rating}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium">{player.name}</h4>
                        <p className="text-xs text-muted-foreground">{player.game} • {player.position}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-xs font-medium">{player.price}</Badge>
                          <div className={`flex items-center space-x-1 text-xs ${
                            player.trend === 'up' ? 'text-green-500' : 
                            player.trend === 'down' ? 'text-red-500' : 
                            'text-muted-foreground'
                          }`}>
                            {player.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : 
                             player.trend === 'down' ? <TrendingDown className="w-3 h-3" /> : 
                             <span>→</span>}
                            <span>{player.points} pts</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Transfers */}
          <Card className="p-6 border-0 shadow-lg">
            <h3 className="mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-green-500" />
              Recent Transfers
            </h3>
            <div className="space-y-3">
              {recentTransfers.map((transfer, index) => (
                <div key={index} className="p-3 bg-accent/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">{transfer.player}</h4>
                    <Badge variant={transfer.action === 'Bought' ? 'default' : 'secondary'}>
                      {transfer.action}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{transfer.buyer}</span>
                    <span>{transfer.price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{transfer.time}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Market Insights */}
          <Card className="p-6 border-0 shadow-lg bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10">
            <h3 className="mb-4 flex items-center">
              <Star className="w-5 h-5 mr-2 text-yellow-500" />
              Market Insights
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Avg Player Price</span>
                <span className="text-sm font-medium text-primary">130 USDC</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Most Wanted Position</span>
                <span className="text-sm font-medium text-primary">Duelist</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Price Trend</span>
                <span className="text-sm font-medium text-green-600 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +8% this week
                </span>
              </div>
            </div>
          </Card>

          {/* Transfer Tips */}
          <Card className="p-6 border-0 shadow-lg">
            <h4 className="text-sm font-medium mb-3">💡 Transfer Tips</h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>• Monitor player performance trends before buying</p>
              <p>• Sell players before major tournaments for higher prices</p>
              <p>• Budget 20% for emergency transfers</p>
              <p>• Consider team synergy when building your squad</p>
            </div>
          </Card>
        </div>
      </div>
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 bg-black text-white p-2 text-xs z-50">
          isModalOpen: {isModalOpen.toString()}<br/>
          selectedPlayer: {selectedPlayer?.name || 'null'}
        </div>
      )}
      
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
    </div>
  );
}