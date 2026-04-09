import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ImageWithFallback } from './figma/ImageWithFallback';
import PlayerPurchaseModal from './PlayerPurchaseModal';
import { motion } from 'motion/react';
import { Search, Filter, TrendingUp, TrendingDown, ShoppingCart, DollarSign, Users, Star, LayoutGrid, List } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';
import { useIsMobile } from './ui/use-mobile';
import { usePlayerPrices } from '../hooks/usePlayerPricing';
import { usePoolInfo } from '../hooks/usePoolInfo';
import fakeData from '../fakedata.json';
import { usePrivy } from '@privy-io/react-auth';
import { formatUnits } from 'viem';
import { getContractData, NETWORK_CONFIG } from '../contracts';
import { readContractCached } from '../utils/contractCache';
import { useGridCache } from '../hooks/useGridCache';
import { useGameContext } from '../context/GameContext';
import { apiService } from '../services/apiService';

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

function formatPoolLiquidity(usdc: bigint): string {
  const value = Number(usdc) / 1e6;
  if (value <= 0) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M USDC`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K USDC`;
  if (value >= 1) return `${value.toFixed(2)} USDC`;
  return `${value.toFixed(4)} USDC`;
}

export default function TransfersSection({ onAdvancedView }: { onAdvancedView?: (player: any) => void } = {}) {
  const { t } = useTranslation();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price');
  const { selectedGame } = useGameContext();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [userUsdcBalance, setUserUsdcBalance] = useState<string>('0');
  const [activePlayerIds, setActivePlayerIds] = useState<number[]>([]);
  const { preloadPlayersData } = useGridCache();
  const [priceChanges, setPriceChanges] = useState<Record<string, number | null>>({});
  const { poolData, fetchPoolInfo } = usePoolInfo();

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

  // Fetch pool info for market cap display when active player IDs are known
  useEffect(() => {
    if (activePlayerIds.length > 0) {
      fetchPoolInfo(activePlayerIds);
    }
  }, [activePlayerIds.join(',')]);

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
      price: playerPrices[player.id] || (pricesLoading ? 'Loading...' : '0.00 USDC'),
      // Add required grid properties
      gridID: player.gridID || '',
      teamGridId: player.teamGridId || ''
    }));
  }, [activePlayerIds, playerPrices]);

  // Update available players when playersWithPricing changes
  useEffect(() => {
    setAvailablePlayers(playersWithPricing);
    setLoading(false);

    // Preload Grid.gg data for available players (with delay to avoid connection issues)
    if (playersWithPricing.length > 0) {
      setTimeout(() => {
        console.log('🔄 Starting Grid.gg data preload for available players...');
        preloadPlayersData(playersWithPricing, 150); // 150ms delay between requests
      }, 500); // Wait 500ms after component loads before starting preload
    }
  }, [playersWithPricing, preloadPlayersData]);

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
      player.game === selectedGame
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
              {t('transfers.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('transfers.subtitle')}</p>
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
              placeholder={t('transfers.searchPlayers')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-0 bg-accent/50"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48 border-0 bg-accent/50">
              <SelectValue placeholder={t('transfers.sortBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price">{t('transfers.price')}</SelectItem>
              <SelectItem value="points">{t('leaderboard.pts')}</SelectItem>
              <SelectItem value="rating">{t('transfers.rating')}</SelectItem>
            </SelectContent>
          </Select>
          {!isMobile && (
            <div className="flex rounded-lg border border-border/50 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
                aria-label="Table view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Available Players - Full Width */}
      <div className="space-y-6">
        <Card className="p-6 border-0 shadow-lg">
          <h3 className="mb-6 flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-500" />
            Available Players ({filteredPlayers.length})
          </h3>
          {(!isMobile && viewMode === 'table') ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Player</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-center">24h</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlayers.map((player, index) => (
                  <motion.tr
                    key={player.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    data-slot="table-row"
                    onClick={() => handlePlayerClick(player)}
                    className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <ImageWithFallback
                            src={player.image}
                            alt={player.name}
                            className="w-10 h-10 rounded-lg object-contain"
                          />
                        </div>
                        <div>
                          <p className="font-medium">{player.name}</p>
                          <p className="text-xs text-muted-foreground">{player.game}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{player.position}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-xs font-medium">{player.price}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-xs font-medium">
                        {player.rating}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const change = priceChanges[String(player.id)];
                        if (change == null) return <span className="text-xs text-muted-foreground">—</span>;
                        const isPositive = change >= 0;
                        return (
                          <span className={`text-xs font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {isPositive ? '+' : ''}{change.toFixed(1)}%
                          </span>
                        );
                      })()}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          ) : (
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
                  <Card className="relative overflow-hidden p-4 border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-background to-accent/20 group-hover:scale-105">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50/30 to-purple-50/30 dark:from-blue-900/10 dark:to-purple-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative z-10">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="relative">
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
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center z-20 shadow-md">
                            <span className="text-white text-[10px] font-bold leading-none">{player.rating}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold truncate">{player.name}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block" />
                            {player.game} • {player.position}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-medium">{player.price}</Badge>
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
                        {(() => {
                          const poolInfo = poolData.get(player.id);
                          if (!poolInfo || poolInfo.currencyReserve === 0n) return null;
                          return (
                            <div className="text-right">
                              <div className="text-xs font-semibold text-green-600 dark:text-green-400">{formatPoolLiquidity(poolInfo.currencyReserve)}</div>
                              <div className="text-[10px] text-muted-foreground/60">liquidity</div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </div>
  
      {selectedPlayer && (
        <PlayerPurchaseModal
          player={selectedPlayer}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPlayer(null);
          }}
          onPurchase={handlePurchase}
          onAdvancedView={onAdvancedView}
        />
      )}
    </div>
  );
}