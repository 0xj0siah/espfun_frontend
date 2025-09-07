import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Scissors, TrendingUp, Star, Trophy, Zap, AlertCircle, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

// Mock implementations for promotion functions
const getPromotionCost = async (playerId: string): Promise<number> => {
  // Mock implementation - return a random cost between 50-200 ETH
  return Math.floor(Math.random() * 150) + 50;
};

const getCutValue = async (playerId: string): Promise<number> => {
  // Mock implementation - return a random value between 20-100 ETH
  return Math.floor(Math.random() * 80) + 20;
};

const cutPlayers = async (playerId: string, shares: number): Promise<any> => {
  // Mock implementation - simulate API call
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { success: true, message: `Successfully cut ${shares} shares of player ${playerId}` };
};

const promotePlayers = async (playerId: string, shares: number): Promise<any> => {
  // Mock implementation - simulate API call
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { success: true, message: `Successfully promoted ${shares} shares of player ${playerId}` };
};

const testFunction = () => {
  // Mock implementation
  return { status: 'ok', message: 'API service connection test successful' };
};

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
  rookie: 'bg-gray-100 text-gray-800',
  pro: 'bg-blue-100 text-blue-800',
  elite: 'bg-purple-100 text-purple-800',
  legend: 'bg-yellow-100 text-yellow-800',
};

const nextTier = {
  rookie: 'pro',
  pro: 'elite',
  elite: 'legend',
  legend: 'legend',
};

export function PromotionMenu({ isOpen, onClose, player }: PromotionMenuProps) {
  const [loading, setLoading] = useState(false);
  const [showPromoteMenu, setShowPromoteMenu] = useState(false);
  const [showCutMenu, setShowCutMenu] = useState(false);
  const [promoteShares, setPromoteShares] = useState('');
  const [cutShares, setCutShares] = useState('');
  const [promotePercentage, setPromotePercentage] = useState(25);
  const [cutPercentage, setCutPercentage] = useState(25);

  if (!player) return null;

  // Use actual locked shares from contract, fallback to 0 if not available
  const totalShares = parseInt(player.lockedShares || '0');

  const handlePromoteClick = () => {
    setShowPromoteMenu(true);
    setShowCutMenu(false);
  };

  const handleCutClick = () => {
    setShowCutMenu(true);
    setShowPromoteMenu(false);
  };

  const handleBack = () => {
    setShowPromoteMenu(false);
    setShowCutMenu(false);
    setPromoteShares('');
    setCutShares('');
  };

  const handlePromotePercentageChange = (percentage: number) => {
    setPromotePercentage(percentage);
    setPromoteShares(Math.floor((totalShares * percentage) / 100).toString());
  };

  const handleCutPercentageChange = (percentage: number) => {
    setCutPercentage(percentage);
    setCutShares(Math.floor((totalShares * percentage) / 100).toString());
  };

  const handlePromoteSubmit = async () => {
    const shares = parseInt(promoteShares) || 0;
    if (shares <= 0 || shares > totalShares) {
      toast.error('Please enter a valid number of shares');
      return;
    }

    setLoading(true);
    try {
      const result = await promotePlayers(player.id, shares);
      
      if (result.success) {
        toast.success(`Successfully promoted ${shares} shares of ${player.name}!`);
        onClose();
      } else {
        toast.error(result.message || 'Promotion failed. Please try again.');
      }
    } catch (error) {
      console.error('Error promoting player:', error);
      toast.error('An error occurred during promotion. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCutSubmit = async () => {
    const shares = parseInt(cutShares) || 0;
    if (shares <= 0 || shares > totalShares) {
      toast.error('Please enter a valid number of shares');
      return;
    }

    setLoading(true);
    try {
      const result = await cutPlayers(player.id, shares);
      
      if (result.success) {
        toast.success(`Successfully cut ${shares} shares of ${player.name}!`);
        onClose();
      } else {
        toast.error(result.message || 'Cut failed. Please try again.');
      }
    } catch (error) {
      console.error('Error cutting player:', error);
      toast.error('An error occurred during cut. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canPromote = player.tier !== 'legend';
  const nextPlayerTier = nextTier[player.tier as keyof typeof nextTier];

  // Main menu view
  if (!showPromoteMenu && !showCutMenu) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl text-center">
              {player.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground text-center">
              Choose an action for this player
            </p>
          </DialogHeader>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              onClick={handlePromoteClick}
              disabled={!canPromote}
              className="w-full h-14 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 shadow-lg"
              size="lg"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Promote Player</div>
                  {canPromote && (
                    <div className="text-xs opacity-90">
                      Upgrade to {nextPlayerTier?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </Button>

            <Button
              onClick={handleCutClick}
              className="w-full h-14 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 shadow-lg"
              size="lg"
            >
              <div className="flex items-center gap-3">
                <Scissors className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Cut Player</div>
                  <div className="text-xs opacity-90">Remove shares from team</div>
                </div>
              </div>
            </Button>
          </div>

          {!canPromote && (
            <Alert>
              <Star className="h-4 w-4" />
              <AlertDescription>
                This player is already at the maximum tier (LEGEND) and cannot be promoted further.
              </AlertDescription>
            </Alert>
          )}

          <Separator />
          
          <div className="flex justify-center">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Promote menu view
  if (showPromoteMenu) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              Promote {player.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="promote-shares">Number of Shares</Label>
              <Input
                id="promote-shares"
                type="number"
                value={promoteShares}
                onChange={(e) => setPromoteShares(e.target.value)}
                placeholder="Enter shares to promote"
                max={totalShares}
                min={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Total available: {player.lockedShares || '0'} shares
              </p>
            </div>

            <div>
              <Label>Quick Select Percentage</Label>
              <div className="flex gap-1 mt-2">
                {[25, 50, 75, 100].map((percentage) => (
                  <Button
                    key={percentage}
                    variant={promotePercentage === percentage ? "default" : "outline"}
                    onClick={() => handlePromotePercentageChange(percentage)}
                    className="text-xs px-2 py-0.5 h-6 flex-1 min-w-0"
                  >
                    {percentage}%
                  </Button>
                ))}
              </div>
            </div>

            {loading && (
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  Promoting {promoteShares} shares...
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handlePromoteSubmit}
                disabled={loading || !promoteShares || parseInt(promoteShares) <= 0}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0"
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
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Cut menu view
  if (showCutMenu) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              Cut {player.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="cut-shares">Number of Shares</Label>
              <Input
                id="cut-shares"
                type="number"
                value={cutShares}
                onChange={(e) => setCutShares(e.target.value)}
                placeholder="Enter shares to cut"
                max={totalShares}
                min={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Total available: {player.lockedShares || '0'} shares
              </p>
            </div>

            <div>
              <Label>Quick Select Percentage</Label>
              <div className="flex gap-1 mt-2">
                {[25, 50, 75, 100].map((percentage) => (
                  <Button
                    key={percentage}
                    variant={cutPercentage === percentage ? "default" : "outline"}
                    onClick={() => handleCutPercentageChange(percentage)}
                    className="text-xs px-2 py-0.5 h-6 flex-1 min-w-0"
                  >
                    {percentage}%
                  </Button>
                ))}
              </div>
            </div>

            {loading && (
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  Cutting {cutShares} shares...
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleCutSubmit}
                disabled={loading || !cutShares || parseInt(cutShares) <= 0}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0"
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
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
