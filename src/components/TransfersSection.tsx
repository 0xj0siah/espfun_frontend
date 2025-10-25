import { useState, useEffect, useMemo } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ImageWithFallback } from './figma/ImageWithFallback';
import PlayerPurchaseModal from './PlayerPurchaseModal';
import MobilePlayerPurchaseModal from './MobilePlayerPurchaseModal';
import { motion } from 'motion/react';
import { Search, Filter, TrendingUp, TrendingDown, ShoppingCart, DollarSign, Users, Star } from 'lucide-react';
import { usePlayerPrices } from '../hooks/usePlayerPricing';
import fakeData from '../fakedata.json';
import { usePrivy } from '@privy-io/react-auth';
import { formatUnits } from 'viem';
import { getContractData, NETWORK_CONFIG } from '../contracts';
import { readContractCached } from '../utils/contractCache';
import { useIsMobile } from './ui/use-mobile';

interface Player {
  id: number;
  name: string;
  game: string;
  position: string;
  price: string;
  trend: 'up' | 'down' | 'stable';
  points: number;
  rating: number;
  image: string;
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
  gridID?: string;
  teamGridId?: string;
}

export default function TransfersSection() {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price');
  const [filterGame, setFilterGame] = useState('all');
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [userUsdcBalance, setUserUsdcBalance] = useState<string>('0');
  const [activePlayerIds, setActivePlayerIds] = useState<number[]>([]);
  const isMobile = useIsMobile();

  // Only fetch prices for active players
  const { prices: playerPrices, loading: pricesLoading } = usePlayerPrices(activePlayerIds);
  const { user, ready, authenticated } = usePrivy();

  useEffect(() => {
    const fetchActivePlayers = async () => {
      try {
        const playerContract = getContractData('Player');
        
        // Get active player IDs from contract
        const activePlayerIds = await readContractCached({
          address: playerContract.address as `0x${string}`,
          abi: playerContract.abi as any,
          functionName: 'getActivePlayerIds',
          args: [],
        }) as bigint[];
        
        console.log('✅ Active player IDs from contract:', activePlayerIds.map(id => Number(id)));
        
        // Set active player IDs for pricing hook
        const activeIds = activePlayerIds.map(id => Number(id));
        setActivePlayerIds(activeIds);
      } catch (error) {
        console.error('❌ Error fetching active player IDs:', error);
        // If contract call fails, set empty array
        setActivePlayerIds([]);
      }
    };
    fetchActivePlayers();
  }, []); // Only run once on mount

  // Create players with pricing when activePlayerIds or playerPrices change
  const playersWithPricing = useMemo(() => {
    if (!activePlayerIds.length) return [];

    // Filter fake data to only include active players
    const activePlayerIdsSet = new Set(activePlayerIds);
    const activePlayers = fakeData.teamPlayers.filter(player => 
      activePlayerIdsSet.has(player.id)
    );

    console.log('✅ Filtered active players:', activePlayers.length, 'out of', fakeData.teamPlayers.length);

    // Merge with contract prices
    return activePlayers.map(player => ({
      ...player,
      // Add missing fields for interface compatibility
      level: 1,
      xp: 50,
      potential: 50,
      trend: player.trend as "up" | "down" | "stable",
      recentMatches: player.recentMatches.map(match => ({
        ...match,
        result: match.result as "win" | "loss"
      })),
      // Use contract price or show loading
      price: playerPrices[player.id] || 'Loading...',
      // Add required grid properties
      gridID: player.gridID || '',
      teamGridId: player.teamGridId || ''
    }));
  }, [activePlayerIds, playerPrices]);

  // Update available players when playersWithPricing changes
  useEffect(() => {
    setAvailablePlayers(playersWithPricing);
    setLoading(false);
  }, [playersWithPricing]);

  // Check user's USDC balance when authenticated
  useEffect(() => {
    if (authenticated && user?.wallet?.address) {
      checkUserUsdcBalance();
    } else {
      setUserUsdcBalance('0');
    }
  }, [authenticated, user?.wallet?.address]);


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
    // Note: Modal will be closed by PlayerPurchaseModal component when transaction completes
  };

  // Get currency token address from FDFPair contract
  const getCurrencyTokenAddress = async (): Promise<string> => {
    try {
      const fdfPairContract = getContractData('FDFPair');
      
      // Try currencyToken function first (more likely to be correct)
      try {
        const address = await readContractCached({
          address: fdfPairContract.address as `0x${string}`,
          abi: fdfPairContract.abi as any,
          functionName: 'currencyToken',
          args: [],
        });
        console.log('✅ Currency token address from currencyToken():', address);
        return address as string;
      } catch (currencyTokenError) {
        console.warn('currencyToken() failed, trying getCurrencyInfo():', currencyTokenError);
        
        // Fallback to getCurrencyInfo
        const address = await readContractCached({
          address: fdfPairContract.address as `0x${string}`,
          abi: fdfPairContract.abi as any,
          functionName: 'getCurrencyInfo',
          args: [],
        });
        console.log('✅ Currency token address from getCurrencyInfo():', address);
        return address as string;
      }
    } catch (error) {
      console.error('Error getting currency token address:', error);
      // Fallback to hardcoded TUSDC address from contracts
      const tusdcContract = getContractData('TUSDC');
      console.log('🔄 Using hardcoded TUSDC address as fallback:', tusdcContract.address);
      return tusdcContract.address;
    }
  };

  // Check user's USDC balance
  const checkUserUsdcBalance = async (): Promise<void> => {
    if (!user?.wallet?.address || !authenticated) return;
    
    try {
      const currencyAddress = await getCurrencyTokenAddress();
      const balance = await readContractCached({
        address: currencyAddress as `0x${string}`,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view'
          }
        ],
        functionName: 'balanceOf',
        args: [user.wallet.address as `0x${string}`],
      });
      
      const formattedBalance = formatUnits(balance as bigint, 6);
      setUserUsdcBalance(formattedBalance);
      console.log('💰 User USDC balance:', formattedBalance);
    } catch (error) {
      console.error('Error checking USDC balance:', error);
      setUserUsdcBalance('0');
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
          Balance: {parseFloat(userUsdcBalance).toFixed(2)} USDC
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
              <SelectItem value="CS2">Counter-Strike 2</SelectItem>
              <SelectItem value="League of Legends">League of Legends</SelectItem>
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

      {/* Available Players - Full Width */}
      <div className="space-y-6">
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
                        className="relative z-10 w-14 h-14 rounded-xl object-contain shadow-md opacity-85"
                      />
                      <div className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full z-20">
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
    </div>
  );
}