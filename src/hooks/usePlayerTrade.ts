import { useState, useRef, useCallback } from 'react';
import { parseUnits, formatUnits, encodeFunctionData } from 'viem';
import { useSignTypedData } from '@privy-io/react-auth';
import { getContractData } from '../contracts';
import { readContractCached } from '../utils/contractCache';
import {
  createEIP712Domain,
  createBuyTokensTypedData,
  validateSignatureParams,
  createPlayerEIP712Domain,
  createSellTokensTypedData,
  validateSellSignatureParams,
} from '../utils/signatures';
import { apiService, type SellTokensRequest } from '../services/apiService';
import { useWalletTransactions } from './useWalletTransactions';
import { TradingPhase, type TransactionStatus } from '../types/trading';
import type { Player } from './usePlayerModalData';
import type { PublicClient } from 'viem';

// ─── Hook params ───

export interface UsePlayerTradeParams {
  player: Player | null;
  /** Privy user object (needed for wallet address) */
  user: { wallet?: { address: string } } | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Viem public client for waiting on tx receipts */
  publicClient: PublicClient;
}

// ─── Alert state (transaction feedback) ───

export interface AlertState {
  transactionStatus: TransactionStatus;
  statusMessage: string;
  transactionHash: string;
  showAlert: boolean;
  notificationDismissed: boolean;
  alertKey: number;
}

// ─── Hook return type ───

export interface UsePlayerTradeReturn {
  // Form state
  usdcAmount: string;
  setUsdcAmount: (val: string) => void;
  action: 'buy' | 'sell';
  setAction: (val: 'buy' | 'sell') => void;
  slippage: number;
  setSlippage: (val: number) => void;
  isLoading: boolean;
  showBuySellMenu: boolean;
  setShowBuySellMenu: (val: boolean) => void;

  // Alert / transaction status
  alertState: AlertState;
  updateAlertState: (status: TransactionStatus, message?: string, hash?: string) => void;
  dismissNotification: () => void;

  // Transaction handlers
  handleConfirm: (deps: HandleConfirmDeps) => Promise<void>;
  resetForm: () => void;

  // Formatting
  formatTransactionHash: (hash: string) => string;
  formatNumber: (num: number) => string;
}

/** Dependencies injected into handleConfirm from the modal data hook */
export interface HandleConfirmDeps {
  tradingPhase: TradingPhase;
  quote: {
    amountToReceive: bigint;
  };
  currentPrice: number;
  userUsdcBalance: string;
  bondingCurveTrade: {
    buy: (params: { playerId: number; tokenAmount: string; maxCurrencySpend: string }) => Promise<{ hash: string }>;
    sell: (params: { playerId: number; tokenAmount: string; minCurrencyToReceive: string }) => Promise<{ hash: string }>;
    transactionHash: string;
  };
  refreshPhase: () => void;
  refreshTokenBalance: () => void;
  checkUserUsdcBalance: () => Promise<void>;
  userCurveBalance: bigint;
  onPurchase?: (player: Player, usdcAmount: string, action: 'buy' | 'sell', slippage: number) => Promise<void>;
}

// ─── Hook implementation ───

export function usePlayerTrade({
  player,
  user,
  isAuthenticated,
  publicClient,
}: UsePlayerTradeParams): UsePlayerTradeReturn {
  // ── Form state ──
  const [usdcAmount, setUsdcAmount] = useState('');
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [slippage, setSlippage] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [showBuySellMenu, setShowBuySellMenu] = useState(false);

  // ── Alert state ──
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [transactionHash, setTransactionHash] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const [alertKey, setAlertKey] = useState(0);
  const previousStatusRef = useRef<TransactionStatus>('idle');

  // ── Currency token address (cached after first lookup) ──
  const [currencyTokenAddress, setCurrencyTokenAddress] = useState<string>('');

  // ── Privy hooks ──
  const { signTypedData } = useSignTypedData();
  const { sendTransactionWithWallet } = useWalletTransactions();

  // ── Alert helpers ──

  const updateAlertState = useCallback(
    (status: TransactionStatus, message: string = '', hash: string = '') => {
      const prevStatus = previousStatusRef.current;
      let shouldHideAlert = false;

      if (status === 'idle') {
        shouldHideAlert = true;
      } else if (prevStatus === 'idle') {
        shouldHideAlert = true;
      }

      if (shouldHideAlert) {
        setShowAlert(false);
      }

      setNotificationDismissed(false);

      const updateFunction = () => {
        setTransactionStatus(status);
        previousStatusRef.current = status;
        setStatusMessage(message);
        setTransactionHash(hash);
        setAlertKey((prev) => prev + 1);
        setShowAlert(status !== 'idle');
      };

      if (shouldHideAlert) {
        setTimeout(updateFunction, 50);
      } else {
        updateFunction();
      }
    },
    [],
  );

  const dismissNotification = useCallback(() => {
    setNotificationDismissed(true);
  }, []);

  // ── Formatting ──

  const formatTransactionHash = useCallback((hash: string): string => {
    if (!hash || hash.length < 10) return hash;
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  }, []);

  const formatNumber = useCallback((num: number): string => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 4,
      minimumFractionDigits: 0,
    }).format(num);
  }, []);

  // ── Contract helpers ──

  const getCurrencyTokenAddress = useCallback(async (): Promise<string> => {
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
    } catch {
      const tusdcContract = getContractData('TUSDC');
      setCurrencyTokenAddress(tusdcContract.address);
      return tusdcContract.address;
    }
  }, [currencyTokenAddress]);

  const getCurrentNonce = useCallback(async (userAddress: string): Promise<number> => {
    try {
      const fdfPairContract = getContractData('FDFPair');
      const usedNonce = await readContractCached({
        address: fdfPairContract.address as `0x${string}`,
        abi: fdfPairContract.abi as any,
        functionName: 'usedNonces',
        args: [userAddress],
      });
      return Number(usedNonce) + 1;
    } catch (error) {
      console.error('Error getting current nonce:', error);
      return 1;
    }
  }, []);

  const getCurrentSellNonce = useCallback(async (userAddress: string): Promise<number> => {
    try {
      const playerContract = getContractData('Player');
      const currentNonce = await readContractCached({
        address: playerContract.address as `0x${string}`,
        abi: playerContract.abi as any,
        functionName: 'getCurrentNonce',
        args: [userAddress],
      });
      return Number(currentNonce) + 1;
    } catch (error) {
      console.error('Error getting current sell nonce:', error);
      return 1;
    }
  }, []);

  // ── USDC approval ──

  const approveUSDC = useCallback(
    async (amount: bigint): Promise<void> => {
      if (!user?.wallet?.address || !isAuthenticated) throw new Error('Wallet not connected');
      const currencyAddress = await getCurrencyTokenAddress();
      const fdfPairContract = getContractData('FDFPair');

      // Check current allowance
      try {
        const currentAllowance = await readContractCached({
          address: currencyAddress as `0x${string}`,
          abi: [
            {
              name: 'allowance',
              type: 'function',
              inputs: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
              ],
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
            },
          ],
          functionName: 'allowance',
          args: [user.wallet.address as `0x${string}`, fdfPairContract.address as `0x${string}`],
        });
        if ((currentAllowance as bigint) >= amount) {
          console.log('Sufficient allowance exists, skipping approval');
          return;
        }
      } catch {
        // If we can't check, continue with approval
      }

      const erc20ApproveAbi = [
        {
          name: 'approve',
          type: 'function',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
        },
      ] as const;

      const data = encodeFunctionData({
        abi: erc20ApproveAbi,
        functionName: 'approve',
        args: [fdfPairContract.address as `0x${string}`, amount],
      });

      updateAlertState('pending', 'Approving USDC spending...', '');
      const result = await sendTransactionWithWallet({
        to: currencyAddress as `0x${string}`,
        data,
      });
      await publicClient.waitForTransactionReceipt({ hash: result.hash });
      updateAlertState('pending', 'Approved! Confirming transaction...', result.hash);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    },
    [user, isAuthenticated, publicClient, getCurrencyTokenAddress, sendTransactionWithWallet, updateAlertState],
  );

  // ── Buy tokens (FDFPair with EIP-712 signature) ──

  const buyTokens = useCallback(
    async (playerTokenId: number, tokenAmountToBuy: string, maxCurrencySpend: string): Promise<void> => {
      if (!user?.wallet?.address || !isAuthenticated) throw new Error('Wallet not connected');

      const fdfPairContract = getContractData('FDFPair');
      const maxCurrencySpendBigInt = parseUnits(maxCurrencySpend, 6);
      const tokenAmountBigInt = parseUnits(tokenAmountToBuy, 18);

      if (maxCurrencySpendBigInt <= 0n) throw new Error('Currency spend amount must be greater than 0');
      if (tokenAmountBigInt <= 0n) throw new Error('Token amount must be greater than 0');

      // Validate pool exists
      try {
        const poolInfo = await readContractCached({
          address: fdfPairContract.address as `0x${string}`,
          abi: fdfPairContract.abi as any,
          functionName: 'getPoolInfo',
          args: [[BigInt(playerTokenId)]],
        });
        const [currencyReserves] = poolInfo as [bigint[], bigint[]];
        if (!currencyReserves[0] || currencyReserves[0] === 0n) {
          throw new Error(`No liquidity pool found for player ${playerTokenId}`);
        }
      } catch {
        throw new Error(`Player ${playerTokenId} is not available for trading`);
      }

      // Approve USDC
      updateAlertState('pending', 'Step 1/2: Approving USDC spending...', '');
      await approveUSDC(maxCurrencySpendBigInt);
      updateAlertState('pending', 'Step 2/2: Preparing purchase transaction...', '');

      const deadline = Math.floor(Date.now() / 1000) + 300;

      // Try backend signature, fallback to local
      let signature: string;
      let nonce: number;
      let transactionId: string | null = null;

      try {
        const hasAuthToken = localStorage.getItem('authToken');
        if (!hasAuthToken) throw new Error('No authentication token found');

        const signatureRequest = {
          playerTokenIds: [playerTokenId.toString()],
          amounts: [tokenAmountBigInt.toString()],
          maxCurrencySpend: maxCurrencySpendBigInt.toString(),
          deadline,
        };

        const signatureResponse = await apiService.prepareSignature(signatureRequest);
        signature = signatureResponse.signature;
        nonce = signatureResponse.txData.nonce;
        transactionId = signatureResponse.transactionId;

        if (!signature || !signature.startsWith('0x')) {
          throw new Error(`Invalid signature format from backend: ${signature}`);
        }
      } catch (backendError) {
        console.warn('Backend signature failed, falling back to local:', backendError);

        nonce = await getCurrentNonce(user.wallet.address);

        const signatureData = {
          buyer: user.wallet.address,
          playerTokenIds: [playerTokenId],
          amounts: [tokenAmountBigInt.toString()],
          maxCurrencySpend: maxCurrencySpendBigInt.toString(),
          deadline,
          nonce,
        };

        const domain = createEIP712Domain(fdfPairContract.address);
        const typedData = createBuyTokensTypedData(domain, signatureData);
        validateSignatureParams(signatureData);

        const signResult = await signTypedData(typedData, {
          uiOptions: { title: 'Sign Transaction', description: 'Sign to complete your purchase', buttonText: 'Sign' },
        });

        signature = extractSignature(signResult);
      }

      // Encode and send transaction
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
          BigInt(nonce),
        ],
      });

      updateAlertState('pending', 'Confirming purchase... Please check your wallet!', '');
      const result = await sendTransactionWithWallet({
        to: fdfPairContract.address as `0x${string}`,
        data,
      });
      updateAlertState('pending', 'Waiting for purchase confirmation...', result.hash);
      await publicClient.waitForTransactionReceipt({ hash: result.hash });

      // Confirm with backend if backend signature was used
      if (transactionId) {
        try {
          await apiService.confirmTransaction(transactionId, result.hash);
        } catch (confirmError) {
          console.error('Failed to confirm transaction with backend:', confirmError);
        }
      }

      updateAlertState('success', 'Successfully bought player tokens!', result.hash);
    },
    [user, isAuthenticated, publicClient, approveUSDC, getCurrentNonce, signTypedData, sendTransactionWithWallet, updateAlertState],
  );

  // ── Sell tokens (Player contract with EIP-712 signature) ──

  const sellTokens = useCallback(
    async (playerTokenId: number, tokenAmountToSell: string, minCurrencyToReceive: string): Promise<void> => {
      if (!user?.wallet?.address || !isAuthenticated) throw new Error('Wallet not connected');

      const playerContract = getContractData('Player');
      const minCurrencyBigInt = parseUnits(minCurrencyToReceive, 6);
      const tokenAmountBigInt = parseUnits(tokenAmountToSell, 18);

      if (minCurrencyBigInt <= 0n) throw new Error('Minimum currency to receive must be greater than 0');
      if (tokenAmountBigInt <= 0n) throw new Error('Token amount must be greater than 0');

      // Verify balance
      try {
        const playerBalance = await readContractCached({
          address: playerContract.address as `0x${string}`,
          abi: playerContract.abi as any,
          functionName: 'balanceOf',
          args: [user.wallet.address as `0x${string}`, BigInt(playerTokenId)],
        });
        if ((playerBalance as bigint) < tokenAmountBigInt) {
          throw new Error(
            `Insufficient player token balance. You have ${formatUnits(playerBalance as bigint, 18)} tokens but need ${tokenAmountToSell} tokens`,
          );
        }
      } catch (balanceError) {
        if (balanceError instanceof Error && balanceError.message.includes('Insufficient')) throw balanceError;
        throw new Error(`Unable to verify player token balance`);
      }

      // Verify sellable
      try {
        const isSellable = await readContractCached({
          address: playerContract.address as `0x${string}`,
          abi: playerContract.abi as any,
          functionName: 'isSellable',
          args: [BigInt(playerTokenId)],
        });
        if (!isSellable) throw new Error(`Player ${playerTokenId} is not currently sellable`);
      } catch (sellableError) {
        if (sellableError instanceof Error && sellableError.message.includes('not currently sellable')) throw sellableError;
        throw new Error(`Player ${playerTokenId} is not available for selling`);
      }

      const deadline = Math.floor(Date.now() / 1000) + 300;

      // Try backend signature, fallback to local
      let signature: string;
      let nonce: number;
      let transactionId: string | null = null;

      try {
        const hasAuthToken = localStorage.getItem('authToken');
        if (!hasAuthToken) throw new Error('No authentication token found');

        const signatureRequest: SellTokensRequest = {
          playerTokenIds: [playerTokenId.toString()],
          amounts: [tokenAmountBigInt.toString()],
          minCurrencyToReceive: Number(minCurrencyBigInt),
          deadline,
        };

        const signatureResponse = await apiService.prepareSellSignature(signatureRequest);
        signature = signatureResponse.signature;
        nonce = signatureResponse.txData?.nonce;
        transactionId = signatureResponse.transactionId;

        if (nonce === undefined || nonce === null) {
          nonce = await getCurrentSellNonce(user.wallet.address);
        }

        if (!signature || !signature.startsWith('0x')) {
          throw new Error(`Invalid signature format from backend: ${signature}`);
        }
      } catch (backendError) {
        console.warn('Backend sell signature failed, falling back to local:', backendError);

        nonce = await getCurrentSellNonce(user.wallet.address);

        const signatureData = {
          seller: user.wallet.address,
          playerTokenIds: [playerTokenId],
          amounts: [tokenAmountBigInt.toString()],
          minCurrencyToReceive: minCurrencyBigInt.toString(),
          deadline,
          nonce,
        };

        const domain = createPlayerEIP712Domain(playerContract.address);
        const typedData = createSellTokensTypedData(domain, signatureData);
        validateSellSignatureParams(signatureData);

        const signResult = await signTypedData(typedData, {
          uiOptions: { title: 'Sign Sale', description: 'Sign to complete your sale', buttonText: 'Sign' },
        });

        signature = extractSignature(signResult);
      }

      // Encode and send transaction
      const data = encodeFunctionData({
        abi: playerContract.abi,
        functionName: 'sellTokens',
        args: [
          [BigInt(playerTokenId)],
          [tokenAmountBigInt],
          minCurrencyBigInt,
          BigInt(deadline),
          signature as `0x${string}`,
          BigInt(nonce),
        ],
      });

      updateAlertState('pending', 'Confirming sale... Please check your wallet!', '');
      const result = await sendTransactionWithWallet({
        to: playerContract.address as `0x${string}`,
        data,
      });
      updateAlertState('pending', 'Waiting for sale confirmation...', result.hash);
      await publicClient.waitForTransactionReceipt({ hash: result.hash });

      // Confirm with backend if backend signature was used
      if (transactionId) {
        try {
          await apiService.confirmSellTransaction(transactionId, result.hash);
        } catch (confirmError) {
          console.error('Failed to confirm sell transaction with backend:', confirmError);
        }
      }

      updateAlertState('success', 'Successfully sold player tokens!', result.hash);
    },
    [user, isAuthenticated, publicClient, getCurrentSellNonce, signTypedData, sendTransactionWithWallet, updateAlertState],
  );

  // ── Main confirm handler ──

  const handleConfirm = useCallback(
    async (deps: HandleConfirmDeps): Promise<void> => {
      if (!player) return;

      if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
        updateAlertState('error', 'Please enter a valid amount');
        return;
      }
      if (!isAuthenticated || !user?.wallet?.address) {
        updateAlertState('error', 'Please connect your wallet first');
        return;
      }

      // Balance check for buy
      if (action === 'buy') {
        const userBalance = parseFloat(deps.userUsdcBalance);
        const requiredAmount = parseFloat(usdcAmount);
        if (userBalance < requiredAmount) {
          updateAlertState(
            'error',
            `Insufficient USDC balance. You have ${userBalance.toFixed(2)} USDC but need ${requiredAmount.toFixed(2)} USDC`,
          );
          return;
        }
      }

      setIsLoading(true);
      updateAlertState('pending', `${action === 'buy' ? 'Purchasing' : 'Selling'} ${player.name} tokens...`);

      try {
        if (deps.tradingPhase === TradingPhase.BondingCurve) {
          // ═══ BONDING CURVE TRADING ═══
          if (action === 'buy') {
            const tokenAmount =
              deps.quote.amountToReceive > 0n
                ? formatUnits(deps.quote.amountToReceive, 18)
                : (parseFloat(usdcAmount) / deps.currentPrice).toString();
            const maxSpend = (parseFloat(usdcAmount) * (1 + slippage / 100)).toString();

            await deps.bondingCurveTrade.buy({
              playerId: player.id,
              tokenAmount,
              maxCurrencySpend: maxSpend,
            });
          } else {
            const minReceive =
              deps.quote.amountToReceive > 0n
                ? formatUnits(
                    (deps.quote.amountToReceive * BigInt(10000 - Math.floor(slippage * 100))) / 10000n,
                    6,
                  )
                : (parseFloat(usdcAmount) * deps.currentPrice * (1 - slippage / 100)).toString();

            await deps.bondingCurveTrade.sell({
              playerId: player.id,
              tokenAmount: usdcAmount,
              minCurrencyToReceive: minReceive,
            });
          }

          deps.refreshPhase();
          deps.refreshTokenBalance();
          await deps.checkUserUsdcBalance();
          updateAlertState(
            'success',
            `Successfully ${action === 'buy' ? 'bought' : 'sold'} tokens!`,
            deps.bondingCurveTrade.transactionHash,
          );
        } else {
          // ═══ FDFPAIR TRADING ═══
          if (action === 'buy') {
            const tokenAmount =
              deps.quote.amountToReceive > 0n
                ? formatUnits(deps.quote.amountToReceive, 18)
                : (parseFloat(usdcAmount) / deps.currentPrice).toString();
            const maxCurrencyWithSlippage = (parseFloat(usdcAmount) * (1 + slippage / 100)).toString();

            const userBal = parseFloat(deps.userUsdcBalance);
            const maxSpendAmount = parseFloat(maxCurrencyWithSlippage);
            if (userBal < maxSpendAmount) {
              updateAlertState(
                'error',
                `Insufficient USDC. You have ${userBal.toFixed(2)} but may need ${maxSpendAmount.toFixed(2)} with ${slippage}% slippage`,
              );
              setIsLoading(false);
              return;
            }

            await buyTokens(player.id, tokenAmount, maxCurrencyWithSlippage);
          } else {
            const minCurrency =
              deps.quote.amountToReceive > 0n
                ? formatUnits(
                    (deps.quote.amountToReceive * BigInt(10000 - Math.floor(slippage * 100))) / 10000n,
                    6,
                  )
                : (parseFloat(usdcAmount) * deps.currentPrice * (1 - slippage / 100)).toString();

            await sellTokens(player.id, usdcAmount, minCurrency);
          }
        }

        // Call optional callback
        if (deps.onPurchase) {
          await deps.onPurchase(player, usdcAmount, action, slippage);
        }
      } catch (error) {
        console.error('Transaction failed:', error);
        const errorMessage = parseTransactionError(error);
        updateAlertState('error', `Transaction failed: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    },
    [player, usdcAmount, action, slippage, isAuthenticated, user, buyTokens, sellTokens, updateAlertState],
  );

  // ── Reset form ──

  const resetForm = useCallback(() => {
    setUsdcAmount('');
    setAction('buy');
    setSlippage(0.5);
    setShowBuySellMenu(false);
    updateAlertState('idle');
  }, [updateAlertState]);

  return {
    // Form state
    usdcAmount,
    setUsdcAmount,
    action,
    setAction,
    slippage,
    setSlippage,
    isLoading,
    showBuySellMenu,
    setShowBuySellMenu,

    // Alert
    alertState: {
      transactionStatus,
      statusMessage,
      transactionHash,
      showAlert,
      notificationDismissed,
      alertKey,
    },
    updateAlertState,
    dismissNotification,

    // Handlers
    handleConfirm,
    resetForm,

    // Formatting
    formatTransactionHash,
    formatNumber,
  };
}

// ─── Utilities ───

/** Extract a hex signature string from various Privy signTypedData response formats */
function extractSignature(signResult: unknown): string {
  let signature: string;
  if (typeof signResult === 'string') {
    signature = signResult;
  } else if (signResult && typeof signResult === 'object') {
    signature =
      (signResult as any).signature ||
      (signResult as any).sig ||
      (signResult as any).data ||
      signResult.toString();
  } else {
    throw new Error('Invalid signature response');
  }

  if (!signature || !signature.startsWith('0x')) {
    throw new Error(`Invalid signature format: ${signature}`);
  }

  return signature;
}

/** Map common contract/wallet errors to user-friendly messages */
function parseTransactionError(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown error occurred';

  const msg = error.message;

  if (msg.includes('InvalidSignature')) return 'Invalid signature - ensure txSigner wallet is used';
  if (msg.includes('InvalidNonce')) return 'Invalid nonce - transaction may be out of order';
  if (msg.includes('DEADLINE_EXCEEDED')) return 'Transaction deadline exceeded';
  if (msg.includes('MAX_CURRENCY_AMOUNT_EXCEEDED')) return 'Price increased beyond max spend limit';
  if (msg.includes('PlayerNotBuyable')) return 'One or more players are not buyable';
  if (msg.includes('PlayerNotSellable')) return 'One or more players are not sellable';
  if (msg.includes('INSUFFICIENT_CURRENCY_AMOUNT')) return 'Insufficient USDC balance for this purchase';
  if (msg.includes('INSUFFICIENT_LIQUIDITY')) return 'Insufficient liquidity in the pool for this trade';
  if (msg.includes('Insufficient player token balance')) return msg;
  if (msg.includes('User rejected')) return 'Transaction was cancelled by user';
  if (msg.includes('insufficient funds')) return 'Insufficient balance to pay for gas fees';

  return msg;
}
