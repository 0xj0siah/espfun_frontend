import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Scissors, Play, Star, X, Sparkles, AlertCircle, Loader2, Wallet, Zap, Info, CheckCircle, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
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
  lockedShares?: string;
}

interface PromotionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
}

export function PromotionMenu({ isOpen, onClose, player }: PromotionMenuProps) {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'activate' | 'cut'>('activate');
  const [shares, setShares] = useState('');
  const [promotionCost, setPromotionCost] = useState<number | null>(null);
  const [cutValue, setCutValue] = useState<number | null>(null);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [userPoints, setUserPoints] = useState<{ skillPoints: number; tournamentPoints: number } | null>(null);
  const [realTimeCost, setRealTimeCost] = useState<number | null>(null);
  const [loadingRealTimeCost, setLoadingRealTimeCost] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [txMessage, setTxMessage] = useState('');
  const [isModalContentVisible, setIsModalContentVisible] = useState(true);

  const {
    isAuthenticated,
    isAuthenticating,
    authenticate,
    error: authError,
    walletConnected
  } = useAuthentication();

  // Load costs when modal opens
  const debouncedLoadCosts = useMemo(
    () => debounce(async (playerId: string) => {
      if (!playerId) return;
      setLoadingCosts(true);
      try {
        const [promoRes, cutRes] = await Promise.all([
          apiService.getPromotionCost([playerId]),
          apiService.getCutValue([playerId])
        ]);
        setPromotionCost(promoRes[playerId] || null);
        setCutValue(cutRes[playerId] || null);
      } catch (error) {
        console.error('Error loading costs:', error);
      } finally {
        setLoadingCosts(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    if (isOpen && player?.id) {
      if (!isAuthenticated && walletConnected && !isAuthenticating) {
        authenticate();
      }
      debouncedLoadCosts(player.id);
      loadUserPoints();
      setIsModalContentVisible(true);
      setShares('');
      setTxStatus('idle');
      setTxMessage('');
      setAction('activate');
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

  // Real-time cost calculation
  const debouncedCalculateCost = useMemo(
    () => debounce(async (playerId: string, shareCount: number, currentAction: 'activate' | 'cut') => {
      if (!shareCount || shareCount <= 0) {
        setRealTimeCost(null);
        return;
      }
      setLoadingRealTimeCost(true);
      try {
        const value = currentAction === 'activate'
          ? await apiService.getPromotionCostForAmount(playerId, shareCount)
          : await apiService.getCutValueForAmount(playerId, shareCount);
        setRealTimeCost(value);
      } catch (error) {
        console.error('Error calculating cost:', error);
        setRealTimeCost(null);
      } finally {
        setLoadingRealTimeCost(false);
      }
    }, 500),
    []
  );

  if (!player) return null;

  const totalShares = parseInt(player.lockedShares || '0');
  const shareCount = parseInt(shares) || 0;
  const costPerShare = action === 'activate' ? promotionCost : cutValue;
  const estimatedTotal = realTimeCost !== null ? realTimeCost : (costPerShare ? costPerShare * shareCount : 0);
  const pointsLabel = action === 'activate' ? 'skill points' : 'tournament points';
  const pointsBalance = action === 'activate' ? userPoints?.skillPoints : userPoints?.tournamentPoints;
  const insufficientPoints = action === 'activate' && userPoints && estimatedTotal > userPoints.skillPoints;

  const handleSharesChange = (value: string) => {
    setShares(value);
    const count = parseInt(value);
    if (count > 0 && player) {
      debouncedCalculateCost(player.id, count, action);
    } else {
      setRealTimeCost(null);
    }
  };

  const handlePercentageSelect = (percentage: number) => {
    const count = Math.floor((totalShares * percentage) / 100);
    setShares(count.toString());
    if (count > 0 && player) {
      debouncedCalculateCost(player.id, count, action);
    }
  };

  const handleSubmit = async () => {
    if (!player || shareCount <= 0 || shareCount > totalShares) return;

    if (action === 'activate' && insufficientPoints) {
      toast.error('Insufficient skill points');
      return;
    }

    setLoading(true);
    setTxStatus('pending');
    setTxMessage(action === 'activate' ? 'Activating player shares...' : 'Cutting player shares...');

    try {
      if (action === 'activate') {
        await apiService.promotePlayer(player.id, shareCount);
        toast.success(`Activated ${shareCount} shares of ${player.name}`);
      } else {
        await apiService.cutPlayer(player.id, shareCount);
        toast.success(`Cut ${shareCount} shares of ${player.name}`);
      }
      setTxStatus('success');
      setTxMessage(action === 'activate'
        ? `${shareCount} shares moved to your active lineup`
        : `${shareCount} shares cut for tournament points`
      );
      loadUserPoints();
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error(`${action} error:`, error);
      const msg = error instanceof Error ? error.message : 'Transaction failed. Please try again.';
      setTxStatus('error');
      setTxMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsModalContentVisible(false);
    setTimeout(() => {
      setShares('');
      setTxStatus('idle');
      setTxMessage('');
      setRealTimeCost(null);
      onClose();
    }, 300);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-0 shadow-2xl" hideCloseButton>
        <div className="relative">
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className={`absolute -top-2 -right-2 z-10 h-8 w-8 p-0 rounded-full hover:bg-background/50 transition-opacity duration-300 ${
              !isModalContentVisible ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <X className="h-4 w-4" />
          </Button>

          <AnimatePresence mode="wait">
            {isModalContentVisible && (
              <motion.div
                layout={false}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {/* Header */}
                <DialogHeader className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
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
                          className="relative z-10 w-20 h-20 rounded-xl object-contain shadow-lg opacity-85"
                        />
                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold z-20">
                          <Star className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <DialogTitle className="text-2xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                          {player.name}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                          Manage benched shares for {player.name}
                        </DialogDescription>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline" className="flex items-center space-x-1">
                            <span>{player.position}</span>
                          </Badge>
                          <Badge variant="secondary">{player.team}</Badge>
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200/50 hover:bg-amber-100">
                            Benched
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                {/* Auth Alerts */}
                {!walletConnected && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4"
                  >
                    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Wallet Not Connected</span>
                    </div>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                      Connect your wallet to manage player shares.
                    </p>
                  </motion.div>
                )}

                {walletConnected && !isAuthenticated && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4"
                  >
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                      {isAuthenticating ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">
                        {isAuthenticating ? 'Authenticating...' : 'Authentication Required'}
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      {isAuthenticating
                        ? 'Please wait while we authenticate your wallet...'
                        : 'Authenticating automatically...'
                      }
                    </p>
                    {authError && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{authError}</p>
                    )}
                  </motion.div>
                )}

                <div className="space-y-6 mt-6">
                  {/* Shares & Points Overview */}
                  <Card className="p-6 bg-gradient-to-r from-accent/30 to-accent/10 border-0">
                    <div className="grid grid-cols-3 gap-6 text-center">
                      <div>
                        <p className="text-2xl font-bold text-foreground">{player.lockedShares || '0'}</p>
                        <p className="text-xs text-muted-foreground mt-1">Benched Shares</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {loadingCosts ? (
                            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                          ) : (
                            player.price || '—'
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Price / Share</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {userPoints ? userPoints.skillPoints.toLocaleString() : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Skill Points</p>
                      </div>
                    </div>
                  </Card>

                  {/* Action Toggle */}
                  <div className="flex justify-center space-x-2">
                    <Button
                      variant={action === 'activate' ? "default" : "outline"}
                      onClick={() => {
                        setAction('activate');
                        setShares('');
                        setRealTimeCost(null);
                      }}
                      className={`flex-1 ${action === 'activate' ? 'bg-gradient-to-r from-green-600 to-emerald-600' : ''}`}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Activate
                    </Button>
                    <Button
                      variant={action === 'cut' ? "default" : "outline"}
                      onClick={() => {
                        setAction('cut');
                        setShares('');
                        setRealTimeCost(null);
                      }}
                      className={`flex-1 ${action === 'cut' ? 'bg-gradient-to-r from-blue-600 to-purple-600' : ''}`}
                    >
                      <Scissors className="w-4 h-4 mr-2" />
                      Cut
                    </Button>
                  </div>

                  {/* Input Section */}
                  <Card className="p-6 bg-card/50 backdrop-blur-sm border-accent/20">
                    <div className="space-y-5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                          {action === 'activate' ? 'Shares to Activate' : 'Shares to Cut'}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-4 h-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {action === 'activate'
                                  ? 'Spend skill points to move benched shares to your active lineup'
                                  : 'Remove shares and earn tournament points in return'
                                }
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <div className="relative">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max={totalShares}
                          value={shares}
                          onChange={(e) => handleSharesChange(e.target.value)}
                          className="w-full text-2xl font-bold pr-20 bg-background/50 border-accent/20 focus:border-accent/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0"
                          disabled={loading}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <span className="text-sm font-bold text-foreground/80">shares</span>
                        </div>
                      </div>

                      {/* Quick Select Buttons */}
                      <div className="flex gap-2">
                        {[25, 50, 75, 100].map((pct) => (
                          <Button
                            key={pct}
                            variant="outline"
                            size="sm"
                            onClick={() => handlePercentageSelect(pct)}
                            disabled={loading}
                            className="flex-1 text-xs hover:bg-accent/40"
                          >
                            {pct}%
                          </Button>
                        ))}
                      </div>
                    </div>
                  </Card>

                  {/* Transaction Details */}
                  {shareCount > 0 && txStatus !== 'pending' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="rounded-lg bg-accent/20 p-4 space-y-3"
                    >
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {action === 'activate' ? 'Cost per share' : 'Reward per share'}
                        </span>
                        <span className="font-medium">
                          {loadingCosts ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                          ) : costPerShare !== null ? (
                            <>{costPerShare.toLocaleString()} {action === 'activate' ? 'SP' : 'TP'}</>
                          ) : '—'}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground font-medium">
                          {action === 'activate' ? 'Total Cost' : 'Total Reward'}
                        </span>
                        <span className={`font-bold ${insufficientPoints ? 'text-red-500' : action === 'activate' ? 'text-green-500' : 'text-blue-500'}`}>
                          {loadingRealTimeCost ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                          ) : (
                            <>{estimatedTotal.toLocaleString()} {pointsLabel}</>
                          )}
                        </span>
                      </div>
                      {action === 'activate' && userPoints && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Your balance</span>
                          <span>{userPoints.skillPoints.toLocaleString()} SP</span>
                        </div>
                      )}
                      {insufficientPoints && (
                        <p className="text-xs text-red-500 text-center">Insufficient skill points</p>
                      )}
                    </motion.div>
                  )}

                  {/* Transaction Status */}
                  <AnimatePresence>
                    {txStatus !== 'idle' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <Alert
                          variant={txStatus === 'error' ? 'destructive' : 'default'}
                          className={
                            txStatus === 'success'
                              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                              : txStatus === 'pending'
                              ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                              : ''
                          }
                        >
                          {txStatus === 'pending' && <Loader2 className="h-4 w-4 animate-spin" />}
                          {txStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {txStatus === 'error' && <XCircle className="h-4 w-4" />}
                          <AlertDescription className="text-sm">{txMessage}</AlertDescription>
                        </Alert>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      loading ||
                      shareCount <= 0 ||
                      shareCount > totalShares ||
                      !isAuthenticated ||
                      isAuthenticating ||
                      !!insufficientPoints ||
                      txStatus === 'success'
                    }
                    className={`w-full h-12 text-lg border-0 relative overflow-hidden group transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] ${
                      action === 'activate'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    {loading ? (
                      <div className="flex items-center gap-2 relative z-10">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {action === 'activate' ? 'Activating...' : 'Cutting...'}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 relative z-10">
                        {action === 'activate' ? <Play className="h-5 w-5" /> : <Scissors className="h-5 w-5" />}
                        {action === 'activate' ? 'Activate Shares' : 'Cut Shares'}
                      </div>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
