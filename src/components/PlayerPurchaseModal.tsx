import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion } from 'motion/react';
import { Star, TrendingUp, TrendingDown, Zap, Shield, Target, Users, Trophy, Info, AlertCircle, ArrowUpDown, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { usePrivy, useSendTransaction, useWallets } from '@privy-io/react-auth';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, custom, encodeFunctionData } from 'viem';
import { getContractData, NETWORK_CONFIG } from '../contracts';
import { usePoolInfo } from '../hooks/usePoolInfo';

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

interface PlayerPurchaseModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
  onPurchase?: (player: Player, usdcAmount: string, action: 'buy' | 'sell', slippage: number) => Promise<void>;
}

export default function PlayerPurchaseModal({ player, isOpen, onClose, onPurchase }: PlayerPurchaseModalProps) {
  const [showBuySellMenu, setShowBuySellMenu] = useState(false);
  const [usdcAmount, setUsdcAmount] = useState('');
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [slippage, setSlippage] = useState(0.5); // default 0.5%
  const [isLoading, setIsLoading] = useState(false);
  const [currencyTokenAddress, setCurrencyTokenAddress] = useState<string>('');
  const fetchedPlayerIds = useRef<Set<number>>(new Set());
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [transactionHash, setTransactionHash] = useState('');
  
  const { user, ready, authenticated } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();
  const { poolData, loading: poolLoading, error: poolError, fetchPoolInfo, calculatePriceImpact } = usePoolInfo();

  // Create clients for contract interactions
  const publicClient = createPublicClient({
    chain: {
      id: NETWORK_CONFIG.chainId,
      name: NETWORK_CONFIG.name,
      rpcUrls: {
        default: { http: [NETWORK_CONFIG.rpcUrl] },
        public: { http: [NETWORK_CONFIG.rpcUrl] },
      },
      blockExplorers: {
        default: { name: 'MonadScan', url: NETWORK_CONFIG.blockExplorer },
      },
      nativeCurrency: {
        name: 'MON',
        symbol: 'MON',
        decimals: 18,
      },
      testnet: true,
    },
    transport: http(NETWORK_CONFIG.rpcUrl),
  });

  // Get currency token address from FDFPair contract
  const getCurrencyTokenAddress = async (): Promise<string> => {
    if (currencyTokenAddress) return currencyTokenAddress;
    
    try {
      const fdfPairContract = getContractData('FDFPair');
      const address = await publicClient.readContract({
        address: fdfPairContract.address as `0x${string}`,
        abi: fdfPairContract.abi,
        functionName: 'currencyToken',
        args: [],
      });
      setCurrencyTokenAddress(address as string);
      return address as string;
    } catch (error) {
      console.error('Error getting currency token address:', error);
      throw error;
    }
  };

  // Approve USDC spending for FDFPair contract
  const approveUSDC = async (amount: bigint): Promise<void> => {
    if (!user?.wallet?.address || !authenticated) {
      throw new Error('Wallet not connected');
    }

    const currencyAddress = await getCurrencyTokenAddress();
    const fdfPairContract = getContractData('FDFPair');

    // Standard ERC20 approve function ABI
    const erc20ApproveAbi = [
      {
        name: 'approve',
        type: 'function',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable'
      }
    ] as const;

    // Encode the approve function call
    const data = encodeFunctionData({
      abi: erc20ApproveAbi,
      functionName: 'approve',
      args: [fdfPairContract.address as `0x${string}`, amount]
    });

    // Prepare transaction for USDC approval
    const transactionRequest = {
      to: currencyAddress as `0x${string}`,
      data: data,
    };

    const options = {
      uiOptions: {
        header: 'Approve USDC Spending',
        description: `Approve ${formatUnits(amount, 6)} USDC for trading`,
        buttonText: 'Approve'
      }
    };

    // Use Privy's sendTransaction hook
    const { hash } = await sendTransaction(transactionRequest, options);
    setTransactionHash(hash);

    // Wait for transaction confirmation
    await publicClient.waitForTransactionReceipt({ hash });
  };

  // Buy tokens using FDFPair contract  
  const buyTokens = async (playerTokenId: number, tokenAmountToBuy: string, maxCurrencySpend: string): Promise<void> => {
    if (!user?.wallet?.address || !authenticated) {
      throw new Error('Wallet not connected');
    }

    const fdfPairContract = getContractData('FDFPair');
    const maxCurrencySpendBigInt = parseUnits(maxCurrencySpend, 6); // USDC has 6 decimals
    const tokenAmountBigInt = parseUnits(tokenAmountToBuy, 18); // Player tokens have 18 decimals

    // Approve USDC spending first
    await approveUSDC(maxCurrencySpendBigInt);

    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour deadline
    const nonce = Date.now(); // Simple nonce

    // Encode the buyTokens function call using the actual ABI
    const data = encodeFunctionData({
      abi: fdfPairContract.abi,
      functionName: 'buyTokens',
      args: [
        [BigInt(playerTokenId)], // _playerTokenIds array
        [tokenAmountBigInt], // _playerTokenAmountsToBuy array
        maxCurrencySpendBigInt, // _maxCurrencySpend
        BigInt(deadline), // _deadline
        user.wallet.address as `0x${string}`, // _recipient
        '0x' as `0x${string}`, // _signature (empty for now)
        BigInt(nonce) // _nonce
      ]
    });

    // Prepare transaction for buying tokens
    const transactionRequest = {
      to: fdfPairContract.address as `0x${string}`,
      data: data,
    };

    const options = {
      uiOptions: {
        header: 'Buy Player Tokens',
        description: `Buy ${tokenAmountToBuy} tokens for ${maxCurrencySpend} USDC`,
        buttonText: 'Buy Tokens'
      }
    };

    // Use Privy's sendTransaction hook
    const { hash } = await sendTransaction(transactionRequest, options);
    setTransactionHash(hash);

    // Wait for transaction confirmation
    await publicClient.waitForTransactionReceipt({ hash });
  };

  // Sell tokens using Player contract
  const sellTokens = async (playerTokenId: number, tokenAmountToSell: string, minCurrencyToReceive: string): Promise<void> => {
    if (!user?.wallet?.address || !authenticated) {
      throw new Error('Wallet not connected');
    }

    const playerContract = getContractData('Player');
    const minCurrencyBigInt = parseUnits(minCurrencyToReceive, 6); // USDC has 6 decimals
    const tokenAmountBigInt = parseUnits(tokenAmountToSell, 18); // Player tokens have 18 decimals

    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour deadline
    const nonce = Date.now(); // Simple nonce

    // Prepare transaction for selling tokens
    const transactionRequest = {
      to: playerContract.address as `0x${string}`,
      // This would need proper ABI encoding - for now using a simplified approach
      data: '0x' as `0x${string}`, // Would need to properly encode the function call
    };

    const options = {
      uiOptions: {
        header: 'Sell Player Tokens',
        description: `Sell ${tokenAmountToSell} tokens for minimum ${minCurrencyToReceive} USDC`,
        buttonText: 'Sell Tokens'
      }
    };

    // Use Privy's sendTransaction hook
    const { hash } = await sendTransaction(transactionRequest, options);
    setTransactionHash(hash);

    // Wait for transaction confirmation
    await publicClient.waitForTransactionReceipt({ hash });
  };

  if (!player) return null;

  const getRatingColor = (rating: number) => {
    if (rating >= 90) return 'from-green-500 to-emerald-600';
    if (rating >= 80) return 'from-blue-500 to-cyan-600';
    if (rating >= 70) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-600';
  };

  const getPositionIcon = (position: string) => {
    switch (position.toLowerCase()) {
      case 'duelist':
      case 'entry fragger':
      case 'carry': return <Target className="w-4 h-4" />;
      case 'controller':
      case 'support': return <Shield className="w-4 h-4" />;
      case 'initiator':
      case 'jungle': return <Zap className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  // Fetch pool information when modal opens
  useEffect(() => {
    if (isOpen && player && !fetchedPlayerIds.current.has(player.id)) {
      console.log('Modal opened, fetching pool info for player:', player.id);
      fetchedPlayerIds.current.add(player.id);
      fetchPoolInfo([player.id]);
      
      // Add timeout to prevent indefinite loading
      const timeout = setTimeout(() => {
        console.warn('Pool info fetch appears to be taking too long');
      }, 3000);

      return () => clearTimeout(timeout);
    }
    
    // Reset when modal closes
    if (!isOpen) {
      fetchedPlayerIds.current.clear();
    }
  }, [isOpen, player]); // Removed fetchPoolInfo from deps since it causes infinite loop

  // Parse player.price (e.g. "1.2 USDC") to number
  const playerPrice = parseFloat(player.price);

  // Calculate expected amount BEFORE slippage
  const usdc = parseFloat(usdcAmount) || 0;
  const expectedReceive = action === 'buy'
    ? usdc / playerPrice
    : usdc * playerPrice;

  // Calculate price impact using real pool data
  const realPriceImpactData = calculatePriceImpact(player.id, usdcAmount, action);
  const priceImpact = realPriceImpactData ? realPriceImpactData.priceImpact.toFixed(2) : '0.00';
  const isPriceImpactHigh = parseFloat(priceImpact) > 5;

  // Debug: Log pool data
  useEffect(() => {
    const poolInfo = poolData.get(player.id);
    console.log('Pool info for player', player.id, ':', poolInfo);
    console.log('Price impact data:', realPriceImpactData);
  }, [poolData, player.id, realPriceImpactData]);

  // Format numbers with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 4,
      minimumFractionDigits: 0,
    }).format(num);
  };

  const handleConfirm = async () => {
    if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
      setTransactionStatus('error');
      setStatusMessage('Please enter a valid amount');
      return;
    }

    if (!authenticated || !user?.wallet?.address) {
      setTransactionStatus('error');
      setStatusMessage('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setTransactionStatus('pending');
    setStatusMessage(`${action === 'buy' ? 'Purchasing' : 'Selling'} ${player.name} tokens...`);
    
    try {
      if (action === 'buy') {
        // Calculate token amount to buy (assuming 1:1 ratio for now, should use actual price calculation)
        const tokenAmount = (parseFloat(usdcAmount) / playerPrice).toString();
        await buyTokens(player.id, tokenAmount, usdcAmount);
      } else {
        // For selling, usdcAmount represents the number of tokens to sell
        const minCurrency = (parseFloat(usdcAmount) * playerPrice * (1 - slippage / 100)).toString();
        await sellTokens(player.id, usdcAmount, minCurrency);
      }
      
      // Call optional callback
      if (onPurchase) {
        await onPurchase(player, usdcAmount, action, slippage);
      }
      
      setTransactionStatus('success');
      setStatusMessage(`Successfully ${action === 'buy' ? 'purchased' : 'sold'} ${player.name} tokens!`);
      
      // Reset form after successful transaction
      setTimeout(() => {
        setShowBuySellMenu(false);
        setUsdcAmount('');
        setAction('buy');
        setSlippage(0.5);
        setTransactionStatus('idle');
        setStatusMessage('');
        setTransactionHash('');
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Transaction failed:', error);
      setTransactionStatus('error');
      setStatusMessage(`Transaction failed: ${(error as any)?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // UI for the swap arrow/button
  const SwapButton = (
    <Button
      type="button"
      variant="ghost"
      className="rounded-full p-2 border border-accent/40 bg-background shadow hover:bg-accent/30 transition"
      onClick={() => setAction(action === 'buy' ? 'sell' : 'buy')}
      aria-label="Switch buy/sell"
    >
      <svg width="24" height="24" fill="none" className="rotate-90 text-muted-foreground">
        <path d="M8 17l4 4 4-4M16 7l-4-4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl border-0 shadow-2xl">
        <DialogHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <ImageWithFallback
                  src={`https://images.unsplash.com/photo-1511512578047-dfb367046420?w=150&h=150&fit=crop&crop=face&random=${player.id}`}
                  alt={player.name}
                  className="w-20 h-20 rounded-xl object-cover shadow-lg"
                />
                <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-r ${getRatingColor(player.rating)} flex items-center justify-center text-white text-sm font-bold`}>
                  {player.rating}
                </div>
              </div>
              <div>
                <DialogTitle className="text-2xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                  {player.name}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Player details and purchase information for {player.name}
                </DialogDescription>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant="outline" className="flex items-center space-x-1">
                    {getPositionIcon(player.position)}
                    <span>{player.position}</span>
                  </Badge>
                  <Badge variant="secondary">{player.game}</Badge>
                  <div className={`flex items-center space-x-1 ${
                    player.trend === 'up' ? 'text-green-500' : 
                    player.trend === 'down' ? 'text-red-500' : 
                    'text-muted-foreground'
                  }`}>
                    {player.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : 
                     player.trend === 'down' ? <TrendingDown className="w-4 h-4" /> : 
                     <span className="w-4 h-4 flex items-center justify-center">→</span>}
                    <span className="text-sm">{player.points} pts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Price and Purchase */}
          <Card className="p-6 bg-gradient-to-r from-accent/30 to-accent/10 border-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Purchase Price</h3>
                <p className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  {player.price}
                </p>
              </div>
              {!showBuySellMenu && (
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setShowBuySellMenu(true);
                      setAction('buy');
                      setTransactionStatus('idle');
                      setStatusMessage('');
                    }}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0 shadow-lg text-lg px-8 py-3 transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95"
                  >
                    Purchase Player
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowBuySellMenu(true);
                      setAction('sell');
                      setTransactionStatus('idle');
                      setStatusMessage('');
                    }}
                    variant="outline"
                    className="text-lg px-8 py-3 transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 hover:border-red-500 hover:text-red-500"
                  >
                    Sell Player
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Buy/Sell Menu */}
          {showBuySellMenu && (
            <Card className="w-full max-w-md mx-auto bg-card/50 backdrop-blur-sm border-accent/20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="p-6 space-y-6"
              >
                {/* Transaction Type Toggle */}
                <div className="flex justify-center space-x-2 mb-4">
                  <Button
                    variant={action === 'buy' ? "default" : "outline"}
                    onClick={() => setAction('buy')}
                    className={`flex-1 ${action === 'buy' ? 'bg-gradient-to-r from-green-600 to-emerald-600' : ''}`}
                  >
                    Buy
                  </Button>
                  <Button
                    variant={action === 'sell' ? "default" : "outline"}
                    onClick={() => setAction('sell')}
                    className={`flex-1 ${action === 'sell' ? 'bg-gradient-to-r from-blue-600 to-purple-600' : ''}`}
                  >
                    Sell
                  </Button>
                </div>

                {/* Input Amount */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">You {action === 'buy' ? 'pay' : 'sell'}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Enter the amount you want to {action === 'buy' ? 'spend' : 'sell'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]*"
                      min="0"
                      value={usdcAmount}
                      onChange={e => setUsdcAmount(e.target.value)}
                      className="w-full text-2xl font-bold pr-24 bg-background/50 border-accent/20 focus:border-accent/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0.00"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                      <span className="text-xl font-bold text-foreground/80">
                        {action === 'buy' ? 'USDC' : player.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Swap Arrow */}
                <div className="relative my-4">
                  <Separator />
                  <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-full p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAction(action === 'buy' ? 'sell' : 'buy')}
                      className="h-8 w-8 rounded-full hover:bg-accent/40"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Output Amount */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">You receive</span>
                  <div className="relative">
                    <Input
                      readOnly
                      value={
                        isNaN(expectedReceive) || !isFinite(expectedReceive)
                          ? '0.00'
                          : formatNumber(expectedReceive)
                      }
                      className="w-full text-2xl font-bold pr-24 bg-background/30 border-accent/20"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                      <span className="text-xl font-bold text-foreground/80">
                        {action === 'buy' ? player.name : 'USDC'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="mt-6 p-4 rounded-lg bg-accent/20 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price Impact</span>
                    <div className="flex items-center gap-1">
                      {poolLoading ? (
                        <span className="text-muted-foreground">Loading contract data...</span>
                      ) : poolError ? (
                        <span className="text-red-500">Contract Error</span>
                      ) : realPriceImpactData ? (
                        <span className={isPriceImpactHigh ? 'text-red-500' : 'text-foreground'}>
                          {priceImpact}%
                        </span>
                      ) : usdcAmount && poolData && poolData.size > 0 ? (
                        <span className="text-yellow-500">No Liquidity</span>
                      ) : (
                        <span className="text-muted-foreground">
                          {usdcAmount ? 'Enter amount' : '0.00%'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Show pool info when available */}
                  {poolData && poolData.size > 0 && poolData.get(player.id) && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Pool Reserves</span>
                      <span>
                        {(() => {
                          const pool = poolData.get(player.id);
                          if (!pool) return 'No data';
                          const usdcReserve = (Number(pool.currencyReserve) / 1e6).toFixed(2);
                          const tokenReserve = (Number(pool.playerTokenReserve) / 1e18).toFixed(2);
                          const currentPrice = pool.currencyReserve > 0n && pool.playerTokenReserve > 0n
                            ? ((Number(pool.currencyReserve) / 1e6) / (Number(pool.playerTokenReserve) / 1e18)).toFixed(4)
                            : '0';
                          return `${usdcReserve} USDC / ${tokenReserve} ${player.name} (${currentPrice} USDC/token)`;
                        })()}
                      </span>
                    </div>
                  )}
                  
                  {/* Show effective price when trade data is available */}
                  {realPriceImpactData && realPriceImpactData.effectivePrice && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Effective Price</span>
                      <span>
                        {realPriceImpactData.effectivePrice.toFixed(6)} USDC per token
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Slippage Tolerance</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Maximum price movement you're willing to accept</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSlippage(0.5)}
                        className={`px-2 py-1 h-auto ${slippage === 0.5 ? 'bg-accent' : ''}`}
                      >
                        0.5%
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSlippage(1)}
                        className={`px-2 py-1 h-auto ${slippage === 1 ? 'bg-accent' : ''}`}
                      >
                        1%
                      </Button>
                      <Input
                        type="number"
                        value={slippage}
                        onChange={e => setSlippage(Number(e.target.value))}
                        className="w-16 h-8 text-sm"
                        min="0.1"
                        max="50"
                        step="0.1"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  </div>
                </div>

                {/* Warning for high price impact */}
                {isPriceImpactHigh && realPriceImpactData && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      High price impact ({priceImpact}%). Price will change from {realPriceImpactData.currentPrice.toFixed(6)} to {realPriceImpactData.newPrice.toFixed(6)} USDC.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowBuySellMenu(false);
                      setUsdcAmount('');
                      setAction('buy');
                      setSlippage(0.5);
                      setTransactionStatus('idle');
                      setStatusMessage('');
                      setTransactionHash('');
                    }}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={!usdcAmount || parseFloat(usdcAmount) <= 0 || isLoading}
                    className={`flex-1 transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 ${
                      action === 'buy'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                    }`}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </div>
                    ) : (
                      `Confirm ${action === 'buy' ? 'Purchase' : 'Sale'}`
                    )}
                  </Button>
                </div>

                {/* Transaction Status Tab */}
                {transactionStatus !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4"
                  >
                    <Alert className={`border ${
                      transactionStatus === 'pending' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                        : transactionStatus === 'success' 
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                        : 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    }`}>
                      <div className="flex items-center gap-2">
                        {transactionStatus === 'pending' && (
                          <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
                        )}
                        {transactionStatus === 'success' && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {transactionStatus === 'error' && (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <AlertDescription className={`font-medium ${
                          transactionStatus === 'pending' 
                            ? 'text-blue-700 dark:text-blue-300' 
                            : transactionStatus === 'success' 
                            ? 'text-green-700 dark:text-green-300' 
                            : 'text-red-700 dark:text-red-300'
                        }`}>
                          {statusMessage}
                        </AlertDescription>
                      </div>
                      
                      {transactionHash && (
                        <div className="mt-2 pt-2 border-t border-current/20">
                          <a 
                            href={`${NETWORK_CONFIG.blockExplorer}/tx/${transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-current/80 hover:text-current transition-colors underline"
                          >
                            View transaction: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                          </a>
                        </div>
                      )}
                      
                      {transactionStatus === 'success' && (
                        <div className="mt-2 pt-2 border-t border-current/20">
                          <p className="text-xs text-current/80">
                            This modal will close automatically in a few seconds.
                          </p>
                        </div>
                      )}
                    </Alert>
                  </motion.div>
                )}
              </motion.div>
            </Card>
          )}

          {/* Stats and Additional Info (only show when not in buy/sell menu) */}
          {!showBuySellMenu && (
            <div className="grid grid-cols-2 gap-4">
              {/* Player Stats */}
              <Card className="p-4 border-0 shadow-lg">
                <h3 className="mb-3 flex items-center text-sm">
                  <Trophy className="w-4 h-4 mr-2 text-yellow-500" />
                  Player Statistics
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-accent/50 rounded-lg">
                    <p className="text-lg font-bold text-primary">{player.stats.kills}</p>
                    <p className="text-xs text-muted-foreground">Avg Kills</p>
                  </div>
                  <div className="text-center p-2 bg-accent/50 rounded-lg">
                    <p className="text-lg font-bold text-primary">{player.stats.deaths}</p>
                    <p className="text-xs text-muted-foreground">Avg Deaths</p>
                  </div>
                  <div className="text-center p-2 bg-accent/50 rounded-lg">
                    <p className="text-lg font-bold text-primary">{player.stats.assists}</p>
                    <p className="text-xs text-muted-foreground">Avg Assists</p>
                  </div>
                  <div className="text-center p-2 bg-accent/50 rounded-lg">
                    <p className="text-lg font-bold text-primary">{player.stats.winRate}%</p>
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                  </div>
                </div>
                
                <div className="mt-3">
                  <h4 className="text-xs font-medium mb-1">Performance Rating</h4>
                  <div className="w-full bg-accent rounded-full h-2">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${player.rating}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-2 rounded-full bg-gradient-to-r ${getRatingColor(player.rating)}`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {player.rating}/100 Overall Rating
                  </p>
                </div>
              </Card>

              {/* Recent Matches */}
              <Card className="p-4 border-0 shadow-lg">
                <h3 className="mb-3 flex items-center text-sm">
                  <Star className="w-4 h-4 mr-2 text-blue-500" />
                  Recent Matches
                </h3>
                <div className="space-y-2">
                  {player.recentMatches.map((match, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-accent/30 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          match.result === 'win' ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <div>
                          <p className="text-xs font-medium">vs {match.opponent}</p>
                          <p className="text-[10px] text-muted-foreground">{match.score}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={match.result === 'win' ? 'default' : 'secondary'} className="text-xs px-1 py-0">
                          {match.result.toUpperCase()}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {match.performance} pts
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}