import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import { FileText, Clock, TrendingUp, AlertCircle, X, Plus, Minus } from 'lucide-react';
import { formatEther, parseUnits } from 'viem';

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
  image: string;
  gridID?: string;
  teamGridId?: string;
  stats: PlayerStats;
  recentMatches: MatchResult[];
  level: number;
  xp: number;
  potential: number;
  lockedShares?: string;
  ownedShares?: bigint;
  totalValue?: string;
  gamesRemaining?: number;
}

interface ContractExtensionModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
  onExtend?: (player: Player, numberOfGames: number, totalCost: string) => Promise<void>;
}

export default function ContractExtensionModal({
  player,
  isOpen,
  onClose,
  onExtend
}: ContractExtensionModalProps) {
  const [numberOfGames, setNumberOfGames] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (isOpen && player) {
      setNumberOfGames(10);
      setTransactionStatus('idle');
      setStatusMessage('');
    }
  }, [isOpen, player]);

  if (!player) return null;

  // Calculate cost based on owned shares and player price
  // Formula: (playerPrice * numberOfGames * ownedShares) / baseRate
  // Using a base rate of 100 to make it reasonable (adjust as needed)
  const calculateExtensionCost = (games: number): string => {
    const playerPrice = parseFloat(player.price) || 0;
    const shares = Number(player.ownedShares || BigInt(0)) / 1e18; // Convert from wei to tokens
    const baseRate = 100; // Cost is 1% of (price * shares) per game
    
    const cost = (playerPrice * games * shares) / baseRate;
    return cost.toFixed(4);
  };

  const totalCost = calculateExtensionCost(numberOfGames);
  const costPerGame = (parseFloat(totalCost) / numberOfGames).toFixed(4);

  const handleIncrement = () => {
    setNumberOfGames(prev => Math.min(prev + 5, 100)); // Max 100 games
  };

  const handleDecrement = () => {
    setNumberOfGames(prev => Math.max(prev - 5, 5)); // Min 5 games
  };

  const handleInputChange = (value: string) => {
    const num = parseInt(value) || 0;
    setNumberOfGames(Math.max(5, Math.min(100, num)));
  };

  const handleExtend = async () => {
    if (numberOfGames < 5) {
      setTransactionStatus('error');
      setStatusMessage('Minimum 5 games required');
      return;
    }

    setIsLoading(true);
    setTransactionStatus('pending');
    setStatusMessage('Processing contract extension...');

    try {
      if (onExtend) {
        await onExtend(player, numberOfGames, totalCost);
      }
      setTransactionStatus('success');
      setStatusMessage(`Successfully extended contract by ${numberOfGames} games!`);
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Extension failed:', error);
      setTransactionStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Extension failed');
    } finally {
      setIsLoading(false);
    }
  };

  const gamesRemaining = player.gamesRemaining || 0;
  const newTotal = gamesRemaining + numberOfGames;
  const contractStatus = gamesRemaining <= 3 ? 'expiring' : gamesRemaining <= 6 ? 'active' : 'healthy';

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6" />
              <h2 className="text-xl font-bold">Extend Contract</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20 h-8 w-8 p-0 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Player Info */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div 
                className="absolute inset-0 rounded-lg opacity-50"
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
                className="relative w-16 h-16 rounded-lg object-contain shadow-lg"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">{player.name}</h3>
              <p className="text-sm text-white/80">{player.game} • {player.position}</p>
              <Badge variant="secondary" className="mt-1 bg-white/20 text-white border-0">
                {(Number(player.ownedShares || BigInt(0)) / 1e18).toFixed(2)} shares
              </Badge>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Status */}
          <Card className="p-4 border-2 border-dashed">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Current Status</span>
              <Badge 
                variant="secondary"
                className={`${
                  contractStatus === 'expiring' ? 'bg-red-100 text-red-700 border-red-200' :
                  contractStatus === 'active' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                  'bg-green-100 text-green-700 border-green-200'
                }`}
              >
                <Clock className="w-3 h-3 mr-1" />
                {gamesRemaining} games left
              </Badge>
            </div>
            
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  contractStatus === 'expiring' ? 'bg-red-500' :
                  contractStatus === 'active' ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min((gamesRemaining / 10) * 100, 100)}%` }}
              />
            </div>
          </Card>

          {/* Game Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Number of Games to Add</label>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="icon"
                onClick={handleDecrement}
                disabled={numberOfGames <= 5}
                className="h-10 w-10 rounded-full"
              >
                <Minus className="h-4 w-4" />
              </Button>
              
              <Input
                type="number"
                value={numberOfGames}
                onChange={(e) => handleInputChange(e.target.value)}
                className="text-center text-lg font-bold h-12 no-spinner"
                min={5}
                max={100}
              />
              
              <Button
                variant="outline"
                size="icon"
                onClick={handleIncrement}
                disabled={numberOfGames >= 100}
                className="h-10 w-10 rounded-full"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Min: 5 games</span>
              <span>Max: 100 games</span>
            </div>
          </div>

          {/* Cost Breakdown */}
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cost per game</span>
                <span className="font-medium">{costPerGame} USDC</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Number of games</span>
                <span className="font-medium">×{numberOfGames}</span>
              </div>
              <div className="border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total Cost</span>
                  <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {totalCost} USDC
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* New Total */}
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">New Total</span>
            </div>
            <span className="text-lg font-bold text-green-600">
              {newTotal} games
            </span>
          </div>

          {/* Status Alert */}
          {transactionStatus !== 'idle' && (
            <Alert className={`${
              transactionStatus === 'success' ? 'bg-green-50 border-green-200' :
              transactionStatus === 'error' ? 'bg-red-50 border-red-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <AlertCircle className={`h-4 w-4 ${
                transactionStatus === 'success' ? 'text-green-600' :
                transactionStatus === 'error' ? 'text-red-600' :
                'text-blue-600'
              }`} />
              <AlertDescription className="text-sm">
                {statusMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExtend}
              disabled={isLoading || numberOfGames < 5}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              {isLoading ? 'Processing...' : `Extend Contract`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
