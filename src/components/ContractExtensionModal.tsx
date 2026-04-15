import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Clock, TrendingUp, AlertCircle, X, Plus, Minus } from 'lucide-react';
import { Player } from '../types/player';

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
  const [isModalContentVisible, setIsModalContentVisible] = useState(true);

  useEffect(() => {
    if (isOpen && player) {
      setIsModalContentVisible(true);
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
        setIsModalContentVisible(false);
        setTimeout(() => {
          setIsModalContentVisible(true);
          onClose();
        }, 300);
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
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md border-0 shadow-2xl !animate-none origin-center"
        hideCloseButton
        style={{
          opacity: isModalContentVisible ? 1 : 0,
          scale: isModalContentVisible ? '1' : '0.05',
          transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), scale 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="relative">
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsModalContentVisible(false);
              setTimeout(() => {
                setIsModalContentVisible(true);
                onClose();
              }, 300);
            }}
            className="absolute -top-2 -right-2 z-10 h-8 w-8 p-0 rounded-full hover:bg-background/50"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Header */}
          <DialogHeader className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
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
                </div>
                <div>
                  <DialogTitle className="text-2xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                    {player.name}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Extend contract for {player.name}
                  </DialogDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>Contract</span>
                    </Badge>
                    <Badge variant="secondary">{player.game}</Badge>
                    <Badge variant="secondary">
                      {(Number(player.ownedShares || BigInt(0)) / 1e18).toFixed(2)} shares
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="space-y-4 mt-4">
          {/* Current Status */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card className="p-4 border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">Current Status</span>
                <Badge
                  variant={contractStatus === 'expiring' ? 'destructive' : 'secondary'}
                  className={
                    contractStatus === 'active' ? 'text-yellow-600 dark:text-yellow-400' :
                    contractStatus === 'healthy' ? 'text-green-600 dark:text-green-400' :
                    ''
                  }
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {gamesRemaining} games left
                </Badge>
              </div>

              <Progress
                value={Math.min((gamesRemaining / 10) * 100, 100)}
                className={`h-2 ${
                  contractStatus === 'expiring' ? '[&>[data-slot=progress-indicator]]:bg-destructive' :
                  contractStatus === 'active' ? '[&>[data-slot=progress-indicator]]:bg-yellow-500' :
                  '[&>[data-slot=progress-indicator]]:bg-primary'
                }`}
              />
            </Card>
          </motion.div>

          {/* Game Selection */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <label className="text-sm font-medium">Number of Games to Add</label>
            <div className="flex items-center gap-3">
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
          </motion.div>

          {/* Cost Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-4 bg-card border">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost per game</span>
                  <span className="font-medium">{costPerGame} USDC</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Number of games</span>
                  <span className="font-medium">×{numberOfGames}</span>
                </div>
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total Cost</span>
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                      {totalCost} USDC
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* New Total */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between p-4 bg-accent rounded-lg border border-border"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium">New Total</span>
            </div>
            <span className="text-lg font-bold text-green-600 dark:text-green-400">
              {newTotal} games
            </span>
          </motion.div>

          {/* Status Alert */}
          <AnimatePresence>
            {transactionStatus !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Alert className={`${
                  transactionStatus === 'success' ? 'bg-accent border-border' :
                  transactionStatus === 'error' ? 'bg-destructive/10 border-destructive/20' :
                  'bg-primary/10 border-primary/20'
                }`}>
                  <AlertCircle className={`h-4 w-4 ${
                    transactionStatus === 'success' ? 'text-green-600 dark:text-green-400' :
                    transactionStatus === 'error' ? 'text-destructive' :
                    'text-primary'
                  }`} />
                  <AlertDescription className="text-sm">
                    {statusMessage}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex gap-3"
          >
            <Button
              variant="outline"
              onClick={() => {
                setIsModalContentVisible(false);
                setTimeout(() => {
                  setIsModalContentVisible(true);
                  onClose();
                }, 300);
              }}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExtend}
              disabled={isLoading || numberOfGames < 5}
              className="flex-1 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              {isLoading ? 'Processing...' : `Extend Contract`}
            </Button>
          </motion.div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
