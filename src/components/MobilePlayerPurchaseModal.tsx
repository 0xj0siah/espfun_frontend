import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion, AnimatePresence } from 'motion/react';
import { Star, TrendingUp, TrendingDown, Zap, Shield, Target, Users, Trophy, Info, AlertCircle, ArrowUpDown, CheckCircle, XCircle, Clock, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { usePrivy, useSendTransaction, useWallets, useSignTypedData } from '@privy-io/react-auth';
import { useWalletTransactions } from '../hooks/useWalletTransactions';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, custom, encodeFunctionData } from 'viem';
import { getContractData, NETWORK_CONFIG } from '../contracts';
import { usePoolInfo } from '../hooks/usePoolInfo';
import { useAuthentication } from '../hooks/useAuthentication';
import { createEIP712Domain, createBuyTokensTypedData, validateSignatureParams, createPlayerEIP712Domain, createSellTokensTypedData, validateSellSignatureParams } from '../utils/signatures';
import { apiService, SellTokensRequest } from '../services/apiService';
import { AuthenticationStatus } from './AuthenticationStatus';
import { GridDetailedPlayerStats, SeriesState, MatchResult } from '../utils/api';
import { useGridCache } from '../hooks/useGridCache';
import { readContractCached } from '../utils/contractCache';
import { useTradingPhase } from '../hooks/useTradingPhase';
import { useTradeQuote } from '../hooks/useTradeQuote';
import { usePlayerTokenBalance } from '../hooks/usePlayerTokenBalance';
import { useBondingCurveTrade } from '../hooks/useBondingCurveTrade';
import { usePublicClient } from '../hooks/usePublicClient';
import { TradingPhase, FeeType, feeTypeLabel, feeTypeBadgeColor, EMPTY_QUOTE } from '../types/trading';
import { Progress } from './ui/progress';

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
  gridID?: string;
  teamGridId?: string;
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

interface MobilePlayerPurchaseModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
  onPurchase?: (player: Player, usdcAmount: string, action: 'buy' | 'sell', slippage: number) => Promise<void>;
}

export default function MobilePlayerPurchaseModal({ player, isOpen, onClose, onPurchase }: MobilePlayerPurchaseModalProps) {
  const [isModalContentVisible, setIsModalContentVisible] = useState(true);
  const [showBuySellMenu, setShowBuySellMenu] = useState(false);
  const [usdcAmount, setUsdcAmount] = useState('');
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [slippage, setSlippage] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [currencyTokenAddress, setCurrencyTokenAddress] = useState<string>('');
  const fetchedPlayerIds = useRef<Set<number>>(new Set());
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [transactionHash, setTransactionHash] = useState('');
  const [userUsdcBalance, setUserUsdcBalance] = useState<string>('0');
  const [showAlert, setShowAlert] = useState(false);
  const previousStatusRef = useRef<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [gridStats, setGridStats] = useState<GridDetailedPlayerStats | null>(null);
  const [gridStatsLoading, setGridStatsLoading] = useState(false);
  const [seriesData, setSeriesData] = useState<SeriesState[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [notificationDismissed, setNotificationDismissed] = useState(false);

  const { user } = usePrivy();
  const { poolData, loading: poolLoading, error: poolError, fetchPoolInfo, calculatePriceImpact } = usePoolInfo();
  const { sendTransactionWithWallet } = useWalletTransactions();
  const { isAuthenticated, isAuthenticating, authenticate, error: authError, walletConnected } = useAuthentication();
  const { signTypedData } = useSignTypedData();
  const { loadPlayerData } = useGridCache();

  // Memoized public client
  const publicClient = usePublicClient();

  // Phase detection: bonding curve vs FDFPair
  const {
    phase: tradingPhase,
    launch: launchInfo,
    progress: launchProgress,
    userCurveBalance,
    refresh: refreshPhase,
  } = useTradingPhase(player?.id ?? null, user?.wallet?.address);

  // Phase-aware trade quote (debounced)
  const quote = useTradeQuote({
    playerId: player?.id ?? null,
    action,
    inputAmount: usdcAmount,
    phase: tradingPhase,
  });

  // Phase-aware player token balance
  const {
    balance: playerTokenBalance,
    formattedBalance: playerTokenBalanceFormatted,
    refresh: refreshTokenBalance,
  } = usePlayerTokenBalance({
    playerId: player?.id ?? null,
    walletAddress: user?.wallet?.address,
    phase: tradingPhase,
  });

  // Bonding curve trade execution
  const bondingCurveTrade = useBondingCurveTrade();

  const updateAlertState = (status: 'idle' | 'pending' | 'success' | 'error', message: string = '', hash: string = '') => {
    setTransactionStatus(status);
    previousStatusRef.current = status;
    setStatusMessage(message);
    setTransactionHash(hash);
    setShowAlert(status !== 'idle');
    setNotificationDismissed(false);
  };

  const getCurrencyTokenAddress = async (): Promise<string> => {
    if (currencyTokenAddress) return currencyTokenAddress;
    try {
      const fdfPairContract = getContractData('FDFPair');
      try {
        const address = await readContractCached({
          address: fdfPairContract.address as `0x${string}`,
          abi: fdfPairContract.abi as any,
          functionName: 'currencyToken',
          args: [],
        });
        setCurrencyTokenAddress(address as string);
        return address as string;
      } catch {
        const address = await readContractCached({
          address: fdfPairContract.address as `0x${string}`,
          abi: fdfPairContract.abi as any,
          functionName: 'getCurrencyInfo',
          args: [],
        });
        setCurrencyTokenAddress(address as string);
        return address as string;
      }
    } catch (error) {
      const tusdcContract = getContractData('TUSDC');
      setCurrencyTokenAddress(tusdcContract.address);
      return tusdcContract.address;
    }
  };

  const getCurrentNonce = async (userAddress: string): Promise<number> => {
    try {
      const fdfPairContract = getContractData('FDFPair');
      
      console.log('🔍 Fetching buy nonce from contract for:', userAddress);
      
      // Try getCurrentNonce function (preferred method)
      try {
        const currentNonce = await readContractCached({
          address: fdfPairContract.address as `0x${string}`,
          abi: fdfPairContract.abi as any,
          functionName: 'getCurrentNonce',
          args: [userAddress],
        });
        const nextNonce = Number(currentNonce);
        console.log('✅ getCurrentNonce() returned:', nextNonce, '(this is the next nonce to use)');
        return nextNonce;
      } catch (getCurrentNonceError) {
        console.warn('⚠️ getCurrentNonce() not available, trying usedNonces...');
        
        // Fallback to usedNonces + 1
        const usedNonce = await readContractCached({
          address: fdfPairContract.address as `0x${string}`,
          abi: fdfPairContract.abi as any,
          functionName: 'usedNonces',
          args: [userAddress],
        });
        
        const nextNonce = Number(usedNonce) + 1;
        console.log('✅ usedNonces returned:', Number(usedNonce), '-> Using nextNonce:', nextNonce);
        return nextNonce;
      }
    } catch (error) {
      console.error('❌ Error getting current nonce:', error);
      console.log('🔄 Using fallback nonce: 1');
      return 1;
    }
  };

  const getCurrentSellNonce = async (userAddress: string): Promise<number> => {
    try {
      const playerContract = getContractData('Player');
      
      // Player contract uses getCurrentNonce function
      const currentNonce = await readContractCached({
        address: playerContract.address as `0x${string}`,
        abi: playerContract.abi as any,
        functionName: 'getCurrentNonce',
        args: [userAddress],
      });
      
      const nextNonce = Number(currentNonce) + 1; // Next nonce to use
      console.log('✅ Current sell nonce for', userAddress, ':', Number(currentNonce), '-> Using:', nextNonce);
      return nextNonce;
    } catch (error) {
      console.error('Error getting current sell nonce:', error);
      // More conservative fallback - start from 1 if we can't get the nonce
      console.log('🔄 Using fallback sell nonce: 1');
      return 1;
    }
  };

  const checkUserUsdcBalance = async (): Promise<void> => {
    if (!user?.wallet?.address) return;
    try {
      const tusdcContract = getContractData('TUSDC');
      const balance = await readContractCached({
        address: tusdcContract.address as `0x${string}`,
        abi: tusdcContract.abi as any,
        functionName: 'balanceOf',
        args: [user.wallet.address as `0x${string}`],
      });
      setUserUsdcBalance(formatUnits(balance as bigint, 6));
    } catch {
      setUserUsdcBalance('0');
    }
  };

  const approveUSDC = async (amount: bigint): Promise<void> => {
    if (!user?.wallet?.address || !isAuthenticated) throw new Error('Wallet not connected');
    const currencyAddress = await getCurrencyTokenAddress();
    const fdfPairContract = getContractData('FDFPair');

    const erc20ApproveAbi = [{
      name: 'approve',
      type: 'function',
      inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'nonpayable'
    }] as const;

    const data = encodeFunctionData({
      abi: erc20ApproveAbi,
      functionName: 'approve',
      args: [fdfPairContract.address as `0x${string}`, amount]
    });

    updateAlertState('pending', '⏳ Approving USDC...', '');
    const result = await sendTransactionWithWallet({ to: currencyAddress as `0x${string}`, data });
    await publicClient.waitForTransactionReceipt({ hash: result.hash });
    updateAlertState('pending', '✅ Approved! Confirming purchase...', result.hash);
    await new Promise(resolve => setTimeout(resolve, 1500));
  };

  const buyTokens = async (playerTokenId: number, tokenAmountToBuy: string, maxCurrencySpend: string): Promise<void> => {
    if (!user?.wallet?.address || !isAuthenticated) throw new Error('Wallet not connected');
    const fdfPairContract = getContractData('FDFPair');
    const maxCurrencySpendBigInt = parseUnits(maxCurrencySpend, 6);
    const tokenAmountBigInt = parseUnits(tokenAmountToBuy, 18);

    console.log('🔄 Starting buyTokens transaction...');
    console.log('🎯 Buy Tokens Parameters:');
    console.log('- Player IDs:', [playerTokenId]);
    console.log('- Amounts (tokens):', [tokenAmountToBuy]);
    console.log('- Amounts (wei):', [tokenAmountBigInt.toString()]);
    console.log('- Max spend (USDC):', maxCurrencySpend);
    console.log('- Max spend (wei):', maxCurrencySpendBigInt.toString());

    // Validate minimum amounts
    if (maxCurrencySpendBigInt <= 0n) {
      throw new Error('Currency spend amount must be greater than 0');
    }
    if (tokenAmountBigInt <= 0n) {
      throw new Error('Token amount must be greater than 0');
    }

    // Check if player token pool exists
    try {
      const poolInfo = await readContractCached({
        address: fdfPairContract.address as `0x${string}`,
        abi: fdfPairContract.abi as any,
        functionName: 'getPoolInfo',
        args: [[BigInt(playerTokenId)]],
      });
      
      const [currencyReserves, playerTokenReserves] = poolInfo as [bigint[], bigint[]];
      console.log('Pool reserves:', {
        currency: currencyReserves[0]?.toString(),
        playerToken: playerTokenReserves[0]?.toString()
      });
      
      if (!currencyReserves[0] || currencyReserves[0] === 0n) {
        throw new Error(`No liquidity pool found for player ${playerTokenId}`);
      }
    } catch (poolError) {
      console.error('Pool validation error:', poolError);
      throw new Error(`Player ${playerTokenId} is not available for trading`);
    }

    // First approve USDC spending
    console.log('💰 Approving USDC spending...');
    updateAlertState('pending', '💰 Step 1/2: Approving USDC spending...', '');
    await approveUSDC(maxCurrencySpendBigInt);
    
    // After approval, update status for the buy transaction
    updateAlertState('pending', '🛒 Step 2/2: Preparing purchase transaction...', '');

    const deadline = Math.floor(Date.now() / 1000) + 300;
    console.log('⏰ Transaction deadline:', new Date(deadline * 1000).toLocaleString());
    
    // Try backend signature generation first, fallback to local if unavailable
    let signature: string;
    let nonce: number;
    let transactionId: string | null = null;

    try {
      // Check if we have authentication for backend API
      const hasAuthToken = localStorage.getItem('authToken');
      if (!hasAuthToken) {
        throw new Error('No authentication token found - backend signatures require authentication');
      }

      console.log('🌐 Attempting backend signature generation...');
      
      // Prepare request data for backend signature generation
      const signatureRequest = {
        playerTokenIds: [playerTokenId.toString()], // Convert to string array
        amounts: [tokenAmountBigInt.toString()], // BigInt as string
        maxCurrencySpend: maxCurrencySpendBigInt.toString(), // BigInt as string
        deadline
      };

      console.log('📝 Requesting EIP712 signature from backend API:', signatureRequest);

      // Get signature from backend API
      const signatureResponse = await apiService.prepareSignature(signatureRequest);
      
      console.log('✅ Backend signature response received:', {
        transactionId: signatureResponse.transactionId,
        signatureLength: signatureResponse.signature.length,
        nonce: signatureResponse.txData.nonce
      });

      // Extract signature and transaction data from backend response
      signature = signatureResponse.signature;
      nonce = signatureResponse.txData.nonce;
      transactionId = signatureResponse.transactionId;
      
      if (!signature || !signature.startsWith('0x')) {
        throw new Error(`Invalid signature format from backend: ${signature}`);
      }
      
      console.log('✅ Using backend-generated EIP712 signature:', signature.slice(0, 10) + '...');

    } catch (backendError) {
      console.warn('⚠️ Backend signature generation failed, falling back to local generation:', backendError);

      // If error mentions authentication, inform user
      if (backendError instanceof Error && (backendError.message.includes('Authentication') || backendError.message.includes('token'))) {
        console.log('🔐 Authentication issue detected - user may need to re-authenticate for backend features');
      }

      // Fallback to local signature generation
      console.log('� Falling back to local EIP712 signature generation...');

      // Get current nonce for signature (CRITICAL for transaction ordering)
      nonce = await getCurrentNonce(user.wallet.address);
      console.log('🔢 Current nonce (local):', nonce);
      
      // Verify nonce one more time to ensure it hasn't changed
      try {
        const verifyNonce = await getCurrentNonce(user.wallet.address);
        if (verifyNonce !== nonce) {
          console.warn('⚠️ WARNING: Nonce changed between calls!', nonce, '->', verifyNonce);
        } else {
          console.log('✅ Nonce verified, using:', nonce);
        }
      } catch (err) {
        console.warn('⚠️ Could not verify nonce:', err);
      }

      // Prepare signature data for local generation
      const signatureData = {
        buyer: user.wallet.address,
        playerTokenIds: [playerTokenId], // Array with actual number
        amounts: [tokenAmountBigInt.toString()], // Array with BigInt string
        maxCurrencySpend: maxCurrencySpendBigInt.toString(), // BigInt string, not decimal
        deadline,
        nonce
      };

      console.log('📝 Preparing local EIP712 signature with data:', signatureData);

      // Validate all values are safe for JSON serialization
      const testData = {
        playerTokenIds: signatureData.playerTokenIds,
        amounts: signatureData.amounts,
        maxCurrencySpend: signatureData.maxCurrencySpend,
        deadline: signatureData.deadline,
        nonce: signatureData.nonce
      };
      
      try {
        JSON.stringify(testData);
        console.log('✅ Pre-signature data serialization test passed');
      } catch (preSerializationError) {
        console.error('❌ Pre-signature data serialization failed:', preSerializationError);
        throw new Error(`Invalid data types before signature: ${preSerializationError instanceof Error ? preSerializationError.message : 'Unknown serialization error'}`);
      }

      // Generate EIP-712 signature using Privy's useSignTypedData hook
      const domain = createEIP712Domain(fdfPairContract.address);
      const typedData = createBuyTokensTypedData(domain, signatureData);
      
      // Validate signature parameters
      validateSignatureParams(signatureData);

      console.log('🔐 Creating local EIP712 signature... (requires txSigner wallet)');
      
      // Test JSON serialization before passing to Privy
      try {
        const testSerialization = JSON.stringify(typedData);
        console.log('✅ JSON serialization test passed, data length:', testSerialization.length);
      } catch (serializationError) {
        console.error('❌ JSON serialization failed:', serializationError);
        throw new Error(`Cannot serialize typed data for signing: ${serializationError instanceof Error ? serializationError.message : 'Unknown serialization error'}`);
      }

      // Use Privy's signTypedData hook
      console.log('🔏 Requesting signature...');
      const signResult = await signTypedData(typedData, {
        uiOptions: { title: 'Sign Transaction', description: 'Sign to complete your purchase', buttonText: 'Sign' }
      });

      // Extract signature from result (handles various response formats)
      if (typeof signResult === 'string') {
        signature = signResult;
      } else if (signResult && typeof signResult === 'object') {
        signature = (signResult as any).signature || (signResult as any).sig || (signResult as any).data || signResult.toString();
      } else {
        throw new Error('Invalid signature response');
      }
      
      if (!signature || !signature.startsWith('0x')) {
        throw new Error(`Invalid signature format: ${signature}`);
      }
      
      console.log('✅ Local EIP712 signature generated:', signature.slice(0, 10) + '...');
    }
    
    console.log('✅ Signature received:', signature.substring(0, 10) + '...');

    // Encode function call
    console.log('🔧 Encoding buyTokens function call...');
    console.log('📋 Transaction parameters:');
    console.log('  - playerTokenIds:', [playerTokenId]);
    console.log('  - amounts (BigInt):', tokenAmountBigInt.toString());
    console.log('  - maxCurrencySpend (BigInt):', maxCurrencySpendBigInt.toString());
    console.log('  - deadline:', deadline);
    console.log('  - recipient:', user.wallet.address);
    console.log('  - signature:', signature.substring(0, 20) + '...');
    console.log('  - nonce:', nonce);
    
    const data = encodeFunctionData({
      abi: fdfPairContract.abi,
      functionName: 'buyTokens',
      args: [
        [BigInt(playerTokenId)],
        [tokenAmountBigInt],
        maxCurrencySpendBigInt,
        BigInt(deadline),
        user.wallet.address as `0x${string}`,
        signature as `0x${string}`,
        BigInt(nonce)
      ]
    });

    console.log('✅ Encoded transaction data (first 100 chars):', data.substring(0, 100) + '...');
    console.log('📤 Sending buyTokens transaction to contract:', fdfPairContract.address);
    
    updateAlertState('pending', '🛒 Confirming purchase...', '');
    const result = await sendTransactionWithWallet({ to: fdfPairContract.address as `0x${string}`, data });
    const hash = result.hash;
    
    console.log('⏳ Transaction sent, hash:', hash);
    updateAlertState('pending', '⏳ Waiting for confirmation...', hash);
    
    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    console.log('✅ Transaction confirmed!');
    console.log('- Transaction Hash:', receipt.transactionHash);
    console.log('- Block Number:', receipt.blockNumber);
    console.log('- Gas Used:', receipt.gasUsed.toString());

    // Confirm transaction with backend if we used backend signature generation
    if (transactionId) {
      try {
        console.log('📤 Confirming transaction with backend...');
        await apiService.confirmTransaction(transactionId, hash);
        console.log('✅ Transaction confirmed with backend');
      } catch (confirmError) {
        console.error('⚠️ Failed to confirm transaction with backend:', confirmError);
        // Don't throw error here as the transaction itself was successful
      }
    } else {
      console.log('ℹ️ Using local signature generation, skipping backend confirmation');
    }
    
    updateAlertState('success', '✅ Purchase successful!', hash);
    await checkUserUsdcBalance();
  };

  const sellTokens = async (playerTokenId: number, tokenAmountToSell: string, minCurrencyToReceive: string): Promise<void> => {
    if (!user?.wallet?.address || !isAuthenticated) throw new Error('Wallet not connected');
    const playerContract = getContractData('Player');
    const minCurrencyBigInt = parseUnits(minCurrencyToReceive, 6);
    const tokenAmountBigInt = parseUnits(tokenAmountToSell, 18);

    const deadline = Math.floor(Date.now() / 1000) + 300;
    const nonce = await getCurrentSellNonce(user.wallet.address);

    const signatureData = {
      seller: user.wallet.address,
      playerTokenIds: [playerTokenId],
      amounts: [tokenAmountBigInt.toString()],
      minCurrencyToReceive: minCurrencyBigInt.toString(),
      deadline,
      nonce
    };

    const domain = createPlayerEIP712Domain(playerContract.address);
    const typedData = createSellTokensTypedData(domain, signatureData);
    validateSellSignatureParams(signatureData);

    const signResult = await signTypedData(typedData, {
      uiOptions: { title: 'Sign Sale', description: 'Sign to complete your sale', buttonText: 'Sign' }
    });

    let signature: string;
    if (typeof signResult === 'string') {
      signature = signResult;
    } else if (signResult && typeof signResult === 'object') {
      signature = (signResult as any).signature || (signResult as any).sig || (signResult as any).data || signResult.toString();
    } else {
      throw new Error('Invalid signature response');
    }

    const data = encodeFunctionData({
      abi: playerContract.abi,
      functionName: 'sellTokens',
      args: [
        [BigInt(playerTokenId)],
        [tokenAmountBigInt],
        minCurrencyBigInt,
        BigInt(deadline),
        signature as `0x${string}`,
        BigInt(nonce)
      ]
    });

    updateAlertState('pending', '💰 Confirming sale...', '');
    const result = await sendTransactionWithWallet({ to: playerContract.address as `0x${string}`, data });
    updateAlertState('pending', '⏳ Waiting for confirmation...', result.hash);
    await publicClient.waitForTransactionReceipt({ hash: result.hash });
    updateAlertState('success', '✅ Sale successful!', result.hash);
    await checkUserUsdcBalance();
  };

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
      case 'carry':
      case 'rifler':
      case 'awper':
      case 'mid':
      case 'adc': return <Target className="w-3 h-3" />;
      case 'controller':
      case 'support':
      case 'top': return <Shield className="w-3 h-3" />;
      case 'initiator':
      case 'jungle': return <Zap className="w-3 h-3" />;
      default: return <Users className="w-3 h-3" />;
    }
  };

  if (!player) return null;

  useEffect(() => {
    if (isOpen && player) {
      setIsModalContentVisible(true);
      setUsdcAmount('');
      setAction('buy');
      setSlippage(0.5);
      setShowBuySellMenu(false);
      setShowStats(false);
      setShowMatches(false);
      updateAlertState('idle');
      
      if (!fetchedPlayerIds.current.has(player.id)) {
        fetchedPlayerIds.current.add(player.id);
        fetchPoolInfo([player.id]);
      }

      if (isAuthenticated && user?.wallet?.address) {
        checkUserUsdcBalance();
      }
    }
    
    if (!isOpen) {
      fetchedPlayerIds.current.clear();
    }
  }, [isOpen, player, isAuthenticated, user?.wallet?.address]);

  useEffect(() => {
    const autoAuthenticate = async () => {
      if (!isAuthenticated && walletConnected && !isAuthenticating) {
        try {
          await authenticate();
        } catch (error) {
          console.error('Failed to auto-authenticate:', error);
        }
      }
    };
    autoAuthenticate();
  }, [isAuthenticated, walletConnected, isAuthenticating, authenticate]);

  useEffect(() => {
    const fetchAllGridData = async () => {
      if (isOpen && player && player.gridID && player.teamGridId) {
        setGridStatsLoading(true);
        setSeriesLoading(true);
        try {
          const { stats, seriesStates } = await loadPlayerData(player.gridID, player.teamGridId);
          if (stats) setGridStats(stats);
          if (seriesStates.length > 0) setSeriesData(seriesStates);
        } catch (error) {
          console.error('Error loading Grid.gg data:', error);
        } finally {
          setGridStatsLoading(false);
          setSeriesLoading(false);
        }
      }
    };
    fetchAllGridData();
  }, [isOpen, player?.gridID, player?.teamGridId, loadPlayerData]);

  const formatPriceDisplay = (price: number): string => {
    if (price === 0) return '0.00000';
    const beforeDecimal = Math.floor(Math.log10(Math.abs(price))) + 1;
    if (beforeDecimal >= 5) return price.toFixed(0);
    if (beforeDecimal > 0) return price.toFixed(Math.max(0, 5 - beforeDecimal));
    const leadingZeros = Math.floor(-Math.log10(Math.abs(price)));
    return price.toFixed(leadingZeros + 4);
  };

  const getRealPrice = () => {
    const poolInfo = poolData.get(player.id);
    if (poolInfo && poolInfo.currencyReserve > 0n && poolInfo.playerTokenReserve > 0n) {
      const usdcReserve = Number(poolInfo.currencyReserve) / 1e6;
      const tokenReserve = Number(poolInfo.playerTokenReserve) / 1e18;
      return usdcReserve / tokenReserve;
    }
    return parseFloat(player.price);
  };

  const currentPrice = getRealPrice();
  const usdc = parseFloat(usdcAmount) || 0;
  const expectedReceive = quote.amountToReceive > 0n
    ? parseFloat(formatUnits(quote.amountToReceive, action === 'buy' ? 18 : 6))
    : action === 'buy'
      ? usdc / currentPrice
      : usdc * currentPrice;
  const realPriceImpactData = calculatePriceImpact(player.id, usdcAmount, action);
  const priceImpact = realPriceImpactData ? realPriceImpactData.priceImpact.toFixed(2) : '0.00';
  const isPriceImpactHigh = parseFloat(priceImpact) > 5;

  // Format numbers with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 4,
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getRealRecentMatches = (): MatchResult[] => {
    if (!player || seriesData.length === 0) return [];
    const matches: MatchResult[] = [];
    for (const series of seriesData.slice(0, 3)) {
      const playerTeam = series.teams.find((team: any) => team.id === player.teamGridId);
      const opponentTeam = series.teams.find((team: any) => team.id !== player.teamGridId);
      if (!playerTeam || !opponentTeam) continue;
      matches.push({
        opponent: opponentTeam.name,
        result: playerTeam.won ? 'win' : 'loss',
        score: `${playerTeam.score}-${opponentTeam.score}`,
        performance: playerTeam.won ? Math.floor(Math.random() * 20) + 80 : Math.floor(Math.random() * 30) + 50
      });
    }
    return matches.slice(0, 3);
  };

  const handleConfirm = async () => {
    if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
      updateAlertState('error', 'Please enter a valid amount');
      return;
    }
    if (!isAuthenticated || !user?.wallet?.address) {
      updateAlertState('error', 'Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    updateAlertState('pending', `${action === 'buy' ? 'Purchasing' : 'Selling'} ${player.name} tokens...`);
    
    try {
      if (tradingPhase === TradingPhase.BondingCurve) {
        // ═══ BONDING CURVE TRADING (no signatures needed) ═══
        if (action === 'buy') {
          const tokenAmount = quote.amountToReceive > 0n
            ? formatUnits(quote.amountToReceive, 18)
            : (parseFloat(usdcAmount) / currentPrice).toString();
          const maxSpend = (parseFloat(usdcAmount) * (1 + slippage / 100)).toString();

          await bondingCurveTrade.buy({
            playerId: player.id,
            tokenAmount,
            maxCurrencySpend: maxSpend,
          });
        } else {
          const minReceive = quote.amountToReceive > 0n
            ? formatUnits(
                quote.amountToReceive * BigInt(10000 - Math.floor(slippage * 100)) / 10000n,
                6
              )
            : (parseFloat(usdcAmount) * currentPrice * (1 - slippage / 100)).toString();

          await bondingCurveTrade.sell({
            playerId: player.id,
            tokenAmount: usdcAmount,
            minCurrencyToReceive: minReceive,
          });
        }

        refreshPhase();
        refreshTokenBalance();
        await checkUserUsdcBalance();
        updateAlertState('success', `Successfully ${action === 'buy' ? 'bought' : 'sold'} tokens!`, bondingCurveTrade.transactionHash);

      } else {
        // ═══ FDFPAIR TRADING (existing flow with signatures) ═══
        if (action === 'buy') {
          const tokenAmount = quote.amountToReceive > 0n
            ? formatUnits(quote.amountToReceive, 18)
            : (parseFloat(usdcAmount) / currentPrice).toString();
          const maxCurrencyWithSlippage = (parseFloat(usdcAmount) * (1 + slippage / 100)).toString();

          const userBalance = parseFloat(userUsdcBalance);
          const maxSpendAmount = parseFloat(maxCurrencyWithSlippage);
          if (userBalance < maxSpendAmount) {
            updateAlertState('error', `Insufficient USDC. You have ${userBalance.toFixed(2)} but may need ${maxSpendAmount.toFixed(2)} with ${slippage}% slippage`);
            setIsLoading(false);
            return;
          }

          await buyTokens(player.id, tokenAmount, maxCurrencyWithSlippage);
        } else {
          const minCurrency = quote.amountToReceive > 0n
            ? formatUnits(
                quote.amountToReceive * BigInt(10000 - Math.floor(slippage * 100)) / 10000n,
                6
              )
            : (parseFloat(usdcAmount) * currentPrice * (1 - slippage / 100)).toString();

          await sellTokens(player.id, usdcAmount, minCurrency);
        }
      }

      // Call optional callback
      if (onPurchase) {
        await onPurchase(player, usdcAmount, action, slippage);
      }
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction cancelled';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient balance';
        } else {
          errorMessage = error.message;
        }
      }
      updateAlertState('error', `Failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="!max-w-none !w-screen !h-screen !top-0 !left-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 !rounded-none !p-0 !m-0 !inset-0 !flex !flex-col !gap-0 border-0 shadow-2xl !animate-none origin-center"
        hideCloseButton
        style={{
          opacity: isModalContentVisible ? 1 : 0,
          scale: isModalContentVisible ? '1' : '0.05',
          transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), scale 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Fixed Header */}
        <div className="bg-gradient-to-r from-accent/30 to-accent/10 border-b p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
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
                  className="relative w-12 h-12 rounded-lg object-contain shadow-md"
                />
                <div className={`absolute -top-1 -right-1 w-5 h-5 text-[9px] rounded-full bg-gradient-to-r ${getRatingColor(player.rating)} flex items-center justify-center text-white font-bold`}>
                  {player.rating}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold truncate">{player.name}</h3>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex items-center space-x-0.5">
                    {getPositionIcon(player.position)}
                    <span>{player.position}</span>
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{player.game}</Badge>
                  <div className={`flex items-center space-x-0.5 text-[10px] ${
                    player.trend === 'up' ? 'text-green-500' : player.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                  }`}>
                    {player.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : player.trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <span>→</span>}
                    <span>{player.points} pts</span>
                  </div>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => {
              setIsModalContentVisible(false);
              setTimeout(() => {
                setIsModalContentVisible(true);
                onClose();
              }, 300);
            }} className="h-8 w-8 p-0 rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Current Price</p>
            <p className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              {formatPriceDisplay(currentPrice)} USDC
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          {/* Authentication Status */}
          {!walletConnected && (
            <Alert className="mb-3 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">Connect your wallet to purchase</AlertDescription>
            </Alert>
          )}

          {walletConnected && !isAuthenticated && (
            <Alert className="mb-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{isAuthenticating ? 'Authenticating...' : 'Authentication required'}</AlertDescription>
            </Alert>
          )}

          {isAuthenticated && (
            <div className="mb-3">
              <AuthenticationStatus />
            </div>
          )}

          {/* Transaction Alert */}
          {showAlert && transactionStatus !== 'idle' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
              <Alert className={`${transactionStatus === 'success' ? 'bg-green-50 border-green-200' : transactionStatus === 'error' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                {transactionStatus === 'success' ? <CheckCircle className="h-4 w-4 text-green-600" /> : 
                 transactionStatus === 'error' ? <XCircle className="h-4 w-4 text-red-600" /> : 
                 <Clock className="h-4 w-4 text-blue-600 animate-spin" />}
                <AlertDescription className="text-xs">{statusMessage}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {/* Bonding Curve Progress Bar */}
          {tradingPhase === TradingPhase.BondingCurve && launchProgress && (
            <div className="mb-3 rounded-lg border border-accent/30 bg-accent/10 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-500" />
                  Bonding Curve Launch
                </span>
                <span className="text-xs text-muted-foreground">
                  {(launchProgress.percentComplete / 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={launchProgress.percentComplete / 100} className="h-1.5 mb-1" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{parseFloat(formatUnits(launchProgress.raised, 6)).toFixed(2)} USDC</span>
                <span>Target: {parseFloat(formatUnits(launchProgress.target, 6)).toFixed(2)} USDC</span>
              </div>
            </div>
          )}

          {/* Graduated — Claim Tokens Banner */}
          {tradingPhase === TradingPhase.Graduated && userCurveBalance > 0n && (
            <div className="mb-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    Launch Graduated!
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {parseFloat(formatUnits(userCurveBalance, 18)).toFixed(4)} unclaimed tokens
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      updateAlertState('pending', 'Claiming tokens...');
                      await bondingCurveTrade.claim(player.id);
                      refreshPhase();
                      refreshTokenBalance();
                      updateAlertState('success', 'Tokens claimed!', bondingCurveTrade.transactionHash);
                    } catch (err) {
                      updateAlertState('error', `Claim failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    }
                  }}
                  disabled={bondingCurveTrade.isLoading}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs shrink-0"
                >
                  {bondingCurveTrade.isLoading ? 'Claiming...' : 'Claim'}
                </Button>
              </div>
            </div>
          )}

          {/* Cancelled — Refund Banner */}
          {tradingPhase === TradingPhase.Cancelled && userCurveBalance > 0n && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-red-500" />
                    Launch Cancelled
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {parseFloat(formatUnits(userCurveBalance, 18)).toFixed(4)} tokens refundable
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    try {
                      updateAlertState('pending', 'Processing refund...');
                      await bondingCurveTrade.refund(player.id);
                      refreshPhase();
                      refreshTokenBalance();
                      await checkUserUsdcBalance();
                      updateAlertState('success', 'Refund processed!', bondingCurveTrade.transactionHash);
                    } catch (err) {
                      updateAlertState('error', `Refund failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    }
                  }}
                  disabled={bondingCurveTrade.isLoading}
                  className="text-xs shrink-0"
                >
                  {bondingCurveTrade.isLoading ? 'Processing...' : 'Refund'}
                </Button>
              </div>
            </div>
          )}

          {/* Buy/Sell Section */}
          {!showBuySellMenu ? (
            <div className="space-y-2 mb-3">
              <Button 
                onClick={() => { 
                  setShowBuySellMenu(true); 
                  setAction('buy'); 
                  updateAlertState('idle');
                  setShowStats(false);
                  setShowMatches(false);
                }} 
                className="relative overflow-hidden group w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                Purchase Player
              </Button>
              <Button 
                onClick={() => { 
                  setShowBuySellMenu(true); 
                  setAction('sell'); 
                  updateAlertState('idle');
                  setShowStats(false);
                  setShowMatches(false);
                }} 
                variant="outline" 
                className="relative overflow-hidden group w-full h-12 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 hover:border-red-500 hover:text-red-500"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                Sell Player
              </Button>
            </div>
          ) : (
            <Card className="mb-3 bg-card/50 backdrop-blur-sm border-accent/20">
              <div className="p-4 space-y-4">
                {/* Transaction Type Toggle */}
                <div className="flex justify-center space-x-2">
                  <Button
                    variant={action === 'buy' ? "default" : "outline"}
                    onClick={() => setAction('buy')}
                    className={`flex-1 ${action === 'buy' ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' : ''}`}
                  >
                    Buy
                  </Button>
                  <Button
                    variant={action === 'sell' ? "default" : "outline"}
                    onClick={() => setAction('sell')}
                    className={`flex-1 ${action === 'sell' ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' : ''}`}
                  >
                    Sell
                  </Button>
                </div>

                {/* Input Amount */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">You {action === 'buy' ? 'pay' : 'sell'}</span>
                    {action === 'buy' && userUsdcBalance !== '0' && (
                      <span className="text-xs text-muted-foreground">
                        Balance: {parseFloat(userUsdcBalance).toFixed(2)} USDC
                      </span>
                    )}
                    {action === 'sell' && playerTokenBalance > 0n && (
                      <span className="text-xs text-muted-foreground">
                        Balance: {parseFloat(playerTokenBalanceFormatted).toFixed(4)} tokens
                      </span>
                    )}
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
                      className="w-full text-xl font-bold pr-20 bg-background/50 border-accent/20 focus:border-accent/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0.00"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                      <span className="text-base font-bold text-foreground/80">
                        {action === 'buy' ? 'USDC' : player.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Swap Arrow */}
                <div className="relative my-2">
                  <Separator />
                  <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-full p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAction(action === 'buy' ? 'sell' : 'buy')}
                      className="h-7 w-7 rounded-full hover:bg-accent/40"
                    >
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Output Amount */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">You receive</span>
                    {(quote.loading || quote.stale) && usdcAmount && parseFloat(usdcAmount) > 0 && (
                      <div className="w-2.5 h-2.5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    )}
                    {quote.error && (
                      <span className="text-[10px] text-red-500">{quote.error}</span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      readOnly
                      value={
                        isNaN(expectedReceive) || !isFinite(expectedReceive)
                          ? '0.00'
                          : formatNumber(expectedReceive)
                      }
                      className={`w-full text-xl font-bold pr-20 bg-background/30 border-accent/20 ${quote.stale ? 'opacity-60' : ''}`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                      <span className="text-base font-bold text-foreground/80">
                        {action === 'buy' ? player.name : 'USDC'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transaction Details */}
                {transactionStatus !== 'pending' && (!showAlert || notificationDismissed) && (
                  <div className="p-3 rounded-lg bg-accent/20 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Price Impact</span>
                      <div className="flex items-center gap-1">
                        {poolLoading ? (
                          <span className="text-muted-foreground">Loading...</span>
                        ) : poolError ? (
                          <span className="text-red-500">Error</span>
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
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Pool Reserves</span>
                        <span className="text-right max-w-[60%] truncate">
                          {(() => {
                            const pool = poolData.get(player.id);
                            if (!pool) return 'No data';
                            const usdcReserve = (Number(pool.currencyReserve) / 1e6).toFixed(2);
                            const tokenReserve = (Number(pool.playerTokenReserve) / 1e18).toFixed(2);
                            return `${usdcReserve} USDC / ${tokenReserve} ${player.name}`;
                          })()}
                        </span>
                      </div>
                    )}
                    
                    {/* Show effective price when trade data is available */}
                    {realPriceImpactData && realPriceImpactData.effectivePrice && (
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Effective Price</span>
                        <span>
                          {formatPriceDisplay(realPriceImpactData.effectivePrice)} USDC/token
                        </span>
                      </div>
                    )}
                    
                    {/* Fee Information */}
                    <div className="flex justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">{action === 'buy' ? 'Buy' : 'Sell'} Fee</span>
                        {quote.feeType !== null && quote.feeType !== FeeType.Normal && (
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${feeTypeBadgeColor(quote.feeType)}`}>
                            {feeTypeLabel(quote.feeType)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span>
                          {quote.feeRate > 0
                            ? `${(quote.feeRate / 1000).toFixed(2)}%`
                            : tradingPhase === TradingPhase.BondingCurve ? '2.00%' : '--'}
                        </span>
                        {quote.feeAmount > 0n && (
                          <span className="text-[10px] text-muted-foreground">
                            ({parseFloat(formatUnits(quote.feeAmount, 6)).toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Slippage</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Maximum price movement you're willing to accept</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSlippage(0.5)}
                          className={`px-2 py-0.5 h-auto text-xs ${slippage === 0.5 ? 'bg-accent' : ''}`}
                        >
                          0.5%
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSlippage(1)}
                          className={`px-2 py-0.5 h-auto text-xs ${slippage === 1 ? 'bg-accent' : ''}`}
                        >
                          1%
                        </Button>
                        <Input
                          type="number"
                          value={slippage}
                          onChange={e => setSlippage(Number(e.target.value))}
                          className="w-12 h-6 text-xs"
                          min="0.1"
                          max="50"
                          step="0.1"
                        />
                        <span className="text-xs">%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning for high price impact */}
                {transactionStatus !== 'pending' && (!showAlert || notificationDismissed) && isPriceImpactHigh && realPriceImpactData && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-3 w-3" />
                    <AlertDescription className="text-xs">
                      High price impact ({priceImpact}%). Price will change from {formatPriceDisplay(realPriceImpactData.currentPrice)} to {formatPriceDisplay(realPriceImpactData.newPrice)} USDC.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowBuySellMenu(false);
                      setUsdcAmount('');
                      setAction('buy');
                      setSlippage(0.5);
                      updateAlertState('idle');
                    }}
                    className="relative overflow-hidden group flex-1"
                    disabled={isLoading}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={
                      !usdcAmount || parseFloat(usdcAmount) <= 0 || isLoading ||
                      tradingPhase === TradingPhase.Cancelled ||
                      (tradingPhase === TradingPhase.Graduated && userCurveBalance > 0n)
                    }
                    className={`relative overflow-hidden group flex-1 transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 ${
                      action === 'buy'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </div>
                    ) : (
                      `Confirm ${action === 'buy' ? 'Purchase' : 'Sale'}`
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Collapsible Stats - Hidden when buy/sell menu is open */}
          {!showBuySellMenu && (
            <Card className="mb-3">
              <button
                onClick={() => {
                  setShowStats(!showStats);
                  if (!showStats) setShowMatches(false); // Close matches when opening stats
                }}
                className="w-full p-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">Player Statistics</span>
                  {gridStatsLoading && <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>}
                </div>
                {showStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              <AnimatePresence initial={false}>
                {showStats && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="px-3 pb-3 overflow-hidden"
                  >
                    <Separator className="mb-3" />
                    {gridStats ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 bg-accent/50 rounded-lg">
                          <p className="text-base font-bold text-primary">{gridStats.game.kills.avg.toFixed(1)}</p>
                          <p className="text-[10px] text-muted-foreground">Avg Kills</p>
                        </div>
                        <div className="text-center p-2 bg-accent/50 rounded-lg">
                          <p className="text-base font-bold text-primary">{gridStats.game.deaths.avg.toFixed(1)}</p>
                          <p className="text-[10px] text-muted-foreground">Avg Deaths</p>
                        </div>
                        <div className="text-center p-2 bg-accent/50 rounded-lg">
                          <p className="text-base font-bold text-primary">{gridStats.game.killAssistsGiven.avg.toFixed(1)}</p>
                          <p className="text-[10px] text-muted-foreground">Avg Assists</p>
                        </div>
                        <div className="text-center p-2 bg-accent/50 rounded-lg">
                          <p className="text-base font-bold text-primary">{`${gridStats.game.wins.find((w: any) => w.value)?.percentage.toFixed(1) || '0.0'}%`}</p>
                          <p className="text-[10px] text-muted-foreground">Win Rate</p>
                        </div>
                      </div>
                    ) : player.stats ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 bg-accent/50 rounded-lg">
                          <p className="text-base font-bold text-primary">{player.stats.kills.toFixed(1)}</p>
                          <p className="text-[10px] text-muted-foreground">Avg Kills</p>
                        </div>
                        <div className="text-center p-2 bg-accent/50 rounded-lg">
                          <p className="text-base font-bold text-primary">{player.stats.deaths.toFixed(1)}</p>
                          <p className="text-[10px] text-muted-foreground">Avg Deaths</p>
                        </div>
                        <div className="text-center p-2 bg-accent/50 rounded-lg">
                          <p className="text-base font-bold text-primary">{player.stats.assists.toFixed(1)}</p>
                          <p className="text-[10px] text-muted-foreground">Avg Assists</p>
                        </div>
                        <div className="text-center p-2 bg-accent/50 rounded-lg">
                          <p className="text-base font-bold text-primary">{player.stats.winRate}%</p>
                          <p className="text-[10px] text-muted-foreground">Win Rate</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-center text-muted-foreground py-4">No stats available</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )}

          {/* Collapsible Recent Matches - Hidden when buy/sell menu is open */}
          {!showBuySellMenu && (
            <Card>
              <button
                onClick={() => {
                  setShowMatches(!showMatches);
                  if (!showMatches) setShowStats(false); // Close stats when opening matches
                }}
                className="w-full p-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Recent Matches</span>
                  {seriesLoading && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                </div>
                {showMatches ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            
              <AnimatePresence initial={false}>
                {showMatches && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="px-3 pb-3 overflow-hidden"
                  >
                    <Separator className="mb-3" />
                    {getRealRecentMatches().length > 0 ? (
                      <div className="space-y-2">
                        {getRealRecentMatches().map((match, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-accent/30 rounded-lg">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${match.result === 'win' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{match.opponent}</p>
                                <p className="text-[10px] text-muted-foreground">{match.score}</p>
                              </div>
                            </div>
                            <span className={`text-xs font-bold ${match.result === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                              {match.result.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : player.recentMatches && player.recentMatches.length > 0 ? (
                      <div className="space-y-2">
                        {player.recentMatches.map((match, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-accent/30 rounded-lg">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${match.result === 'win' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">vs {match.opponent}</p>
                                <p className="text-[10px] text-muted-foreground">{match.score}</p>
                              </div>
                            </div>
                            <div className="text-right ml-2">
                              <span className={`text-xs font-bold ${match.result === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                                {match.result.toUpperCase()}
                              </span>
                              <p className="text-[10px] text-muted-foreground">{match.performance} pts</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-center text-muted-foreground py-4">No recent matches</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )}

          {/* Bottom padding for scroll */}
          <div className="h-4"></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
