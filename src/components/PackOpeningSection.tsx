import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Star, Zap, Trophy, Gift, Package, Gamepad2, AlertCircle, Loader2 } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { apiService, PackInfo, PackPurchaseResponse, UserPoints } from '../services/apiService';
import { useAuthentication } from '../hooks/useAuthentication';
import { toast } from 'sonner';
import fakeData from '../fakedata.json';
import { formatEther } from 'viem';

interface Player {
  id: number;
  name: string;
  game: string;
  position: string;
  rating: number;
  shares: number;
}

export default function PackOpeningSection() {
  const [selectedPack, setSelectedPack] = useState<PackInfo | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [openedCards, setOpenedCards] = useState<Player[]>([]);
  const [showCards, setShowCards] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [availablePacks, setAvailablePacks] = useState<PackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);

  const { user, authenticated } = usePrivy();
  
  // Authentication states
  const { 
    isAuthenticated, 
    isAuthenticating, 
    authenticate, 
    error: authError,
    walletConnected 
  } = useAuthentication();

  // Helper function to format shares from wei to readable number with decimals
  const formatShares = (weiValue: string | number): string => {
    try {
      // Convert to BigInt if it's a string
      const wei = typeof weiValue === 'string' ? BigInt(weiValue) : BigInt(weiValue);
      // Convert from wei (18 decimals) to ether and format with 4 decimal places
      const etherValue = formatEther(wei);
      const numValue = parseFloat(etherValue);
      return numValue.toFixed(4);
    } catch (error) {
      console.error('Error formatting shares:', error);
      return '0.0000';
    }
  };

  // Helper function to get player data from fakeData
  const getPlayerData = (playerId: number) => {
    return fakeData.teamPlayers.find(player => player.id === playerId) || {
      id: playerId,
      name: `Player ${playerId}`,
      game: 'CS2',
      position: 'Unknown',
      price: '0 USDC',
      trend: 'stable' as const,
      points: 0,
      rating: 50,
      image: '/images/default-player.webp',
      stats: {
        kills: 0,
        deaths: 0,
        assists: 0,
        winRate: 0
      },
      recentMatches: []
    };
  };

  // Load available packs and user profile on component mount
  useEffect(() => {
    const loadData = async () => {
      console.log('🎁 Loading packs and user profile...');
      try {
        setLoading(true);
        
        // Auto-authenticate if not authenticated and wallet is connected
        if (!isAuthenticated && walletConnected && !isAuthenticating) {
          console.log('🔐 Auto-authenticating for PackOpeningSection...');
          await authenticate();
        }
        
        // Clear cache to ensure fresh data
        if (authenticated) {
          console.log('🧹 Clearing API cache for fresh points data...');
          // Force cache clear by calling clearAuthToken and then re-setting it
          const currentToken = (apiService as any).token;
          if (currentToken) {
            apiService.clearAuthToken();
            apiService.setAuthToken(currentToken);
          }
        }
        
        // Load packs and user points in parallel
        const [packsResponse, pointsResponse] = await Promise.allSettled([
          apiService.getAvailablePacks(),
          apiService.getUserPoints().catch(() => null) // Don't fail if points fetch fails
        ]);
        
        // Handle packs
        if (packsResponse.status === 'fulfilled') {
          console.log('✅ API Response:', packsResponse.value);

          // Handle different response formats
          let packs: PackInfo[] = [];
          const response = packsResponse.value;
          if (Array.isArray(response)) {
            packs = response;
          } else if (response && typeof response === 'object' && 'packs' in response && Array.isArray((response as any).packs)) {
            packs = (response as any).packs;
          }

          console.log('📦 Parsed packs:', packs);

          // If no packs returned, use mock data
          if (!packs || packs.length === 0) {
            console.log('🔄 No packs from API, using mock data');
            packs = [
              {
                id: 'PRO', // Backend expects uppercase pack types
                name: 'Pro Pack',
                type: 'bronze',
                price: 100, // Correct pricing: 100 tournament points
                description: '4 Players',
                isActive: true
              },
              {
                id: 'EPIC', // Backend expects uppercase pack types
                name: 'Epic Pack',
                type: 'silver',
                price: 250, // Correct pricing: 250 tournament points
                description: '4 Players',
                isActive: true
              },
              {
                id: 'LEGENDARY', // Backend expects uppercase pack types
                name: 'Legendary Pack',
                type: 'gold',
                price: 500, // Correct pricing: 500 tournament points
                description: '4 Players',
                isActive: true
              }
            ];
          }
          
          setAvailablePacks(packs);
        } else {
          console.error('❌ Failed to load packs:', packsResponse.reason);
          // Use mock data as fallback
          setAvailablePacks([
            {
              id: 'PRO',
              name: 'Bronze Pack',
              type: 'bronze',
              price: 50,
              description: '4 Players',
              isActive: true
            },
            {
              id: 'EPIC',
              name: 'Silver Pack',
              type: 'silver',
              price: 150,
              description: '4 Players',
              isActive: true
            },
            {
              id: 'LEGENDARY',
              name: 'Gold Pack',
              type: 'gold',
              price: 300,
              description: '4 Players',
              isActive: true
            }
          ]);
        }
        
        // Handle user points
        if (pointsResponse.status === 'fulfilled' && pointsResponse.value) {
          console.log('✅ User points loaded:', pointsResponse.value);
          setUserPoints(pointsResponse.value);
        } else {
          console.log('ℹ️ User points not available (not authenticated or API error)');
          setUserPoints(null);
        }
        
        setError(null);
      } catch (err) {
        console.error('❌ Failed to load data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        // Always fallback to mock data if API fails
        setAvailablePacks([
          {
            id: 'PRO',
            name: 'Pro Pack',
            type: 'bronze',
            price: 100, // Correct pricing: 100 tournament points
            description: '4 Players',
            isActive: true
          },
          {
            id: 'EPIC',
            name: 'Epic Pack',
            type: 'silver',
            price: 250, // Correct pricing: 250 tournament points
            description: '4 Players',
            isActive: true
          },
          {
            id: 'LEGENDARY',
            name: 'Legendary Pack',
            type: 'gold',
            price: 500, // Correct pricing: 500 tournament points
            description: '4 Players',
            isActive: true
          }
        ]);
      } finally {
        setLoading(false);
        console.log('🎁 Data loading complete');
      }
    };

    loadData();
  }, [authenticated, isAuthenticated, walletConnected, isAuthenticating, authenticate]);

  const openPack = async (pack: PackInfo) => {
    if (!isAuthenticated || !user?.wallet?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (isPurchasing || isAuthenticating) {
      return; // Prevent multiple clicks or actions during authentication
    }

    setIsPurchasing(true);

    try {
      // Refresh user points before checking to ensure we have the latest balance
      console.log('🔄 Refreshing user points before purchase...');
      const latestPoints = await apiService.getUserPoints();
      setUserPoints(latestPoints);
      console.log('✅ Latest points from API:', latestPoints.tournamentPoints);
      console.log('🎯 Pack price:', pack.price);
      console.log('📊 Has enough points?', latestPoints.tournamentPoints >= pack.price);

      // Check if user has enough points with the latest data
      if (latestPoints.tournamentPoints < pack.price) {
        console.log('❌ Insufficient points - blocking purchase');
        toast.error(`Insufficient points! You need ${pack.price} points but only have ${latestPoints.tournamentPoints}.`);
        return;
      }

      console.log('✅ Points check passed - proceeding with purchase');

      setSelectedPack(pack);
      setIsOpening(true);
      setShowCards(false);
      setFlippedCards(new Set());
      setError(null);

      // Purchase pack via backend API
      console.log('🎁 Purchasing pack:', { packId: pack.id, packType: pack.type, packName: pack.name });
      const response: PackPurchaseResponse = await apiService.purchasePack({
        packType: pack.id // Only send pack type - backend handles payment method
      });

      console.log('🎉 Pack opened successfully:', response);

      // Transform API response to Player format using the new response structure
      const players: Player[] = response.transaction.playerIds.map((playerId, index) => {
        const playerData = getPlayerData(playerId);
        return {
          id: playerId,
          name: playerData.name,
          game: playerData.game,
          position: playerData.position,
          rating: playerData.rating,
          shares: parseInt(response.transaction.shares[index] || '1')
        };
      });

      setOpenedCards(players);
      setIsOpening(false);
      setShowCards(true);

      // Refresh user points to show updated points
      try {
        const updatedPoints = await apiService.getUserPoints();
        setUserPoints(updatedPoints);
        console.log('✅ User points updated after purchase:', updatedPoints);
      } catch (pointsError) {
        console.log('ℹ️ Could not refresh user points, but purchase was successful');
      }

      toast.success(response.message || `Successfully opened ${pack.name}!`);
    } catch (err) {
      console.error('Failed to open pack:', err);
      setIsOpening(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to open pack';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsPurchasing(false);
    }
  };

  const flipCard = (cardId: number) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full"
        >
          <Package className="w-5 h-5" />
          <span className="text-lg">Pack Opening</span>
        </motion.div>
        <h2 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          Choose Your Pack
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Select a pack to reveal 4 esports player cards!
        </p>
        
        {/* User Points Display */}
        {userPoints && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center space-x-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-2 rounded-full shadow-lg"
          >
            <Trophy className="w-5 h-5" />
            <span className="font-bold">
              Tournament Points: {userPoints.tournamentPoints.toLocaleString()}
            </span>
          </motion.div>
        )}
        
        {/* Authentication Status */}
        {!walletConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto"
          >
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Wallet Not Connected</span>
            </div>
            <p className="text-xs text-yellow-700 mt-1">
              Please connect your wallet to purchase packs and view your points.
            </p>
          </motion.div>
        )}

        {walletConnected && !isAuthenticated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto"
          >
            <div className="flex items-center gap-2 text-blue-800">
              {isAuthenticating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {isAuthenticating ? 'Authenticating...' : 'Authentication Required'}
              </span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              {isAuthenticating 
                ? 'Please wait while we authenticate your wallet...' 
                : 'Authenticating automatically...'
              }
            </p>
            {authError && (
              <p className="text-xs text-red-600 mt-1">
                {authError}
              </p>
            )}
          </motion.div>
        )}
        
        {/* Authentication Prompt */}
        {!userPoints && authenticated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-muted-foreground"
          >
            Connect your wallet to view your points and purchase packs
          </motion.div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading available packs...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
              <Package className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Failed to Load Packs</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Pack Selection */}
      {!loading && !error && availablePacks.length > 0 && (
        <div className="flex justify-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
            {availablePacks.map((pack, index) => (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ 
                  scale: 1.05, 
                  rotateY: 5
                }}
                transition={{
                  delay: index * 0.2,
                  scale: { duration: 0.15, ease: "easeOut", type: "tween" },
                  rotateY: { duration: 0.15, ease: "easeOut", type: "tween" },
                  default: { duration: 0.15, ease: "easeOut", type: "tween" }
                }}
              >
                <Card className={`relative overflow-hidden border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group ${isPurchasing || isAuthenticating || !isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => !isPurchasing && !isAuthenticating && isAuthenticated && openPack(pack)}
                      style={{ width: '200px', height: '280px' }}>
                  {/* Realistic Pack Design - Box Style */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 opacity-95"></div>

                  {/* Pack Box Structure */}
                  <div className="relative h-full flex flex-col">
                    {/* Top Flap with Seal */}
                    <div className="h-20 bg-gradient-to-b from-white/40 to-white/20 border-b-2 border-white/50 relative">
                      {/* Flap Shadow */}
                      <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/20 transform skew-x-1"></div>
                    </div>

                    {/* Main Pack Body */}
                    <div className="flex-1 flex items-center justify-center p-3">
                      <div className="text-center space-y-2">
                        {/* Pack Logo/Icon */}
                        <div className="w-12 h-12 mx-auto bg-white/20 rounded-lg flex items-center justify-center border border-white/40 backdrop-blur-sm">
                          <img
                            src="/oglogonobg.png"
                            alt="ESP.FUN Logo"
                            className="w-8 h-8 object-contain"
                          />
                        </div>

                        {/* Pack Name */}
                        <h3 className="text-white font-bold text-sm drop-shadow-lg">{pack.name}</h3>
                        <p className="text-white/90 text-xs drop-shadow">{pack.description}</p>

                        {/* Price Tag */}
                        <div className="bg-white/20 backdrop-blur-sm rounded px-3 py-1 border border-white/30">
                          <p className="text-white font-bold text-sm drop-shadow">{pack.price} Points</p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section with Card Preview */}
                    <div className="h-16 bg-gradient-to-t from-black/30 to-transparent border-t border-white/20 relative">
                      {/* Card Stack Preview */}
                      <div className="absolute bottom-2 left-2 right-2 flex justify-center space-x-1">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-6 h-10 bg-white/60 rounded border border-white/80 shadow-md"
                            style={{
                              transform: `rotate(${i * 3}deg) translateY(${i * 2}px)`,
                              zIndex: 3 - i
                            }}
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Hover Effects */}
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  {/* Loading Overlay */}
                  {(isPurchasing || isAuthenticating) && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                  )}

                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

                  {/* 3D Depth Lines */}
                  <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                    <div className="absolute top-2 left-2 w-full h-full border border-white/20 rounded transform translate-x-1 translate-y-1 opacity-50"></div>
                    <div className="absolute top-1 left-1 w-full h-full border border-white/30 rounded transform translate-x-0.5 translate-y-0.5 opacity-30"></div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Pack Opening Animation */}
      <AnimatePresence>
        {isOpening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/95 backdrop-blur-md z-50 flex items-center justify-center"
          >
            <div className="text-center space-y-8">
              <motion.div
                initial={{ scale: 1 }}
                className="relative"
              >
                <div className="w-48 h-64 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-2xl flex items-center justify-center border-2 border-blue-500 relative overflow-hidden">
                  <img
                    src="/oglogonobg.png"
                    alt="ESP.FUN Logo"
                    className="w-8 h-8 object-contain"
                  />
                </div>
              </motion.div>

              <motion.h3
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-2xl font-bold"
              >
                Opening Pack...
              </motion.h3>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Reveal */}
      <AnimatePresence>
        {showCards && openedCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="space-y-6"
          >
            <div className="text-center">
              <motion.h3
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent"
              >
                🎉 Pack Opened! 🎉
              </motion.h3>
              <p className="text-muted-foreground">Click on cards to reveal your players!</p>
            </div>

            <div className="flex justify-center">
              <div className="flex gap-6 px-4">
                {openedCards.map((card, index) => {
                  const isFlipped = flippedCards.has(card.id);

                  return (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, scale: 0, y: 100 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{
                        delay: index * 0.15,
                        type: "spring",
                        stiffness: 200,
                        damping: 20
                      }}
                      className="perspective-1000"
                    >
                      <div
                        className="relative cursor-pointer"
                        onClick={() => flipCard(card.id)}
                        style={{ width: '180px', height: '260px' }}
                      >
                        <motion.div
                          className="relative w-full h-full"
                          animate={{ rotateY: isFlipped ? 180 : 0 }}
                          transition={{ duration: 0.6, ease: "easeInOut" }}
                          style={{ transformStyle: 'preserve-3d' }}
                          whileHover={{ scale: 1.05 }}
                        >
                          {/* Card Back */}
                          <div
                            className="absolute inset-0 w-full h-full backface-hidden rounded-lg border-2 border-gray-400 bg-gradient-to-br from-gray-50 to-gray-200 shadow-xl flex items-center justify-center relative overflow-hidden group"
                            style={{ backfaceVisibility: 'hidden' }}
                          >
                            <img
                              src="/oglogonobg.png"
                              alt="ESP.FUN Logo"
                              className="w-20 h-20 object-contain filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
                            />
                          </div>

                          {/* Card Front */}
                          <div
                            className="absolute inset-0 w-full h-full backface-hidden rounded-lg border-2 border-blue-400 bg-gradient-to-br from-slate-600 via-blue-600 to-slate-700 shadow-xl transition-all duration-300"
                            style={{
                              backfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)'
                            }}
                          >
                            <div className="h-14 bg-gradient-to-r from-white/10 to-white/5 border-b border-white/20 flex items-center px-3">
                              <div className="bg-white/20 rounded-full px-4 py-1 border border-white/30 mr-3 flex items-center justify-center">
                                <span className="text-white font-bold text-xs">{card.name}</span>
                              </div>
                            </div>

                            <div className="p-3">
                              <div className="relative">
                                {/* Team logo background */}
                                <div 
                                  className="absolute inset-0 rounded opacity-50 z-0"
                                  style={{
                                    backgroundImage: `url(${getPlayerData(card.id).image.replace(/\/[^\/]*$/, '/logo.webp')})`,
                                    backgroundSize: 'contain',
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat'
                                  }}
                                />
                                <ImageWithFallback
                                  src={getPlayerData(card.id).image}
                                  alt={card.name}
                                  className="relative z-10 w-full h-24 object-contain rounded border-2 border-white/50 shadow-md opacity-85"
                                />
                                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center border-2 border-white">
                                  <span className="text-white font-bold text-xs">{card.rating}</span>
                                </div>
                              </div>
                            </div>

                            <div className="px-3 pb-3 space-y-1">
                              <p className="text-white/90 text-xs text-center drop-shadow">{card.game}</p>
                              <p className="text-white/80 text-xs text-center drop-shadow">{card.position}</p>
                              <div className="bg-white/20 backdrop-blur-sm rounded px-2 py-1 mt-2">
                                <p className="text-white font-semibold text-xs text-center drop-shadow">{formatShares(card.shares)} Shares</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="text-center space-y-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
              >
                <Button
                  onClick={() => {
                    setShowCards(false);
                    setSelectedPack(null);
                    setOpenedCards([]);
                    setFlippedCards(new Set());
                  }}
                  variant="outline"
                  className="mr-4"
                >
                  Close
                </Button>
                <Button className="bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700">
                  Add to Collection
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
