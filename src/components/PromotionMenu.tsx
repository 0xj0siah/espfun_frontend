import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Scissors, TrendingUp, Star, X, ArrowLeft, Sparkles, AlertCircle, Loader2, Wallet, Zap } from 'lucide-react';
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
      <DialogContent className="max-w-md mx-auto p-0 bg-gradient-to-br from-background via-background to-accent/10 border-0 shadow-2xl overflow-hidden" hideCloseButton>
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
                  className="relative z-10 w-16 h-16 rounded-xl object-contain shadow-lg opacity-85"
                />
                <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-r ${tierColors[player.tier]} flex items-center justify-center shadow-lg`}>
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
              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-accent/20 p-3 text-center">
                  <div className="text-lg font-bold text-foreground">{player.lockedShares || '0'}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Shares</div>
                </div>
                <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-accent/20 p-3 text-center">
                  <div className={`text-sm font-bold bg-gradient-to-r ${tierColors[player.tier]} bg-clip-text text-transparent`}>
                    {player.tier.toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Current Tier</div>
                </div>
                <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-accent/20 p-3 text-center">
                  {loadingCosts ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                  ) : (
                    <div className="text-sm font-bold text-foreground">{player.price}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">Price</div>
                </div>
              </div>

              {/* Authentication Status */}
              {!walletConnected && (
                <Alert className="border-yellow-500/30 bg-yellow-500/10">
                  <Wallet className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-yellow-200">
                    <span className="font-medium">Wallet Not Connected</span>
                    <p className="text-xs opacity-80 mt-0.5">Please connect your wallet to manage player shares.</p>
                  </AlertDescription>
                </Alert>
              )}

              {walletConnected && !isAuthenticated && (
                <Alert className="border-blue-500/30 bg-blue-500/10">
                  {isAuthenticating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                  )}
                  <AlertDescription className="text-blue-200">
                    <span className="font-medium">
                      {isAuthenticating ? 'Authenticating...' : 'Authentication Required'}
                    </span>
                    <p className="text-xs opacity-80 mt-0.5">
                      {isAuthenticating
                        ? 'Please wait while we authenticate your wallet...'
                        : 'Authenticating automatically...'
                      }
                    </p>
                    {authError && (
                      <p className="text-xs text-red-400 mt-1">{authError}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {/* Promote Card */}
                <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}>
                  <button
                    onClick={() => canPromote && isAuthenticated && !isAuthenticating && setActiveAction('promote')}
                    disabled={!canPromote || !isAuthenticated || isAuthenticating}
                    className="w-full rounded-2xl border border-green-500/25 bg-gradient-to-br from-green-950/60 via-emerald-950/40 to-background/80 backdrop-blur-sm p-4 relative overflow-hidden group transition-all duration-300 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/[0.03] to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/30 to-emerald-500/20 border border-green-500/30 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">Promote</span>
                          {canPromote && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/25">
                              {player.tier.toUpperCase()} → {nextPlayerTier?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {loadingCosts ? (
                            <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Loading cost...</span>
                          ) : promotionCost !== null ? (
                            <span>{promotionCost.toLocaleString()} <span className="text-green-400/70">skill pts</span> per share</span>
                          ) : canPromote ? (
                            'Use skill points to upgrade tier'
                          ) : (
                            'Already at maximum tier'
                          )}
                        </div>
                      </div>
                      {canPromote && <Sparkles className="h-4 w-4 text-green-400/60 shrink-0" />}
                    </div>
                  </button>
                </motion.div>

                {/* Cut Card */}
                <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}>
                  <button
                    onClick={() => isAuthenticated && !isAuthenticating && setActiveAction('cut')}
                    disabled={!isAuthenticated || isAuthenticating}
                    className="w-full rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-950/60 via-purple-950/40 to-background/80 backdrop-blur-sm p-4 relative overflow-hidden group transition-all duration-300 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/[0.03] to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
                        <Scissors className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">Cut</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/25">
                            {player.lockedShares || '0'} shares
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {loadingCosts ? (
                            <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Loading reward...</span>
                          ) : cutValue !== null ? (
                            <span>{cutValue.toLocaleString()} <span className="text-blue-400/70">tournament pts</span> per share</span>
                          ) : (
                            'Sell shares for tournament points'
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
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
                <h4 className="text-lg font-semibold text-foreground mb-1">Promote Shares</h4>
                <p className="text-sm text-muted-foreground">
                  Upgrade to {nextPlayerTier?.toUpperCase()} tier
                </p>
              </div>

              {/* Cost info card */}
              <div className="rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/10 border border-green-500/20 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" />Cost per share</span>
                  {loadingCosts ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : promotionCost !== null ? (
                    <span className="font-semibold text-green-400">{promotionCost.toLocaleString()} SP</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                {userPoints && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Your balance</span>
                    <span className="font-medium">{userPoints.skillPoints.toLocaleString()} SP</span>
                  </div>
                )}
              </div>

              {/* Authentication Status for Promote Menu */}
              {walletConnected && !isAuthenticated && (
                <Alert className="border-blue-500/30 bg-blue-500/10">
                  {isAuthenticating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                  )}
                  <AlertDescription className="text-blue-200 text-xs">
                    {isAuthenticating ? 'Authenticating your wallet...' : 'Authentication in progress...'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Manual Input */}
              <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-accent/20 p-4 space-y-3">
                <Label htmlFor="promote-shares" className="text-sm font-medium">Shares to Promote</Label>
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
                  className="h-12 text-center text-lg bg-background/50 border-accent/20 focus:border-accent/40"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Available: {player.lockedShares || '0'} shares
                </p>
                {(promotionCost !== null || realTimePromotionCost !== null) && promoteShares && parseInt(promoteShares) > 0 && (
                  <div className={`rounded-lg p-3 text-sm font-medium text-center ${
                    userPoints && (
                      (realTimePromotionCost !== null && realTimePromotionCost > userPoints.skillPoints) ||
                      (realTimePromotionCost === null && promotionCost !== null && (promotionCost * parseInt(promoteShares)) > userPoints.skillPoints)
                    )
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                      : 'bg-green-500/10 border border-green-500/20 text-green-400'
                  }`}>
                    {loadingRealTimeCosts ? (
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-xs">Calculating cost...</span>
                      </div>
                    ) : realTimePromotionCost !== null ? (
                      <>
                        Total: {realTimePromotionCost.toLocaleString()} skill points
                        {userPoints && realTimePromotionCost > userPoints.skillPoints && (
                          <div className="text-xs mt-0.5">Insufficient skill points</div>
                        )}
                      </>
                    ) : promotionCost !== null ? (
                      <>
                        Total: {(promotionCost * parseInt(promoteShares)).toLocaleString()} skill points
                        {userPoints && (promotionCost * parseInt(promoteShares)) > userPoints.skillPoints && (
                          <div className="text-xs mt-0.5">Insufficient skill points</div>
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
                        onClick={() => handlePercentageSelect(percentage, true)}
                        className={`w-full h-8 text-xs font-medium px-2 border transition-all duration-200 ${
                          selectedPercentage === percentage
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white border-0 shadow-sm'
                            : 'bg-transparent border-accent/30 text-muted-foreground hover:border-green-500/50 hover:text-green-400'
                        }`}
                      >
                        {percentage}%
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1 h-12 border-accent/30 hover:bg-accent/10"
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
                  className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0 relative overflow-hidden group transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  {loading ? (
                    <div className="flex items-center gap-2 relative z-10">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Promoting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 relative z-10">
                      <TrendingUp className="h-4 w-4" />
                      Promote
                    </div>
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
                <h4 className="text-lg font-semibold text-foreground mb-1">Cut Shares</h4>
                <p className="text-sm text-muted-foreground">
                  Remove shares and earn tournament points
                </p>
              </div>

              {/* Reward info card */}
              <div className="rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/10 border border-blue-500/20 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" />Reward per share</span>
                  {loadingCosts ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : cutValue !== null ? (
                    <span className="font-semibold text-blue-400">{cutValue.toLocaleString()} TP</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                {userPoints && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Your balance</span>
                    <span className="font-medium">{userPoints.tournamentPoints.toLocaleString()} TP</span>
                  </div>
                )}
              </div>

              {/* Authentication Status for Cut Menu */}
              {walletConnected && !isAuthenticated && (
                <Alert className="border-blue-500/30 bg-blue-500/10">
                  {isAuthenticating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                  )}
                  <AlertDescription className="text-blue-200 text-xs">
                    {isAuthenticating ? 'Authenticating your wallet...' : 'Authentication in progress...'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Manual Input */}
              <div className="rounded-xl bg-card/50 backdrop-blur-sm border border-accent/20 p-4 space-y-3">
                <Label htmlFor="cut-shares" className="text-sm font-medium">Shares to Cut</Label>
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
                  className="h-12 text-center text-lg bg-background/50 border-accent/20 focus:border-accent/40"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Available: {player.lockedShares || '0'} shares
                </p>
                {(cutValue !== null || realTimeCutValue !== null) && cutShares && parseInt(cutShares) > 0 && (
                  <div className="rounded-lg p-3 text-sm font-medium text-center bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    {loadingRealTimeCosts ? (
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-xs">Calculating reward...</span>
                      </div>
                    ) : realTimeCutValue !== null ? (
                      <>Total: {realTimeCutValue.toLocaleString()} tournament points</>
                    ) : cutValue !== null ? (
                      <>Total: {(cutValue * parseInt(cutShares)).toLocaleString()} tournament points</>
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
                        onClick={() => handlePercentageSelect(percentage, false)}
                        className={`w-full h-8 text-xs font-medium px-2 border transition-all duration-200 ${
                          selectedPercentage === percentage
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 shadow-sm'
                            : 'bg-transparent border-accent/30 text-muted-foreground hover:border-blue-500/50 hover:text-blue-400'
                        }`}
                      >
                        {percentage}%
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1 h-12 border-accent/30 hover:bg-accent/10"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCutSubmit}
                  disabled={loading || !cutShares || parseInt(cutShares) <= 0 || !isAuthenticated || isAuthenticating}
                  className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 relative overflow-hidden group transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  {loading ? (
                    <div className="flex items-center gap-2 relative z-10">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cutting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 relative z-10">
                      <Scissors className="h-4 w-4" />
                      Cut
                    </div>
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
