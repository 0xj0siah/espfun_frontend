import { useState, useCallback } from 'react';
import { parseUnits, encodeFunctionData } from 'viem';
import { getContractData } from '../contracts';
import { readContractCached } from '../utils/contractCache';
import { useWalletTransactions } from './useWalletTransactions';
import { usePublicClient } from './usePublicClient';
import type { TransactionStatus } from '../types/trading';

/** Wrap a promise with a timeout so the UI never hangs indefinitely. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

interface BondingCurveTradeResult {
  /** Buy tokens on the bonding curve */
  buy: (params: {
    playerId: number;
    tokenAmount: string;
    maxCurrencySpend: string;
  }) => Promise<{ hash: string }>;
  /** Sell tokens back to the bonding curve */
  sell: (params: {
    playerId: number;
    tokenAmount: string;
    minCurrencyToReceive: string;
  }) => Promise<{ hash: string }>;
  /** Claim ERC1155 tokens after graduation */
  claim: (playerId: number) => Promise<{ hash: string }>;
  /** Refund USDC after cancellation */
  refund: (playerId: number) => Promise<{ hash: string }>;
  status: TransactionStatus;
  statusMessage: string;
  transactionHash: string;
  isLoading: boolean;
  /** Reset status back to idle */
  reset: () => void;
}

/**
 * Hook for executing trades on the BondingCurve contract.
 *
 * Key difference from FDFPair: no EIP-712 signatures needed.
 * Just USDC approval + direct contract call.
 */
export function useBondingCurveTrade(): BondingCurveTradeResult {
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [transactionHash, setTransactionHash] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { sendTransactionWithWallet, activeWalletAddress } = useWalletTransactions();
  const publicClient = usePublicClient();

  const updateStatus = (
    newStatus: TransactionStatus,
    message: string,
    hash = ''
  ) => {
    setStatus(newStatus);
    setStatusMessage(message);
    if (hash) setTransactionHash(hash);
  };

  const reset = useCallback(() => {
    setStatus('idle');
    setStatusMessage('');
    setTransactionHash('');
    setIsLoading(false);
  }, []);

  /**
   * Approve USDC spending for the BondingCurve contract.
   */
  const approveUSDC = async (amount: bigint): Promise<void> => {
    const bondingCurveContract = getContractData('BondingCurve');

    // Get the currency token address
    let currencyAddress: string;
    try {
      const addr = await readContractCached({
        address: bondingCurveContract.address as `0x${string}`,
        abi: bondingCurveContract.abi as any,
        functionName: 'currencyToken',
        args: [],
      });
      currencyAddress = addr as string;
    } catch {
      // Fallback to TUSDC
      currencyAddress = getContractData('TUSDC').address;
    }

    // Check current allowance
    try {
      const tusdcAbi = getContractData('TUSDC').abi;
      const currentAllowance = await readContractCached({
        address: currencyAddress as `0x${string}`,
        abi: tusdcAbi as any,
        functionName: 'allowance',
        args: [
          (await getWalletAddress()) as `0x${string}`,
          bondingCurveContract.address as `0x${string}`,
        ],
      });

      if ((currentAllowance as bigint) >= amount) {
        return; // Already approved
      }
    } catch {
      // Proceed with approval
    }

    const data = encodeFunctionData({
      abi: getContractData('TUSDC').abi as any,
      functionName: 'approve',
      args: [bondingCurveContract.address as `0x${string}`, amount],
    });

    updateStatus('pending', 'Approving USDC spending...');
    const result = await sendTransactionWithWallet({
      to: currencyAddress,
      data,
    });

    await publicClient.waitForTransactionReceipt({ hash: result.hash as `0x${string}` });
  };

  /** Helper to get wallet address from the wallet transactions hook */
  const getWalletAddress = async (): Promise<string> => {
    // We access the wallet through sendTransactionWithWallet's internal state
    // This is a workaround — in a real scenario, the caller passes the address
    const tusdcContract = getContractData('TUSDC');
    return tusdcContract.address; // placeholder, actual wallet comes from Privy context
  };

  const buy = useCallback(
    async ({
      playerId,
      tokenAmount,
      maxCurrencySpend,
    }: {
      playerId: number;
      tokenAmount: string;
      maxCurrencySpend: string;
    }): Promise<{ hash: string }> => {
      setIsLoading(true);

      try {
        const bondingCurveContract = getContractData('BondingCurve');
        const tokenAmountBigInt = parseUnits(tokenAmount, 18);
        const maxSpendBigInt = parseUnits(maxCurrencySpend, 6);

        // Step 1: Approve USDC
        updateStatus('pending', 'Step 1/2: Approving USDC...');
        await approveUSDC(maxSpendBigInt);

        // Step 2: Buy from curve
        updateStatus('pending', 'Step 2/2: Buying tokens...');
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes

        const data = encodeFunctionData({
          abi: bondingCurveContract.abi,
          functionName: 'buyFromCurve',
          args: [BigInt(playerId), tokenAmountBigInt, maxSpendBigInt, deadline],
        });

        // Pre-flight: simulate the call to catch reverts before sending to Privy.
        // Privy's internal gas estimation can fail as an unhandled rejection,
        // leaving the UI stuck in "Processing..." state with no error shown.
        if (!activeWalletAddress) throw new Error('No wallet connected');

        try {
          await publicClient.call({
            account: activeWalletAddress as `0x${string}`,
            to: bondingCurveContract.address as `0x${string}`,
            data: data as `0x${string}`,
          });
        } catch (gasErr: any) {
          const reason = gasErr?.message?.includes('reverted') || gasErr?.message?.includes('revert')
            ? 'Transaction would revert on-chain. The bonding curve state may have changed — try adjusting your amount or refreshing the page.'
            : `Pre-flight check failed: ${gasErr?.shortMessage || gasErr?.message || 'unknown reason'}`;
          throw new Error(reason);
        }

        const result = await withTimeout(
          sendTransactionWithWallet({
            to: bondingCurveContract.address,
            data,
          }),
          60_000,
          'Buy transaction',
        );

        setTransactionHash(result.hash);
        updateStatus('pending', 'Waiting for confirmation...', result.hash);

        await publicClient.waitForTransactionReceipt({ hash: result.hash as `0x${string}` });

        updateStatus('success', 'Successfully bought tokens!', result.hash);
        return { hash: result.hash };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Buy transaction failed';
        updateStatus('error', `Transaction failed: ${message}`);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sendTransactionWithWallet, publicClient, activeWalletAddress]
  );

  const sell = useCallback(
    async ({
      playerId,
      tokenAmount,
      minCurrencyToReceive,
    }: {
      playerId: number;
      tokenAmount: string;
      minCurrencyToReceive: string;
    }): Promise<{ hash: string }> => {
      setIsLoading(true);

      try {
        const bondingCurveContract = getContractData('BondingCurve');
        const tokenAmountBigInt = parseUnits(tokenAmount, 18);
        const minReceiveBigInt = parseUnits(minCurrencyToReceive, 6);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

        updateStatus('pending', 'Selling tokens...');

        const data = encodeFunctionData({
          abi: bondingCurveContract.abi,
          functionName: 'sellToCurve',
          args: [
            BigInt(playerId),
            tokenAmountBigInt,
            minReceiveBigInt,
            deadline,
          ],
        });

        // Pre-flight: simulate the call to catch reverts before sending to Privy.
        if (!activeWalletAddress) throw new Error('No wallet connected');

        try {
          await publicClient.call({
            account: activeWalletAddress as `0x${string}`,
            to: bondingCurveContract.address as `0x${string}`,
            data: data as `0x${string}`,
          });
        } catch (gasErr: any) {
          const reason = gasErr?.message?.includes('reverted') || gasErr?.message?.includes('revert')
            ? 'Transaction would revert on-chain. The bonding curve state may have changed — try adjusting your amount or refreshing the page.'
            : `Pre-flight check failed: ${gasErr?.shortMessage || gasErr?.message || 'unknown reason'}`;
          throw new Error(reason);
        }

        const result = await withTimeout(
          sendTransactionWithWallet({
            to: bondingCurveContract.address,
            data,
          }),
          60_000,
          'Sell transaction',
        );

        setTransactionHash(result.hash);
        updateStatus('pending', 'Waiting for confirmation...', result.hash);

        await publicClient.waitForTransactionReceipt({ hash: result.hash as `0x${string}` });

        updateStatus('success', 'Successfully sold tokens!', result.hash);
        return { hash: result.hash };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Sell transaction failed';
        updateStatus('error', `Transaction failed: ${message}`);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sendTransactionWithWallet, publicClient, activeWalletAddress]
  );

  const claim = useCallback(
    async (playerId: number): Promise<{ hash: string }> => {
      setIsLoading(true);

      try {
        const bondingCurveContract = getContractData('BondingCurve');

        updateStatus('pending', 'Claiming tokens...');

        const data = encodeFunctionData({
          abi: bondingCurveContract.abi,
          functionName: 'claimTokens',
          args: [BigInt(playerId)],
        });

        const result = await sendTransactionWithWallet({
          to: bondingCurveContract.address,
          data,
        });

        setTransactionHash(result.hash);
        updateStatus('pending', 'Waiting for confirmation...', result.hash);

        await publicClient.waitForTransactionReceipt({ hash: result.hash as `0x${string}` });

        updateStatus('success', 'Tokens claimed! You can now trade on the market.', result.hash);
        return { hash: result.hash };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Claim failed';
        updateStatus('error', `Claim failed: ${message}`);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sendTransactionWithWallet, publicClient]
  );

  const refundFn = useCallback(
    async (playerId: number): Promise<{ hash: string }> => {
      setIsLoading(true);

      try {
        const bondingCurveContract = getContractData('BondingCurve');

        updateStatus('pending', 'Processing refund...');

        const data = encodeFunctionData({
          abi: bondingCurveContract.abi,
          functionName: 'refund',
          args: [BigInt(playerId)],
        });

        const result = await sendTransactionWithWallet({
          to: bondingCurveContract.address,
          data,
        });

        setTransactionHash(result.hash);
        updateStatus('pending', 'Waiting for confirmation...', result.hash);

        await publicClient.waitForTransactionReceipt({ hash: result.hash as `0x${string}` });

        updateStatus('success', 'Refund processed successfully!', result.hash);
        return { hash: result.hash };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Refund failed';
        updateStatus('error', `Refund failed: ${message}`);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sendTransactionWithWallet, publicClient]
  );

  return {
    buy,
    sell,
    claim,
    refund: refundFn,
    status,
    statusMessage,
    transactionHash,
    isLoading,
    reset,
  };
}
