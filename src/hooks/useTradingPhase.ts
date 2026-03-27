import { useState, useEffect, useRef } from 'react';
import { getContractData } from '../contracts';
import { readContractCached } from '../utils/contractCache';
import { TradingPhase, type LaunchInfo, type LaunchProgress } from '../types/trading';

interface TradingPhaseResult {
  phase: TradingPhase;
  launch: LaunchInfo | null;
  progress: LaunchProgress | null;
  userCurveBalance: bigint;
  loading: boolean;
  error: string | null;
  /** Re-fetch phase data (e.g. after a transaction) */
  refresh: () => void;
}

/**
 * Detects whether a player is in the bonding curve or FDFPair trading phase.
 * Calls BondingCurve.getLaunchInfo() on-chain.
 * Falls back to FDFPair if BondingCurve contract is not deployed (address is zero).
 */
export function useTradingPhase(
  playerId: number | null,
  walletAddress?: string
): TradingPhaseResult {
  const [phase, setPhase] = useState<TradingPhase>(TradingPhase.Unknown);
  const [launch, setLaunch] = useState<LaunchInfo | null>(null);
  const [progress, setProgress] = useState<LaunchProgress | null>(null);
  const [userCurveBalance, setUserCurveBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshCounter = useRef(0);

  const fetchPhase = async () => {
    if (!playerId) {
      setPhase(TradingPhase.Unknown);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const bondingCurveContract = getContractData('BondingCurve');

      // If BondingCurve address is zero, skip and default to FDFPair
      if (
        !bondingCurveContract.address ||
        bondingCurveContract.address === '0x0000000000000000000000000000000000000000'
      ) {
        setPhase(TradingPhase.FDFPair);
        setLaunch(null);
        setProgress(null);
        setUserCurveBalance(0n);
        setLoading(false);
        return;
      }

      // Fetch launch info
      let launchData: LaunchInfo;
      try {
        const result = await readContractCached({
          address: bondingCurveContract.address as `0x${string}`,
          abi: bondingCurveContract.abi as any,
          functionName: 'getLaunchInfo',
          args: [BigInt(playerId)],
        });

        // getLaunchInfo returns a Launch struct tuple
        const r = result as any;
        launchData = {
          playerId: r.playerId ?? r[0] ?? 0n,
          totalTokensForSale: r.totalTokensForSale ?? r[1] ?? 0n,
          tokensSold: r.tokensSold ?? r[2] ?? 0n,
          currencyCollected: r.currencyCollected ?? r[3] ?? 0n,
          tokensForLiquidity: r.tokensForLiquidity ?? r[4] ?? 0n,
          fundingTarget: r.fundingTarget ?? r[5] ?? 0n,
          virtualTokenReserve: r.virtualTokenReserve ?? r[6] ?? 0n,
          virtualCurrencyReserve: r.virtualCurrencyReserve ?? r[7] ?? 0n,
          createdAt: r.createdAt ?? r[8] ?? 0n,
          deadline: r.deadline ?? r[9] ?? 0n,
          graduated: r.graduated ?? r[10] ?? false,
          cancelled: r.cancelled ?? r[11] ?? false,
        };
      } catch {
        // Contract call failed — no launch exists or contract not deployed
        setPhase(TradingPhase.FDFPair);
        setLaunch(null);
        setProgress(null);
        setUserCurveBalance(0n);
        setLoading(false);
        return;
      }

      setLaunch(launchData);

      // No launch exists for this player
      if (launchData.totalTokensForSale === 0n) {
        setPhase(TradingPhase.FDFPair);
        setProgress(null);
        setUserCurveBalance(0n);
        setLoading(false);
        return;
      }

      // Launch was cancelled
      if (launchData.cancelled) {
        // Fetch user balance for refund display
        if (walletAddress) {
          try {
            const balance = await readContractCached({
              address: bondingCurveContract.address as `0x${string}`,
              abi: bondingCurveContract.abi as any,
              functionName: 'getUserBalance',
              args: [BigInt(playerId), walletAddress],
            }) as bigint;
            setUserCurveBalance(balance);
          } catch {
            setUserCurveBalance(0n);
          }
        }
        setPhase(TradingPhase.Cancelled);
        setProgress(null);
        setLoading(false);
        return;
      }

      // Launch graduated
      if (launchData.graduated) {
        // Check if user has unclaimed tokens
        if (walletAddress) {
          try {
            const balance = await readContractCached({
              address: bondingCurveContract.address as `0x${string}`,
              abi: bondingCurveContract.abi as any,
              functionName: 'getUserBalance',
              args: [BigInt(playerId), walletAddress],
            }) as bigint;
            setUserCurveBalance(balance);

            if (balance > 0n) {
              setPhase(TradingPhase.Graduated);
            } else {
              setPhase(TradingPhase.FDFPair);
            }
          } catch {
            setUserCurveBalance(0n);
            setPhase(TradingPhase.FDFPair);
          }
        } else {
          setPhase(TradingPhase.FDFPair);
          setUserCurveBalance(0n);
        }
        setProgress(null);
        setLoading(false);
        return;
      }

      // Active bonding curve
      setPhase(TradingPhase.BondingCurve);

      // Fetch progress
      try {
        const progressResult = await readContractCached({
          address: bondingCurveContract.address as `0x${string}`,
          abi: bondingCurveContract.abi as any,
          functionName: 'getProgress',
          args: [BigInt(playerId)],
        }) as [bigint, bigint, bigint];

        setProgress({
          raised: progressResult[0],
          target: progressResult[1],
          percentComplete: Number(progressResult[2]),
        });
      } catch {
        setProgress(null);
      }

      // Fetch user's internal balance
      if (walletAddress) {
        try {
          const balance = await readContractCached({
            address: bondingCurveContract.address as `0x${string}`,
            abi: bondingCurveContract.abi as any,
            functionName: 'getUserBalance',
            args: [BigInt(playerId), walletAddress],
          }) as bigint;
          setUserCurveBalance(balance);
        } catch {
          setUserCurveBalance(0n);
        }
      }
    } catch (err) {
      console.error('useTradingPhase error:', err);
      setError(err instanceof Error ? err.message : 'Failed to detect trading phase');
      // Default to FDFPair on error for backward compatibility
      setPhase(TradingPhase.FDFPair);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhase();
  }, [playerId, walletAddress, refreshCounter.current]);

  const refresh = () => {
    refreshCounter.current += 1;
    fetchPhase();
  };

  return { phase, launch, progress, userCurveBalance, loading, error, refresh };
}
