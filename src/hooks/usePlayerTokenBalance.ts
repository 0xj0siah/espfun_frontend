import { useState, useEffect, useRef, useCallback } from 'react';
import { formatUnits } from 'viem';
import { getContractData, isContractDeployed } from '../contracts';
import { readContractCached } from '../utils/contractCache';
import { TradingPhase } from '../types/trading';

interface PlayerTokenBalanceResult {
  /** Raw balance in wei */
  balance: bigint;
  /** Human-readable balance (18 decimals for tokens) */
  formattedBalance: string;
  loading: boolean;
  /** Re-fetch balance (e.g. after a transaction) */
  refresh: () => void;
}

/**
 * Phase-aware player token balance hook.
 *
 * - BondingCurve/Graduated: reads BondingCurve.getUserBalance() (internal balance)
 * - FDFPair: reads Player.balanceOf() (ERC1155 balance)
 */
export function usePlayerTokenBalance({
  playerId,
  walletAddress,
  phase,
}: {
  playerId: number | null;
  walletAddress: string | undefined;
  phase: TradingPhase;
}): PlayerTokenBalanceResult {
  const [balance, setBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const refreshCounter = useRef(0);

  const fetchBalance = useCallback(async () => {
    if (!playerId || !walletAddress) {
      setBalance(0n);
      return;
    }

    setLoading(true);

    try {
      if (
        phase === TradingPhase.BondingCurve ||
        phase === TradingPhase.Graduated ||
        phase === TradingPhase.Cancelled
      ) {
        // Internal balance on bonding curve
        const bondingCurveContract = getContractData('BondingCurve');
        if (isContractDeployed('BondingCurve')) {
          const result = await readContractCached({
            address: bondingCurveContract.address as `0x${string}`,
            abi: bondingCurveContract.abi as any,
            functionName: 'getUserBalance',
            args: [BigInt(playerId), walletAddress],
          });
          setBalance(result as bigint);
        } else {
          setBalance(0n);
        }
      } else {
        // ERC1155 balance from Player contract
        const playerContract = getContractData('Player');
        const result = await readContractCached({
          address: playerContract.address as `0x${string}`,
          abi: playerContract.abi as any,
          functionName: 'balanceOf',
          args: [walletAddress as `0x${string}`, BigInt(playerId)],
        });
        setBalance(result as bigint);
      }
    } catch (err) {
      console.error('usePlayerTokenBalance error:', err);
      setBalance(0n);
    } finally {
      setLoading(false);
    }
  }, [playerId, walletAddress, phase]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, refreshCounter.current]);

  const refresh = useCallback(() => {
    refreshCounter.current += 1;
    fetchBalance();
  }, [fetchBalance]);

  const formattedBalance = formatUnits(balance, 18);

  return { balance, formattedBalance, loading, refresh };
}
