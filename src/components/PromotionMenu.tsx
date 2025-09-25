import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Scissors, TrendingUp, Star, X, ArrowLeft, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { parseUnits } from 'viem';
import { apiService } from '../services/apiService';
import { useAuthentication } from '../hooks/useAuthentication';
import { debounce } from '../utils/retryUtils';

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  image: string;
  tier: 'rookie' | 'pro' | 'elite' | 'legend';
  price: number;
  change: number;
  canPromote?: boolean;
  canCut?: boolean;
  lockedShares?: string; // Actual locked balance from contract
}

interface PromotionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
}

const tierColors = {
  rookie: 'from-gray-400 to-gray-600',
  pro: 'from-blue-400 to-blue-600',
  elite: 'from-purple-400 to-purple-600',
  legend: 'from-yellow-400 to-yellow-600',
};

const nextTier = {
  rookie: 'pro',
  pro: 'elite',
  elite: 'legend',
  legend: 'legend',
};

export function PromotionMenu({ isOpen, onClose, player }: PromotionMenuProps) {
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<'main' | 'promote' | 'cut'>('main');
  const [promoteShares, setPromoteShares] = useState('');
  const [cutShares, setCutShares] = useState('');
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
  const [promotionCost, setPromotionCost] = useState<number | null>(null);
  const [cutValue, setCutValue] = useState<number | null>(null);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [userPoints, setUserPoints] = useState<{ skillPoints: number; tournamentPoints: number } | null>(null);
  
  // Real-time cost calculation states
  const [realTimePromotionCost, setRealTimePromotionCost] = useState<number | null>(null);
  const [realTimeCutValue, setRealTimeCutValue] = useState<number | null>(null);
  const [loadingRealTimeCosts, setLoadingRealTimeCosts] = useState(false);

  // Authentication states
  const { 
    isAuthenticated, 
    isAuthenticating, 
    authenticate, 
    error: authError,
    walletConnected 
  } = useAuthentication();

  // Create a debounced version of cost loading to prevent request spam
  const debouncedLoadCosts = useMemo(
    () => debounce(async (playerId: string) => {
      if (!playerId) return;
      
      setLoadingCosts(true);
      try {
        // Load both promotion cost and cut value in parallel
        const [promotionCostResponse, cutValueResponse] = await Promise.all([
          apiService.getPromotionCost([playerId]),
          apiService.getCutValue([playerId])
        ]);
        
        setPromotionCost(promotionCostResponse[playerId] || null);
        setCutValue(cutValueResponse[playerId] || null);
      } catch (error) {
        console.error('Error loading cost and value info:', error);
        // Only show error toast if it's not a rate limit error (cache will handle those)
        if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && !error.message.includes('Rate limit')) {
          toast.error('Failed to load cost information');
        }
      } finally {
        setLoadingCosts(false);
      }
    }, 500), // 500ms debounce delay
    []
  );

  // Load cost and value information when modal opens
  useEffect(() => {
    if (isOpen && player?.id) {
      // Auto-authenticate if not authenticated and wallet is connected
      if (!isAuthenticated && walletConnected && !isAuthenticating) {
        console.log('🔐 Auto-authenticating for PromotionMenu...');
        authenticate();
      }
      
      debouncedLoadCosts(player.id);
      // Also fetch user points
      loadUserPoints();
    }
  }, [isOpen, player?.id, debouncedLoadCosts, isAuthenticated, walletConnected, isAuthenticating, authenticate]);

  const loadUserPoints = async () => {
    try {
      const points = await apiService.getUserPoints();
      setUserPoints(points);
    } catch (error) {
      console.error('Error loading user points:', error);
    }
  };

  // Debounced real-time cost calculation for promotion
  const debouncedCalculatePromotionCost = useMemo(
    () => debounce(async (playerId: string, shares: number) => {
      if (!shares || shares <= 0) {
        setRealTimePromotionCost(null);
        return;
      }
      
      setLoadingRealTimeCosts(true);
      try {
        const cost = await apiService.getPromotionCostForAmount(playerId, shares);
        setRealTimePromotionCost(cost);
      } catch (error) {
        console.error('Error calculating real-time promotion cost:', error);
        setRealTimePromotionCost(null);
      } finally {
        setLoadingRealTimeCosts(false);
      }
    }, 500),
    []
  );

  // Debounced real-time cost calculation for cut
  const debouncedCalculateCutValue = useMemo(
    () => debounce(async (playerId: string, shares: number) => {
      if (!shares || shares <= 0) {
        setRealTimeCutValue(null);
        return;
      }
      
      setLoadingRealTimeCosts(true);
      try {
        const value = await apiService.getCutValueForAmount(playerId, shares);
        setRealTimeCutValue(value);
      } catch (error) {
        console.error('Error calculating real-time cut value:', error);
        setRealTimeCutValue(null);
      } finally {
        setLoadingRealTimeCosts(false);
      }
    }, 500),
    []
  );

  if (!player) return null;

  // Use actual locked shares from contract, fallback to 0 if not available
  const totalShares = parseInt(player.lockedShares || '0');

  const handlePercentageSelect = (percentage: number, isPromote: boolean) => {
    setSelectedPercentage(percentage);
    const shares = Math.floor((totalShares * percentage) / 100);
    const sharesStr = shares.toString();
    
    if (isPromote) {
      setPromoteShares(sharesStr);
      // Trigger real-time cost calculation
      if (shares > 0 && player) {
        debouncedCalculatePromotionCost(player.id, shares);
      }
    } else {
      setCutShares(sharesStr);
      // Trigger real-time cost calculation
      if (shares > 0 && player) {
        debouncedCalculateCutValue(player.id, shares);
      }
    }
  };

  const handlePromoteSubmit = async () => {
    console.log('🚀 Promote button clicked', { player: player?.id, shares: promoteShares });
    
    if (!player) return;
    
    const shares = parseInt(promoteShares) || 0;
    if (shares <= 0 || shares > totalShares) {
      toast.error('Please enter a valid number of shares');
      return;
    }

    // Check if user has enough skill points
    const totalCost = realTimePromotionCost !== null ? realTimePromotionCost : 
                     (promotionCost ? promotionCost * shares : 0);
    
    if (userPoints && totalCost > userPoints.skillPoints) {
      toast.error(`Insufficient skill points. You need ${totalCost.toLocaleString()} but only have ${userPoints.skillPoints.toLocaleString()}`);
      return;
    }

    console.log('🔄 Starting promotion process...', { playerId: player.id, shares });
    
    setLoading(true);
    try {
      const result = await apiService.promotePlayer(player.id, shares);
      
      toast.success(`Successfully promoted ${shares} shares of ${player.name}!`);
      
      // Refresh user points after successful promotion
      loadUserPoints();
      
      onClose();
    } catch (error) {
      console.error('Error promoting player:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during promotion. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCutSubmit = async () => {
    console.log('✂️ Cut button clicked', { player: player?.id, shares: cutShares });
    
    if (!player) return;
    
    const shares = parseInt(cutShares) || 0;
    if (shares <= 0 || shares > totalShares) {
      toast.error('Please enter a valid number of shares');
      return;
    }

    console.log('🔄 Starting cut process...', { playerId: player.id, shares });

    setLoading(true);
    try {
      const result = await apiService.cutPlayer(player.id, shares);
      
      toast.success(`Successfully cut ${shares} shares of ${player.name}!`);
      
      // Refresh user points after successful cut
      loadUserPoints();
      
      onClose();
    } catch (error) {
      console.error('Error cutting player:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during cut. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPromoteShares('');
    setCutShares('');
    setSelectedPercentage(null);
    setActiveAction('main');
  };

  const canPromote = player.tier !== 'legend';
  const nextPlayerTier = nextTier[player.tier as keyof typeof nextTier];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto p-0 bg-gradient-to-br from-background via-background to-accent/10 border-0 shadow-2xl overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Header with Player Info */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative p-6 bg-gradient-to-r from-accent/20 via-accent/10 to-transparent"
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="absolute top-4 right-4 h-8 w-8 p-0 rounded-full hover:bg-background/50"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Back button for sub-menus */}
            {activeAction !== 'main' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="absolute top-4 left-4 h-8 w-8 p-0 rounded-full hover:bg-background/50"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}

            {/* Player info */}
            <div className="flex items-center space-x-4 mt-2">
              <div className="relative">
                <ImageWithFallback
                  src={player.image}
                  alt={player.name}
                  className="w-16 h-16 rounded-2xl object-cover shadow-lg ring-2 ring-white/20"
                />
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r ${tierColors[player.tier]} flex items-center justify-center shadow-lg`}>
                  <Star className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground">{player.name}</h3>
                <p className="text-sm text-muted-foreground">{player.team} • {player.position}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {player.tier.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {player.lockedShares} shares
                  </Badge>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Main Action Menu */}
          {activeAction === 'main' && (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-4"
            >
              <div className="text-center mb-6">
                <h4 className="text-lg font-semibold text-foreground mb-2">Choose Action</h4>
                <p className="text-sm text-muted-foreground">
                  Manage your {player.name} shares
                </p>
              </div>

              {/* Authentication Status */}
              {!walletConnected && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Wallet Not Connected</span>
                  </div>
                  <p className="text-xs text-yellow-700 mt-1">
                    Please connect your wallet to manage player shares.
                  </p>
                </div>
              )}

              {walletConnected && !isAuthenticated && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
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
                </div>
              )}

              <div className="space-y-3">
                {/* Promote Button */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={() => setActiveAction('promote')}
                    disabled={!canPromote || !isAuthenticated || isAuthenticating}
                    className="w-full h-16 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0 shadow-lg relative transition-all duration-300"
                  >
                    {/* No overlay or white effect for dark mode. Only subtle color change. Uses dark: classes for dark mode hover. */}
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-base">Promote Player</div>
                        {canPromote ? (
                          <div className="text-sm opacity-90">
                            Upgrade to {nextPlayerTier?.toUpperCase()}
                          </div>
                        ) : (
                          <div className="text-sm opacity-90">
                            Already at max tier
                          </div>
                        )}
                      </div>
                      {canPromote && <Sparkles className="h-5 w-5 ml-auto" />}
                    </div>
                  </Button>
                </motion.div>

                {/* Cut Button */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={() => setActiveAction('cut')}
                    disabled={!isAuthenticated || isAuthenticating}
                    className="w-full h-16 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg relative transition-all duration-300"
                  >
                    {/* No overlay or white effect for dark mode. Only subtle color change. Uses dark: classes for dark mode hover. */}
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <Scissors className="h-6 w-6" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-base">Cut Player</div>
                        <div className="text-sm opacity-90">
                          Remove shares from team
                        </div>
                      </div>
                    </div>
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Promote Menu */}
          {activeAction === 'promote' && (
            <motion.div
              key="promote"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="text-center">
                <h4 className="text-lg font-semibold text-foreground mb-2">Promote Shares</h4>
                <p className="text-sm text-muted-foreground">
                  Choose how many shares to promote
                </p>
                {loadingCosts ? (
                  <div className="text-sm text-blue-500 mt-2">Loading promotion costs...</div>
                ) : promotionCost !== null ? (
                  <div className="text-sm text-blue-600 font-medium mt-2">
                    Cost: {promotionCost} skill points per share
                  </div>
                ) : null}
                {userPoints && (
                  <div className="text-sm text-muted-foreground mt-2">
                    Your balance: {userPoints.skillPoints.toLocaleString()} skill points
                  </div>
                )}
              </div>

              {/* Authentication Status for Promote Menu */}
              {walletConnected && !isAuthenticated && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-blue-800">
                    {isAuthenticating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {isAuthenticating ? 'Authenticating...' : 'Authenticating...'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    {isAuthenticating 
                      ? 'Please wait while we authenticate your wallet...' 
                      : 'Authentication in progress...'
                    }
                  </p>
                </div>
              )}

              {/* Manual Input */}
              <div className="space-y-2">
                <Label htmlFor="promote-shares" className="text-sm font-medium">Custom Amount</Label>
                <Input
                  id="promote-shares"
                  type="number"
                  value={promoteShares}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPromoteShares(value);
                    setSelectedPercentage(null);
                    
                    // Trigger real-time cost calculation
                    const shares = parseInt(value);
                    if (shares > 0 && player) {
                      debouncedCalculatePromotionCost(player.id, shares);
                    } else {
                      setRealTimePromotionCost(null);
                    }
                  }}
                  placeholder="Enter shares to promote"
                  max={totalShares}
                  min={1}
                  className="h-12 text-center text-lg"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Available: {player.lockedShares || '0'} shares
                </p>
                {(promotionCost !== null || realTimePromotionCost !== null) && promoteShares && parseInt(promoteShares) > 0 && (
                  <div className={`text-sm font-medium text-center mt-1 ${
                    userPoints && realTimePromotionCost !== null && realTimePromotionCost > userPoints.skillPoints
                      ? 'text-red-500'
                      : userPoints && promotionCost !== null && (promotionCost * parseInt(promoteShares)) > userPoints.skillPoints
                      ? 'text-red-500'
                      : 'text-blue-600'
                  }`}>
                    {loadingRealTimeCosts ? (
                      <div className="text-xs text-muted-foreground">Calculating cost...</div>
                    ) : realTimePromotionCost !== null ? (
                      <>
                        Total cost: {realTimePromotionCost.toLocaleString()} skill points
                        {userPoints && realTimePromotionCost > userPoints.skillPoints && (
                          <div className="text-xs text-red-400 mt-1">
                            Insufficient skill points
                          </div>
                        )}
                      </>
                    ) : promotionCost !== null ? (
                      <>
                        Total cost: {(promotionCost * parseInt(promoteShares)).toLocaleString()} skill points
                        {userPoints && (promotionCost * parseInt(promoteShares)) > userPoints.skillPoints && (
                          <div className="text-xs text-red-400 mt-1">
                            Insufficient skill points
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Percentage Buttons */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Quick Select</Label>
                <div className="flex gap-1">
                  {[25, 50, 75, 100].map((percentage) => (
                    <motion.div key={percentage} whileTap={{ scale: 0.95 }} className="flex-1">
                      <Button
                        variant={selectedPercentage === percentage ? "default" : "outline"}
                        onClick={() => handlePercentageSelect(percentage, true)}
                        className="w-full h-8 text-xs font-medium px-2"
                      >
                        {percentage}%
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1 h-12"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePromoteSubmit}
                  disabled={
                    loading || 
                    !promoteShares || 
                    parseInt(promoteShares) <= 0 ||
                    !isAuthenticated ||
                    isAuthenticating ||
                    (userPoints && (
                      (realTimePromotionCost !== null && realTimePromotionCost > userPoints.skillPoints) ||
                      (realTimePromotionCost === null && promotionCost && promoteShares && 
                       (promotionCost * parseInt(promoteShares)) > userPoints.skillPoints)
                    ))
                  }
                  className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0 transition-all duration-300"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Promoting...
                    </div>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Promote
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Cut Menu */}
          {activeAction === 'cut' && (
            <motion.div
              key="cut"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="text-center">
                <h4 className="text-lg font-semibold text-foreground mb-2">Cut Shares</h4>
                <p className="text-sm text-muted-foreground">
                  Choose how many shares to cut
                </p>
                {loadingCosts ? (
                  <div className="text-sm text-green-500 mt-2">Loading cut values...</div>
                ) : cutValue !== null ? (
                  <div className="text-sm text-green-600 font-medium mt-2">
                    Reward: {cutValue} tournament points per share
                  </div>
                ) : null}
                {userPoints && (
                  <div className="text-sm text-muted-foreground mt-2">
                    Your balance: {userPoints.tournamentPoints.toLocaleString()} tournament points
                  </div>
                )}
              </div>

              {/* Authentication Status for Cut Menu */}
              {walletConnected && !isAuthenticated && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-blue-800">
                    {isAuthenticating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {isAuthenticating ? 'Authenticating...' : 'Authenticating...'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    {isAuthenticating 
                      ? 'Please wait while we authenticate your wallet...' 
                      : 'Authentication in progress...'
                    }
                  </p>
                </div>
              )}

              {/* Manual Input */}
              <div className="space-y-2">
                <Label htmlFor="cut-shares" className="text-sm font-medium">Custom Amount</Label>
                <Input
                  id="cut-shares"
                  type="number"
                  value={cutShares}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCutShares(value);
                    setSelectedPercentage(null);
                    
                    // Trigger real-time cost calculation
                    const shares = parseInt(value);
                    if (shares > 0 && player) {
                      debouncedCalculateCutValue(player.id, shares);
                    } else {
                      setRealTimeCutValue(null);
                    }
                  }}
                  placeholder="Enter shares to cut"
                  max={totalShares}
                  min={1}
                  className="h-12 text-center text-lg"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Available: {player.lockedShares || '0'} shares
                </p>
                {(cutValue !== null || realTimeCutValue !== null) && cutShares && parseInt(cutShares) > 0 && (
                  <div className="text-sm text-green-600 font-medium text-center mt-1">
                    {loadingRealTimeCosts ? (
                      <div className="text-xs text-muted-foreground">Calculating reward...</div>
                    ) : realTimeCutValue !== null ? (
                      <>Total reward: {realTimeCutValue.toLocaleString()} tournament points</>
                    ) : cutValue !== null ? (
                      <>Total reward: {(cutValue * parseInt(cutShares)).toLocaleString()} tournament points</>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Percentage Buttons */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Quick Select</Label>
                <div className="flex gap-1">
                  {[25, 50, 75, 100].map((percentage) => (
                    <motion.div key={percentage} whileTap={{ scale: 0.95 }} className="flex-1">
                      <Button
                        variant={selectedPercentage === percentage ? "default" : "outline"}
                        onClick={() => handlePercentageSelect(percentage, false)}
                        className="w-full h-8 text-xs font-medium px-2"
                      >
                        {percentage}%
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1 h-12"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCutSubmit}
                  disabled={loading || !cutShares || parseInt(cutShares) <= 0 || !isAuthenticated || isAuthenticating}
                  className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 transition-all duration-300"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Cutting...
                    </div>
                  ) : (
                    <>
                      <Scissors className="h-4 w-4 mr-2" />
                      Cut
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
