import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion, AnimatePresence } from 'motion/react';
import { Star, TrendingUp, TrendingDown, Zap, Shield, Target, Users, Trophy, Info, AlertCircle, ArrowUpDown, CheckCircle, XCircle, Clock, X } from 'lucide-react';
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
  gridID: string;
  teamGridId: string;
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
  const [userUsdcBalance, setUserUsdcBalance] = useState<string>('0');
  const [alertKey, setAlertKey] = useState(0); // Track unique alert instances to prevent overlap
  const [showAlert, setShowAlert] = useState(false); // Control alert visibility
  const [notificationDismissed, setNotificationDismissed] = useState(false); // Track if notification was dismissed
  const previousStatusRef = useRef<'idle' | 'pending' | 'success' | 'error'>('idle'); // Track previous status
  const isClosingRef = useRef(false); // Track if modal is closing to prevent showing buy/sell menu
  const [isModalContentVisible, setIsModalContentVisible] = useState(true); // Control modal content animation
  const [gridStats, setGridStats] = useState<GridDetailedPlayerStats | null>(null);
  const [gridStatsLoading, setGridStatsLoading] = useState(false);
  const [teamSeriesIds, setTeamSeriesIds] = useState<string[]>([]);
  const [seriesData, setSeriesData] = useState<SeriesState[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  // Helper function to safely update alert state and prevent overlap
  const updateAlertState = (status: 'idle' | 'pending' | 'success' | 'error', message: string = '', hash: string = '') => {
    // For smooth transitions between pending and success/error, don't hide the alert
    // Only hide when going to idle or when starting a new alert from idle state
    let shouldHideAlert = false;
    const prevStatus = previousStatusRef.current;

    // Only hide alert when going to idle state OR when starting from idle to a new alert
    if (status === 'idle') {
      shouldHideAlert = true;
    } else if (prevStatus === 'idle') {
      // Starting a new alert from idle state - hide first to reset
      shouldHideAlert = true;
    }
    // For transitions between pending/success/error, NEVER hide the alert

    if (shouldHideAlert) {
      setShowAlert(false);
    }

    // Reset notification dismissed state for new notifications
    setNotificationDismissed(false);

    // Small delay to ensure previous alert is hidden before showing new one (only for new alerts)
    const updateFunction = () => {
      setTransactionStatus(status);
      previousStatusRef.current = status; // Update the ref with current status
      setStatusMessage(message);
      setTransactionHash(hash);
      setAlertKey(prev => prev + 1);
      setShowAlert(status !== 'idle');
    };

    if (shouldHideAlert) {
      setTimeout(updateFunction, 50);
    } else {
      // For smooth transitions, update immediately without delay
      updateFunction();
    }
  };  // Helper to update transaction hash while maintaining current status
  const updateTransactionHash = (hash: string) => {
    setTransactionHash(hash);
  };

  // Custom handler to prevent modal from closing automatically
  const handleOpenChange = (open: boolean) => {
    // Never allow automatic closing - user must manually close
    // This prevents backdrop clicks and Escape key from closing the modal
    if (!open) {
      // Explicitly prevent closing by not calling onClose()
      return;
    }
    // If opening, allow it
    // Note: We don't call onClose() here to prevent any automatic closing
  };

  // Helper to format transaction hash for display (abbreviated)
  const formatTransactionHash = (hash: string): string => {
    if (!hash || hash.length < 10) return hash;
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  // Update TUSDC balance after successful transactions
  const updateBalanceAfterTransaction = async () => {
    if (isAuthenticated && user?.wallet?.address) {
      console.log('🔄 Updating TUSDC balance after transaction...');
      await checkUserUsdcBalance();
    }
  };
  
  const { user, ready } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();
  const { signTypedData } = useSignTypedData();
  const { poolData, loading: poolLoading, error: poolError, fetchPoolInfo, calculatePriceImpact } = usePoolInfo();
  
  // Transaction handling with new unified wallet system
  const { sendTransactionWithWallet, isEmbeddedWallet } = useWalletTransactions();
  
  // Authentication states from useAuthentication hook
  const { 
    isAuthenticated, 
    isAuthenticating, 
    authenticate, 
    error: authError,
    walletConnected 
  } = useAuthentication();

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
      
      // Try currencyToken function first (more likely to be correct)
      try {
        const address = await readContractCached({
          address: fdfPairContract.address as `0x${string}`,
          abi: fdfPairContract.abi as any,
          functionName: 'currencyToken',
          args: [],
        });
        console.log('✅ Currency token address from currencyToken():', address);
        setCurrencyTokenAddress(address as string);
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
        setCurrencyTokenAddress(address as string);
        return address as string;
      }
    } catch (error) {
      console.error('Error getting currency token address:', error);
      // Fallback to hardcoded TUSDC address from contracts
      const tusdcContract = getContractData('TUSDC');
      console.log('🔄 Using hardcoded TUSDC address as fallback:', tusdcContract.address);
      setCurrencyTokenAddress(tusdcContract.address);
      return tusdcContract.address;
    }
  };

  // Get current nonce for user
  const getCurrentNonce = async (userAddress: string): Promise<number> => {
    try {
      const fdfPairContract = getContractData('FDFPair');
      
      // 🎯 CRITICAL: Use usedNonces + 1 (as per setup.md best practice)
      const usedNonce = await readContractCached({
        address: fdfPairContract.address as `0x${string}`,
        abi: fdfPairContract.abi as any,
        functionName: 'usedNonces',
        args: [userAddress],
      });
      
      const nextNonce = Number(usedNonce) + 1; // Next nonce to use
      console.log('✅ Current nonce for', userAddress, ':', Number(usedNonce), '-> Using:', nextNonce);
      return nextNonce;
    } catch (error) {
      console.error('Error getting current nonce:', error);
      // More conservative fallback - start from 1 if we can't get the nonce
      console.log('🔄 Using fallback nonce: 1');
      return 1;
    }
  };

  // Get current nonce for sell transactions from Player contract
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

  // Check user's USDC balance using TUSDC contract directly
  const checkUserUsdcBalance = async (): Promise<void> => {
    if (!user?.wallet?.address) {
      console.log('⚠️ No wallet address available for TUSDC balance check');
      return;
    }
    
    try {
      console.log('🔍 Checking TUSDC balance for:', user.wallet.address);
      const tusdcContract = getContractData('TUSDC');
      console.log('📜 Using TUSDC contract at:', tusdcContract.address);
      
      const balance = await readContractCached({
        address: tusdcContract.address as `0x${string}`,
        abi: tusdcContract.abi as any,
        functionName: 'balanceOf',
        args: [user.wallet.address as `0x${string}`],
      });
      
      const formattedBalance = formatUnits(balance as bigint, 6);
      console.log('💰 Raw TUSDC balance:', balance.toString());
      console.log('💰 Formatted TUSDC balance:', formattedBalance);
      setUserUsdcBalance(formattedBalance);
    } catch (error) {
      console.error('❌ Error checking TUSDC balance:', error);
      setUserUsdcBalance('0');
    }
  };

  // Approve USDC spending for FDFPair contract
  const approveUSDC = async (amount: bigint): Promise<void> => {
    if (!user?.wallet?.address || !isAuthenticated) {
      throw new Error('Wallet not connected');
    }

    const currencyAddress = await getCurrencyTokenAddress();
    const fdfPairContract = getContractData('FDFPair');

    console.log('💰 Approving USDC spending:', {
      currencyAddress,
      spender: fdfPairContract.address,
      amount: amount.toString()
    });

    // Check current allowance first
    try {
      const currentAllowance = await readContractCached({
        address: currencyAddress as `0x${string}`,
        abi: [
          {
            name: 'allowance',
            type: 'function',
            inputs: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' }
            ],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view'
          }
        ],
        functionName: 'allowance',
        args: [user.wallet.address as `0x${string}`, fdfPairContract.address as `0x${string}`],
      });

      console.log('Current allowance:', (currentAllowance as bigint).toString());
      
      if ((currentAllowance as bigint) >= amount) {
        console.log('✅ Sufficient allowance already exists, skipping approval');
        return;
      }
    } catch (allowanceError) {
      console.warn('Could not check current allowance:', allowanceError);
    }

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

    // Use unified wallet transaction system (automatically handles embedded vs external wallets)
    console.log('📤 Sending USDC approval transaction...');
    updateAlertState('pending', '⏳ Waiting for approval confirmation...', '');
    const result = await sendTransactionWithWallet(transactionRequest);
    const hash = result.hash;
    updateTransactionHash(hash);

    console.log('⏳ Waiting for approval confirmation...');
    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ USDC approval confirmed:', receipt.transactionHash);
    
    // Update status to show approval succeeded and purchase is next
    updateAlertState('pending', '✅ Approval confirmed! Please confirm the purchase transaction...', hash);
    
    // Small delay to ensure user sees the approval success message
    // Especially important for external wallets so they know to look for the next prompt
    await new Promise(resolve => setTimeout(resolve, 1500));
  };

  // Buy tokens using FDFPair contract with proper EIP-712 signature
  const buyTokens = async (playerTokenId: number, tokenAmountToBuy: string, maxCurrencySpend: string): Promise<void> => {
    if (!user?.wallet?.address || !isAuthenticated) {
      throw new Error('Wallet not connected');
    }

    const fdfPairContract = getContractData('FDFPair');
    const maxCurrencySpendBigInt = parseUnits(maxCurrencySpend, 6); // USDC has 6 decimals
    const tokenAmountBigInt = parseUnits(tokenAmountToBuy, 18); // Player tokens have 18 decimals

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
    
    // Set deadline (recommended: 5-15 minutes as per setup.md)
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
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

      console.log('� Requesting EIP712 signature from backend API:', signatureRequest);

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
        setStatusMessage('Backend authentication required - using local signature generation');
      }

      // Fallback to local signature generation
      console.log('🔄 Falling back to local EIP712 signature generation...');

      // Get current nonce for signature (CRITICAL for transaction ordering)
      nonce = await getCurrentNonce(user.wallet.address);
      console.log('🔢 Current nonce (local):', nonce);
      
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
      const signResult = await signTypedData(typedData, {
        uiOptions: {
          title: 'Sign Transaction',
          description: 'Please sign this message to complete your token purchase',
          buttonText: 'Sign Message'
        }
      });

      // Extract signature from result (handles various response formats)
      if (typeof signResult === 'string') {
        signature = signResult;
      } else if (signResult && typeof signResult === 'object') {
        // Try various possible signature fields
        signature = (signResult as any).signature || 
                   (signResult as any).sig || 
                   (signResult as any).data || 
                   signResult.toString();
      } else {
        throw new Error('Invalid signature response format');
      }
      
      if (!signature || !signature.startsWith('0x')) {
        throw new Error(`Invalid signature format: ${signature}`);
      }
      
      console.log('✅ Local EIP712 signature generated:', signature.slice(0, 10) + '...');
    }
    
    console.log('🚀 Executing buyTokens transaction...');

    // Encode the buyTokens function call with signature
    const data = encodeFunctionData({
      abi: fdfPairContract.abi,
      functionName: 'buyTokens',
      args: [
        [BigInt(playerTokenId)], // _playerTokenIds array
        [tokenAmountBigInt], // _playerTokenAmountsToBuy array
        maxCurrencySpendBigInt, // _maxCurrencySpend
        BigInt(deadline), // _deadline
        user.wallet.address as `0x${string}`, // _recipient
        signature as `0x${string}`, // _signature
        BigInt(nonce) // _nonce
      ]
    });

    console.log('🔧 Encoded transaction data');

    // Prepare transaction for buying tokens
    const transactionRequest = {
      to: fdfPairContract.address as `0x${string}`,
      data: data,
    };

    console.log('📤 Sending buyTokens transaction...');
    updateAlertState('pending', '🛒 Confirming purchase... Please check your wallet!', '');

    // Use unified wallet transaction system (automatically handles embedded vs external wallets)
    const result = await sendTransactionWithWallet(transactionRequest);
    const hash = result.hash;
    updateTransactionHash(hash);

    console.log('⏳ Transaction sent, hash:', hash);
    updateAlertState('pending', '⏳ Waiting for purchase confirmation...', hash);

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    // Parse transaction results (as per setup.md best practices)
    console.log('✅ Transaction confirmed!');
    console.log('- Transaction Hash:', receipt.transactionHash);
    console.log('- Block Number:', receipt.blockNumber);
    console.log('- Gas Used:', receipt.gasUsed.toString());
    console.log('🎯 PlayerTokensPurchase event should be emitted in logs');

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
    
    // Set success status with detailed info
    updateAlertState('success', `✅ Successfully bought player tokens!`, hash);

    // Update TUSDC balance after successful transaction
    await updateBalanceAfterTransaction();
  };

  // Sell tokens using Player contract with proper EIP-712 signature
  const sellTokens = async (playerTokenId: number, tokenAmountToSell: string, minCurrencyToReceive: string): Promise<void> => {
    if (!user?.wallet?.address || !isAuthenticated) {
      throw new Error('Wallet not connected');
    }

    const playerContract = getContractData('Player');
    const minCurrencyBigInt = parseUnits(minCurrencyToReceive, 6); // USDC has 6 decimals
    const tokenAmountBigInt = parseUnits(tokenAmountToSell, 18); // Player tokens have 18 decimals

    console.log('🔄 Starting sellTokens transaction...');
    console.log('🎯 Sell Tokens Parameters:');
    console.log('- Player IDs:', [playerTokenId]);
    console.log('- Amounts (tokens):', [tokenAmountToSell]);
    console.log('- Amounts (wei):', [tokenAmountBigInt.toString()]);
    console.log('- Min receive (USDC):', minCurrencyToReceive);
    console.log('- Min receive (wei):', minCurrencyBigInt.toString());

    // Validate minimum amounts
    if (minCurrencyBigInt <= 0n) {
      throw new Error('Minimum currency to receive must be greater than 0');
    }
    if (tokenAmountBigInt <= 0n) {
      throw new Error('Token amount must be greater than 0');
    }

    // Check user's player token balance
    try {
      const playerBalance = await readContractCached({
        address: playerContract.address as `0x${string}`,
        abi: playerContract.abi as any,
        functionName: 'balanceOf',
        args: [user.wallet.address as `0x${string}`, BigInt(playerTokenId)],
      });
      
      console.log('Player token balance:', (playerBalance as bigint).toString());
      
      if ((playerBalance as bigint) < tokenAmountBigInt) {
        throw new Error(`Insufficient player token balance. You have ${formatUnits(playerBalance as bigint, 18)} tokens but need ${tokenAmountToSell} tokens`);
      }
    } catch (balanceError) {
      console.error('Balance check error:', balanceError);
      throw new Error(`Unable to verify player token balance: ${balanceError instanceof Error ? balanceError.message : 'Unknown balance check error'}`);
    }

    // Check if player is sellable
    try {
      const isSellable = await readContractCached({
        address: playerContract.address as `0x${string}`,
        abi: playerContract.abi as any,
        functionName: 'isSellable',
        args: [BigInt(playerTokenId)],
      });
      
      if (!isSellable) {
        throw new Error(`Player ${playerTokenId} is not currently sellable`);
      }
    } catch (sellableError) {
      console.error('Sellable check error:', sellableError);
      throw new Error(`Player ${playerTokenId} is not available for selling`);
    }

    // Set deadline (recommended: 5-15 minutes as per setup.md)
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
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

      console.log('🌐 Attempting backend sell signature generation...');
      
      // Prepare request data for backend signature generation
      const signatureRequest: SellTokensRequest = {
        playerTokenIds: [playerTokenId.toString()], // Send as string array (consistent with buy)
        amounts: [tokenAmountBigInt.toString()], // BigInt as string
        minCurrencyToReceive: Number(minCurrencyBigInt), // Convert BigInt to number
        deadline
      };

      console.log('📝 Requesting EIP712 sell signature from backend API:', signatureRequest);

      // Get signature from backend API
      const signatureResponse = await apiService.prepareSellSignature(signatureRequest);
      
      console.log('✅ Backend sell signature response received:', {
        transactionId: signatureResponse.transactionId,
        signatureLength: signatureResponse.signature.length,
        nonce: signatureResponse.txData?.nonce || 'not provided'
      });

      // Extract signature and transaction data from backend response
      signature = signatureResponse.signature;
      nonce = signatureResponse.txData?.nonce;
      transactionId = signatureResponse.transactionId;
      
      // If backend didn't provide a nonce, fetch it separately
      if (nonce === undefined || nonce === null) {
        console.log('🔢 Backend did not provide nonce, fetching from nonce endpoint...');
        nonce = await getCurrentSellNonce(user.wallet.address);
        console.log('🔢 Fetched sell nonce:', nonce);
      }
      
      if (!signature || !signature.startsWith('0x')) {
        throw new Error(`Invalid signature format from backend: ${signature}`);
      }
      
      console.log('✅ Using backend-generated EIP712 sell signature:', signature.slice(0, 10) + '...');

    } catch (backendError) {
      console.warn('⚠️ Backend sell signature generation failed, falling back to local generation:', backendError);

      // If error mentions authentication, inform user
      if (backendError instanceof Error && (backendError.message.includes('Authentication') || backendError.message.includes('token'))) {
        console.log('🔐 Authentication issue detected - user may need to re-authenticate for backend features');
        setStatusMessage('Backend authentication required - using local signature generation');
      }

      // Fallback to local signature generation
      console.log('🔄 Falling back to local EIP712 sell signature generation...');

      // Get current nonce for sell signature (CRITICAL for transaction ordering)
      nonce = await getCurrentSellNonce(user.wallet.address);
      console.log('🔢 Current sell nonce (local):', nonce);
      
      // Prepare signature data for local generation
      const signatureData = {
        seller: user.wallet.address,
        playerTokenIds: [playerTokenId], // Array with actual number
        amounts: [tokenAmountBigInt.toString()], // Array with BigInt string
        minCurrencyToReceive: minCurrencyBigInt.toString(), // BigInt string, not decimal
        deadline,
        nonce
      };

      console.log('📝 Preparing local EIP712 sell signature with data:', signatureData);

      // Validate all values are safe for JSON serialization
      const testData = {
        playerTokenIds: signatureData.playerTokenIds,
        amounts: signatureData.amounts,
        minCurrencyToReceive: signatureData.minCurrencyToReceive,
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
      const domain = createPlayerEIP712Domain(playerContract.address);
      const typedData = createSellTokensTypedData(domain, signatureData);
      
      // Validate signature parameters
      validateSellSignatureParams(signatureData);

      console.log('🔐 Creating local EIP712 sell signature... (requires txSigner wallet)');
      
      // Test JSON serialization before passing to Privy
      try {
        const testSerialization = JSON.stringify(typedData);
        console.log('✅ JSON serialization test passed, data length:', testSerialization.length);
      } catch (serializationError) {
        console.error('❌ JSON serialization failed:', serializationError);
        throw new Error(`Cannot serialize typed data for signing: ${serializationError instanceof Error ? serializationError.message : 'Unknown serialization error'}`);
      }

      // Use Privy's signTypedData hook
      const signResult = await signTypedData(typedData, {
        uiOptions: {
          title: 'Sign Sell Transaction',
          description: 'Please sign this message to complete your token sale',
          buttonText: 'Sign Message'
        }
      });

      // Extract signature from result (handles various response formats)
      if (typeof signResult === 'string') {
        signature = signResult;
      } else if (signResult && typeof signResult === 'object') {
        // Try various possible signature fields
        signature = (signResult as any).signature || 
                   (signResult as any).sig || 
                   (signResult as any).data || 
                   signResult.toString();
      } else {
        throw new Error('Invalid signature response format');
      }
      
      if (!signature || !signature.startsWith('0x')) {
        throw new Error(`Invalid signature format: ${signature}`);
      }
      
      console.log('✅ Local EIP712 sell signature generated:', signature.slice(0, 10) + '...');
    }
    
    console.log('🚀 Executing sellTokens transaction...');

    // Encode the sellTokens function call with signature
    const data = encodeFunctionData({
      abi: playerContract.abi,
      functionName: 'sellTokens',
      args: [
        [BigInt(playerTokenId)], // _playerTokenIds array
        [tokenAmountBigInt], // _amounts array
        minCurrencyBigInt, // _minCurrencyToReceive
        BigInt(deadline), // _deadline
        signature as `0x${string}`, // _signature
        BigInt(nonce) // _nonce
      ]
    });

    console.log('🔧 Encoded sell transaction data');

    // Prepare transaction for selling tokens
    const transactionRequest = {
      to: playerContract.address as `0x${string}`,
      data: data,
    };

    console.log('📤 Sending sellTokens transaction...');
    updateAlertState('pending', '💰 Confirming sale... Please check your wallet!', '');

    // Use unified wallet transaction system (automatically handles embedded vs external wallets)
    const result = await sendTransactionWithWallet(transactionRequest);
    const hash = result.hash;
    updateTransactionHash(hash);

    console.log('⏳ Transaction sent, hash:', hash);
    updateAlertState('pending', '⏳ Waiting for sale confirmation...', hash);

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    // Parse transaction results (as per setup.md best practices)
    console.log('✅ Sell transaction confirmed!');
    console.log('- Transaction Hash:', receipt.transactionHash);
    console.log('- Block Number:', receipt.blockNumber);
    console.log('- Gas Used:', receipt.gasUsed.toString());
    console.log('🎯 AuthorisedSellTokens event should be emitted in logs');

    // Confirm transaction with backend if we used backend signature generation
    if (transactionId) {
      try {
        console.log('📤 Confirming sell transaction with backend...');
        await apiService.confirmSellTransaction(transactionId, hash);
        console.log('✅ Sell transaction confirmed with backend');
      } catch (confirmError) {
        console.error('⚠️ Failed to confirm sell transaction with backend:', confirmError);
        // Don't throw error here as the transaction itself was successful
      }
    } else {
      console.log('ℹ️ Using local signature generation, skipping backend confirmation');
    }
    
    // Set success status with detailed info
    updateAlertState('success', `✅ Successfully sold player tokens!`, hash);

    // Update TUSDC balance after successful transaction
    await updateBalanceAfterTransaction();
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
      case 'carry': return <Target className="w-4 h-4" />;
      case 'controller':
      case 'support': return <Shield className="w-4 h-4" />;
      case 'initiator':
      case 'jungle': return <Zap className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  // Early return if no player - prevents hooks from being called in different orders
  if (!player) return null;

  // Fetch initial data when modal opens
  useEffect(() => {
    if (isOpen && player) {
      console.log('🔄 Modal opened, initializing data...');
      
      // Reset closing state and show modal content
      isClosingRef.current = false;
      setIsModalContentVisible(true);
      
      // Reset form state
      setUsdcAmount('');
      setAction('buy');
      setSlippage(0.5);
      setShowBuySellMenu(false);
      updateAlertState('idle');
      
      // Fetch pool info if needed
      if (!fetchedPlayerIds.current.has(player.id)) {
        console.log('📊 Fetching pool info for player:', player.id);
        fetchedPlayerIds.current.add(player.id);
        fetchPoolInfo([player.id]);
      }

      // Always check TUSDC balance when modal opens
      if (isAuthenticated && user?.wallet?.address) {
        console.log('💰 Checking initial TUSDC balance...');
        checkUserUsdcBalance();
      }
      
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
  }, [isOpen, player, isAuthenticated, user?.wallet?.address]); // Added auth dependencies
  
  // Auto-authenticate when wallet is connected
  useEffect(() => {
    const autoAuthenticate = async () => {
      if (!isAuthenticated && walletConnected && !isAuthenticating) {
        console.log('🔐 Auto-authenticating for PlayerPurchaseModal...');
        try {
          await authenticate();
        } catch (error) {
          console.error('Failed to auto-authenticate:', error);
        }
      }
    };

    autoAuthenticate();
  }, [isAuthenticated, walletConnected, isAuthenticating, authenticate]);

  // Parse player.price (e.g. "1.2 USDC") to number - but prefer real pool price
  const playerPrice = player ? parseFloat(player.price) : 0;
  
  // Helper function to format price display with 5 significant digits
  const formatPriceDisplay = (price: number): string => {
    if (price === 0) return '0.00000';
    
    // Get the number of digits before decimal point
    const beforeDecimal = Math.floor(Math.log10(Math.abs(price))) + 1;
    
    if (beforeDecimal >= 5) {
      // If 5+ digits before decimal, show no decimal places
      return price.toFixed(0);
    } else if (beforeDecimal > 0) {
      // Show enough decimal places to get 5 total digits
      const decimalPlaces = Math.max(0, 5 - beforeDecimal);
      return price.toFixed(decimalPlaces);
    } else {
      // For very small numbers (0.00xxx), show 5 significant digits after leading zeros
      const leadingZeros = Math.floor(-Math.log10(Math.abs(price)));
      return price.toFixed(leadingZeros + 4); // 4 more digits after the first significant digit
    }
  };
  
  // Get real price from pool data if available, otherwise fallback to player.price
  const getRealPrice = () => {
    const poolInfo = poolData.get(player.id);
    if (poolInfo && poolInfo.currencyReserve > 0n && poolInfo.playerTokenReserve > 0n) {
      // Calculate real price from pool reserves: USDC reserve / token reserve
      const usdcReserve = Number(poolInfo.currencyReserve) / 1e6; // USDC has 6 decimals
      const tokenReserve = Number(poolInfo.playerTokenReserve) / 1e18; // Tokens have 18 decimals
      const realPrice = usdcReserve / tokenReserve;
      console.log(`🔄 Using real pool price: ${realPrice.toFixed(8)} USDC per token (was ${playerPrice})`);
      return realPrice;
    }
    console.log(`⚠️ No pool data, using fallback price: ${playerPrice} USDC per token`);
    return playerPrice;
  };
  
  const currentPrice = getRealPrice();

  // Calculate expected amount BEFORE slippage using real pool price
  const usdc = parseFloat(usdcAmount) || 0;
  const expectedReceive = action === 'buy'
    ? usdc / currentPrice
    : usdc * currentPrice;

  // Calculate price impact using real pool data
  const realPriceImpactData = calculatePriceImpact(player.id, usdcAmount, action);
  const priceImpact = realPriceImpactData ? realPriceImpactData.priceImpact.toFixed(2) : '0.00';
  const isPriceImpactHigh = parseFloat(priceImpact) > 5;

  const { loadPlayerData, error: gridError } = useGridCache();

  // Fetch all Grid.gg data when modal opens
  useEffect(() => {
    const fetchAllGridData = async () => {
      if (isOpen && player && player.gridID && player.teamGridId) {
        setGridStatsLoading(true);
        setSeriesLoading(true);
        
        try {
          console.log(`📊 Loading all Grid.gg data for player ${player.name}`);
          const { stats, seriesStates } = await loadPlayerData(player.gridID, player.teamGridId);
          
          if (stats) {
            console.log(`✅ Grid.gg stats loaded for ${player.name}`);
            setGridStats(stats);
          }
          
          if (seriesStates.length > 0) {
            console.log(`✅ Loaded ${seriesStates.length} series for ${player.name}`);
            setSeriesData(seriesStates);
          }
        } catch (error) {
          console.error(`❌ Error loading Grid.gg data for ${player.name}:`, error);
        } finally {
          setGridStatsLoading(false);
          setSeriesLoading(false);
        }
      }
    };

    fetchAllGridData();
  }, [isOpen, player?.gridID, player?.teamGridId, player?.name, loadPlayerData]);

  // Format numbers with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 4,
      minimumFractionDigits: 0,
    }).format(num);
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

    // Check if user has sufficient USDC balance
    const userBalance = parseFloat(userUsdcBalance);
    const requiredAmount = parseFloat(usdcAmount);
    if (action === 'buy' && userBalance < requiredAmount) {
      updateAlertState('error', `Insufficient USDC balance. You have ${userBalance.toFixed(2)} USDC but need ${requiredAmount.toFixed(2)} USDC`);
      return;
    }

    setIsLoading(true);
    updateAlertState('pending', `${action === 'buy' ? 'Purchasing' : 'Selling'} ${player.name} tokens...`);
    
    try {
      console.log('🔄 UPDATED CODE RUNNING - handleConfirm function with slippage fix');
      
      if (action === 'buy') {
        // Calculate token amount to buy using real pool price
        const tokenAmount = (parseFloat(usdcAmount) / currentPrice).toString();
        
        // Calculate max currency spend with slippage protection
        // User wants to spend 'usdcAmount', but due to slippage, they might need to spend more
        const maxCurrencyWithSlippage = (parseFloat(usdcAmount) * (1 + slippage / 100)).toString();
        
        console.log(`💰 Buy calculation: ${usdcAmount} USDC / ${currentPrice.toFixed(8)} price = ${tokenAmount} tokens`);
        console.log(`🛡️ SLIPPAGE PROTECTION: ${usdcAmount} USDC base + ${slippage}% slippage = ${maxCurrencyWithSlippage} USDC max spend`);
        console.log(`📊 Price check: Current pool price ${currentPrice.toFixed(8)} USDC/token`);
        console.log(`⚠️  Warning: AMM price impact may require more than ${maxCurrencyWithSlippage} USDC for ${tokenAmount} tokens`);
        
        // Check if user has sufficient balance for the slippage-adjusted amount
        const userBalance = parseFloat(userUsdcBalance);
        const maxSpendAmount = parseFloat(maxCurrencyWithSlippage);
        if (userBalance < maxSpendAmount) {
          updateAlertState('error', `Insufficient USDC balance for slippage. You have ${userBalance.toFixed(2)} USDC but may need up to ${maxSpendAmount.toFixed(2)} USDC with ${slippage}% slippage`);
          return;
        }
        
        console.log(`🚀 CALLING buyTokens with maxCurrencyWithSlippage: ${maxCurrencyWithSlippage}`);
        await buyTokens(player.id, tokenAmount, maxCurrencyWithSlippage);
      } else {
        // For selling, usdcAmount represents the number of tokens to sell
        const minCurrency = (parseFloat(usdcAmount) * currentPrice * (1 - slippage / 100)).toString();
        console.log(`💰 Sell calculation: ${usdcAmount} tokens * ${currentPrice.toFixed(8)} price * ${1 - slippage / 100} slippage = ${minCurrency} USDC`);
        await sellTokens(player.id, usdcAmount, minCurrency);
      }
      
      // Call optional callback
      if (onPurchase) {
        await onPurchase(player, usdcAmount, action, slippage);
      }
      
      // No automatic form reset or modal close - user controls when to close
    } catch (error) {
      console.error('❌ Buy tokens failed:', error);
      
      // Enhanced error handling (as per setup.md best practices)
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.message.includes('InvalidSignature')) {
          errorMessage = 'Invalid signature - ensure txSigner wallet is used';
        } else if (error.message.includes('InvalidNonce')) {
          errorMessage = 'Invalid nonce - transaction may be out of order';
        } else if (error.message.includes('DEADLINE_EXCEEDED')) {
          errorMessage = 'Transaction deadline exceeded';
        } else if (error.message.includes('MAX_CURRENCY_AMOUNT_EXCEEDED')) {
          errorMessage = 'Price increased beyond max spend limit';
        } else if (error.message.includes('PlayerNotBuyable')) {
          errorMessage = 'One or more players are not buyable';
        } else if (error.message.includes('PlayerNotSellable')) {
          errorMessage = 'One or more players are not sellable';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient TUSDC balance';
        } else if (error.message.includes('INSUFFICIENT_CURRENCY_AMOUNT')) {
          errorMessage = 'Insufficient USDC balance for this purchase';
        } else if (error.message.includes('INSUFFICIENT_LIQUIDITY')) {
          errorMessage = 'Insufficient liquidity in the pool for this trade';
        } else if (error.message.includes('Insufficient player token balance')) {
          errorMessage = error.message; // Use the detailed balance error message
        } else if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction was cancelled by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient ETH balance to pay for gas fees';
        } else {
          errorMessage = error.message;
        }
      }
      
      updateAlertState('error', `Transaction failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Transform series data into MatchResult format
  const getRealRecentMatches = (): MatchResult[] => {
    if (!player || seriesData.length === 0) {
      return []; // No fallback to fakedata.json - wait for real data
    }

    const matches: MatchResult[] = [];

    for (const series of seriesData.slice(0, 3)) { // Limit to 3 most recent matches
      // Find the player's team in this series
      const playerTeam = series.teams.find(team => team.id === player.teamGridId);
      const opponentTeam = series.teams.find(team => team.id !== player.teamGridId);

      if (!playerTeam || !opponentTeam) continue;

      // Determine the result
      const result: 'win' | 'loss' = playerTeam.won ? 'win' : 'loss';

      // Calculate score (e.g., "2-1" for best of 3)
      const score = `${playerTeam.score}-${opponentTeam.score}`;

      // Create match result
      matches.push({
        opponent: opponentTeam.name,
        result,
        score,
        performance: result === 'win' ? Math.floor(Math.random() * 20) + 80 : Math.floor(Math.random() * 30) + 50 // Placeholder performance
      });
    }

    return matches.slice(0, 3);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl border-0 shadow-2xl">
        <div className="relative">
          {/* Close button - hide during closing animation */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Start the closing animation
              setIsModalContentVisible(false);
              
              // Close modal after animation completes (0.3s to match the exit animation)
              setTimeout(() => {
                // Reset all states
                setShowBuySellMenu(false);
                setUsdcAmount('');
                setAction('buy');
                setSlippage(0.5);
                updateAlertState('idle');
                isClosingRef.current = false;
                
                // Close the modal
                onClose();
              }, 300);
            }}
            className={`absolute -top-2 -right-2 z-10 overflow-hidden group h-8 w-8 p-0 rounded-full hover:bg-background/50 transition-opacity duration-300 ${
              !isModalContentVisible ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <X className="h-4 w-4" />
          </Button>
          
          {/* Modal Content with synchronized animation - maintain size during closing */}
          <div className="h-[600px] overflow-hidden"> {/* Fixed height to prevent size shifting */}
            <AnimatePresence mode="wait">
              {isModalContentVisible && (
                <motion.div
                  layout={false}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 30 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
        
          <DialogHeader className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
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
                    className="relative z-10 w-20 h-20 rounded-xl object-contain shadow-lg opacity-85"
                  />
                  <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-r ${getRatingColor(player.rating)} flex items-center justify-center text-white text-sm font-bold z-20`}>
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

        {/* Authentication Status */}
        {!walletConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mx-1"
          >
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Wallet Not Connected</span>
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
              Please connect your wallet to purchase players and view your balance.
            </p>
          </motion.div>
        )}

        {walletConnected && !isAuthenticated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mx-1"
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
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {authError}
              </p>
            )}
          </motion.div>
        )}

        {isAuthenticated && (
          <div className="px-1">
            <AuthenticationStatus />
          </div>
        )}

        <div className="space-y-6">
          {/* Price and Purchase */}
          <Card className="p-6 bg-gradient-to-r from-accent/30 to-accent/10 border-0">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">Purchase Price</h3>
              <p className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent mb-4">
                {formatPriceDisplay(currentPrice)} USDC
              </p>
            </div>
            <div className="flex items-center justify-center">
              {!showBuySellMenu && (
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setShowBuySellMenu(true);
                      setAction('buy');
                      updateAlertState('idle');
                    }}
                    className="relative overflow-hidden group bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0 shadow-lg text-lg px-8 py-3 transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    Purchase Player
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowBuySellMenu(true);
                      setAction('sell');
                      updateAlertState('idle');
                    }}
                    variant="outline"
                    className="relative overflow-hidden group text-lg px-8 py-3 transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 hover:border-red-500 hover:text-red-500"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    Sell Player
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Buy/Sell Menu */}
          {showBuySellMenu && !isClosingRef.current && (
            <Card className="w-full max-w-md mx-auto bg-card/50 backdrop-blur-sm border-accent/20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
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
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">You {action === 'buy' ? 'pay' : 'sell'}</span>
                    {action === 'buy' && userUsdcBalance !== '0' && (
                      <span className="text-xs text-muted-foreground">
                        Balance: {parseFloat(userUsdcBalance).toFixed(2)} USDC
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

                {/* Transaction Details - Hide during processing and when notification is active (unless dismissed) */}
                {transactionStatus !== 'pending' && (!showAlert || notificationDismissed) && (
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
                              ? (Number(pool.currencyReserve) / 1e6) / (Number(pool.playerTokenReserve) / 1e18)
                              : 0;
                            return `${usdcReserve} USDC / ${tokenReserve} ${player.name} (${formatPriceDisplay(currentPrice)} USDC/token)`;
                          })()}
                        </span>
                      </div>
                    )}
                    
                    {/* Show effective price when trade data is available */}
                    {realPriceImpactData && realPriceImpactData.effectivePrice && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Effective Price</span>
                        <span>
                          {formatPriceDisplay(realPriceImpactData.effectivePrice)} USDC per token
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
                )}

                {/* Warning for high price impact - Hide during processing and when notification is active (unless dismissed) */}
                {transactionStatus !== 'pending' && (!showAlert || notificationDismissed) && isPriceImpactHigh && realPriceImpactData && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      High price impact ({priceImpact}%). Price will change from {formatPriceDisplay(realPriceImpactData.currentPrice)} to {formatPriceDisplay(realPriceImpactData.newPrice)} USDC.
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
                    disabled={!usdcAmount || parseFloat(usdcAmount) <= 0 || isLoading}
                    className={`relative overflow-hidden group flex-1 transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 ${
                      action === 'buy'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
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

                {/* Transaction Status Tab - Strict No-Overlap Design */}
                {showAlert && transactionStatus !== 'idle' && (
                  <div
                    key={`alert-${alertKey}`}
                    className="mt-6 mb-4 w-full"
                    style={{ minHeight: '120px', clear: 'both' }} // Ensure minimum space and clear floats
                  >
                    <div className="w-full bg-white dark:bg-gray-900 border-2 rounded-lg shadow-lg overflow-hidden">
                      {/* Status Header - Fixed Height */}
                      <div className={`w-full px-4 py-3 border-b-2 relative ${
                        transactionStatus === 'pending' 
                          ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-700' 
                          : transactionStatus === 'success' 
                          ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-700' 
                          : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-700'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {transactionStatus === 'pending' && (
                              <Clock className="w-6 h-6 text-blue-600 animate-pulse" />
                            )}
                            {transactionStatus === 'success' && (
                              <CheckCircle className="w-6 h-6 text-green-600" />
                            )}
                            {transactionStatus === 'error' && (
                              <XCircle className="w-6 h-6 text-red-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-base leading-tight truncate ${
                              transactionStatus === 'pending' 
                                ? 'text-blue-800 dark:text-blue-200' 
                                : transactionStatus === 'success' 
                                ? 'text-green-800 dark:text-green-200' 
                                : 'text-red-800 dark:text-red-200'
                            }`}>
                              {statusMessage}
                            </p>
                          </div>
                        </div>
                        {/* Close Button - Only show for completed transactions */}
                        {transactionStatus !== 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setNotificationDismissed(true);
                              setShowAlert(false);
                            }}
                            className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-black/10 dark:hover:bg-white/10"
                            aria-label="Dismiss notification"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Content Area - Separate Container */}
                      <div className="w-full p-4 space-y-4 bg-white dark:bg-gray-900">
                        {/* Transaction Hash Section */}
                        {transactionHash && (
                          <div className="w-full">
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3">
                              <div className="mb-2">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                                  Transaction Hash
                                </p>
                                <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 mb-2">
                                  <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all leading-relaxed">
                                    {formatTransactionHash(transactionHash)}
                                  </p>
                                </div>
                                <a 
                                  href={`${NETWORK_CONFIG.blockExplorer}/tx/${transactionHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded border border-blue-200 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800/30 transition-colors"
                                >
                                  View on Explorer →
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                        

                      </div>
                    </div>
                  </div>
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
                  {gridStatsLoading && (
                    <div className="ml-2 w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {gridStatsLoading && !gridStats ? (
                    // Loading state - show skeleton placeholders
                    <>
                      <div className="text-center p-2 bg-accent/50 rounded-lg animate-pulse">
                        <div className="h-6 bg-gray-300 rounded w-8 mx-auto mb-1"></div>
                        <div className="h-3 bg-gray-300 rounded w-12 mx-auto"></div>
                      </div>
                      <div className="text-center p-2 bg-accent/50 rounded-lg animate-pulse">
                        <div className="h-6 bg-gray-300 rounded w-8 mx-auto mb-1"></div>
                        <div className="h-3 bg-gray-300 rounded w-12 mx-auto"></div>
                      </div>
                      <div className="text-center p-2 bg-accent/50 rounded-lg animate-pulse">
                        <div className="h-6 bg-gray-300 rounded w-8 mx-auto mb-1"></div>
                        <div className="h-3 bg-gray-300 rounded w-12 mx-auto"></div>
                      </div>
                      <div className="text-center p-2 bg-accent/50 rounded-lg animate-pulse">
                        <div className="h-6 bg-gray-300 rounded w-8 mx-auto mb-1"></div>
                        <div className="h-3 bg-gray-300 rounded w-12 mx-auto"></div>
                      </div>
                    </>
                  ) : gridStats ? (
                    // Show real Grid.gg stats
                    <>
                      <div className="text-center p-2 bg-accent/50 rounded-lg">
                        <p className="text-lg font-bold text-primary">
                          {gridStats.game.kills.avg.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Kills</p>
                      </div>
                      <div className="text-center p-2 bg-accent/50 rounded-lg">
                        <p className="text-lg font-bold text-primary">
                          {gridStats.game.deaths.avg.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Deaths</p>
                      </div>
                      <div className="text-center p-2 bg-accent/50 rounded-lg">
                        <p className="text-lg font-bold text-primary">
                          {gridStats.game.killAssistsGiven.avg.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Assists</p>
                      </div>
                      <div className="text-center p-2 bg-accent/50 rounded-lg">
                        <p className="text-lg font-bold text-primary">
                          {`${gridStats.game.wins.find(w => w.value)?.percentage.toFixed(1) || '0.0'}%`}
                        </p>
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                      </div>
                    </>
                  ) : (
                    // No data available yet
                    <div className="col-span-4 text-center py-4 text-muted-foreground">
                      <p className="text-sm">No statistics available</p>
                      <p className="text-xs mt-1">Player stats will appear here when available</p>
                    </div>
                  )}
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
                
                {/* Grid.gg Data Source Indicator */}
                {gridStats && (
                  <div className="mt-2 flex items-center text-xs text-muted-foreground">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    Live data from Grid.gg
                  </div>
                )}
                {!gridStats && gridStatsLoading && (
                  <div className="mt-2 flex items-center text-xs text-muted-foreground">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                    Loading stats from Grid.gg...
                  </div>
                )}
                {!gridStats && !gridStatsLoading && player.gridID && (
                  <div className="mt-2 flex items-center text-xs text-muted-foreground">
                    <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>
                    Waiting for player stats
                  </div>
                )}
              </Card>

              {/* Recent Matches */}
              <Card className="p-4 border-0 shadow-lg">
                <h3 className="mb-3 flex items-center text-sm">
                  <Star className="w-4 h-4 mr-2 text-blue-500" />
                  Recent Matches
                  {seriesLoading && (
                    <div className="ml-2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </h3>
                <div className="space-y-2">
                  {seriesLoading && getRealRecentMatches().length === 0 ? (
                    // Loading state - show skeleton placeholders
                    Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-accent/30 rounded-lg animate-pulse">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                          <div>
                            <div className="h-3 bg-gray-300 rounded w-20 mb-1"></div>
                            <div className="h-2 bg-gray-300 rounded w-12"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="h-4 bg-gray-300 rounded w-12 mb-1"></div>
                          <div className="h-2 bg-gray-300 rounded w-8"></div>
                        </div>
                      </div>
                    ))
                  ) : getRealRecentMatches().length > 0 ? (
                    // Show real matches
                    getRealRecentMatches().map((match, index) => (
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
                    ))
                  ) : (
                    // No data available yet
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">No recent matches available</p>
                      <p className="text-xs mt-1">Match data will appear here when available</p>
                    </div>
                  )}
                </div>
                
                {/* Series Data Source Indicator */}
                {seriesData.length > 0 && (
                  <div className="mt-2 flex items-center text-xs text-muted-foreground">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                    Live series data from Grid.gg
                  </div>
                )}
                {seriesData.length === 0 && seriesLoading && (
                  <div className="mt-2 flex items-center text-xs text-muted-foreground">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse"></div>
                    Loading match data from Grid.gg...
                  </div>
                )}
                {seriesData.length === 0 && !seriesLoading && player.teamGridId && (
                  <div className="mt-2 flex items-center text-xs text-muted-foreground">
                    <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>
                    Waiting for match data
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};