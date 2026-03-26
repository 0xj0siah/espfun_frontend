import { useState, useEffect, useCallback, useRef } from 'react';
import { formatUnits } from 'viem';
import { readContractCached, contractCache } from '../utils/contractCache';
import { CONTRACT_ADDRESSES, CONTRACTS } from '../contracts';

const ZERO = BigInt(0);
const POLL_INTERVAL = 30_000; // 30 seconds

interface StakingFormatted {
  totalStaked: string;
  stakerSharePercent: string;
  totalRewardsDistributed: string;
  undistributedRewards: string;
  userStakedAmount: string;
  userPendingRewards: string;
  userEspBalance: string;
  userSharePercent: string;
}

interface StakingData {
  // Global stats (raw bigints)
  totalStaked: bigint;
  stakerShareBps: number;
  totalRewardsDistributed: bigint;
  undistributedRewards: bigint;
  isPaused: boolean;

  // User-specific (raw bigints)
  userStakedAmount: bigint;
  userPendingRewards: bigint;
  userEspBalance: bigint;
  userEspAllowance: bigint;

  // Formatted strings for display
  formatted: StakingFormatted;

  // State
  loading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
}

function formatEsp(value: bigint): string {
  const num = parseFloat(formatUnits(value, 18));
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatUsdc(value: bigint): string {
  const num = parseFloat(formatUnits(value, 6));
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function useStaking(walletAddress?: string): StakingData {
  const [totalStaked, setTotalStaked] = useState<bigint>(ZERO);
  const [stakerShareBps, setStakerShareBps] = useState<number>(0);
  const [totalRewardsDistributed, setTotalRewardsDistributed] = useState<bigint>(ZERO);
  const [undistributedRewards, setUndistributedRewards] = useState<bigint>(ZERO);
  const [isPaused, setIsPaused] = useState(false);

  const [userStakedAmount, setUserStakedAmount] = useState<bigint>(ZERO);
  const [userPendingRewards, setUserPendingRewards] = useState<bigint>(ZERO);
  const [userEspBalance, setUserEspBalance] = useState<bigint>(ZERO);
  const [userEspAllowance, setUserEspAllowance] = useState<bigint>(ZERO);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  const isContractDeployed =
    CONTRACT_ADDRESSES.ESPStaking !== '0x0000000000000000000000000000000000000000' &&
    CONTRACT_ADDRESSES.ESP !== '0x0000000000000000000000000000000000000000';

  const fetchStakingData = useCallback(async () => {
    if (!isContractDeployed) {
      setLoading(false);
      setError('Staking contract not yet deployed');
      return;
    }

    try {
      const stakingContract = CONTRACTS.ESPStaking;
      const espContract = CONTRACTS.ESP;
      const addr = stakingContract.address as `0x${string}`;
      const abi = stakingContract.abi as any[];

      // Global reads
      const [totalStakedResult, shareBpsResult, totalDistResult, undistResult, pausedResult] =
        await Promise.all([
          readContractCached({ address: addr, abi, functionName: 'totalStaked' }),
          readContractCached({ address: addr, abi, functionName: 'stakerShareBps' }),
          readContractCached({ address: addr, abi, functionName: 'totalRewardsDistributed' }),
          readContractCached({ address: addr, abi, functionName: 'undistributedRewards' }),
          readContractCached({ address: addr, abi, functionName: 'paused' }),
        ]);

      if (!mountedRef.current) return;

      setTotalStaked(totalStakedResult as bigint);
      setStakerShareBps(Number(shareBpsResult));
      setTotalRewardsDistributed(totalDistResult as bigint);
      setUndistributedRewards(undistResult as bigint);
      setIsPaused(pausedResult as boolean);

      // User-specific reads
      if (walletAddress) {
        const userAddr = walletAddress as `0x${string}`;
        const espAddr = espContract.address as `0x${string}`;
        const espAbi = espContract.abi as any[];

        const [userInfoResult, pendingResult, espBalResult, espAllowResult] =
          await Promise.all([
            readContractCached({
              address: addr, abi, functionName: 'getUserInfo', args: [userAddr],
            }),
            readContractCached({
              address: addr, abi, functionName: 'pendingReward', args: [userAddr],
            }),
            readContractCached({
              address: espAddr, abi: espAbi, functionName: 'balanceOf', args: [userAddr],
            }),
            readContractCached({
              address: espAddr, abi: espAbi, functionName: 'allowance', args: [userAddr, addr],
            }),
          ]);

        if (!mountedRef.current) return;

        // getUserInfo returns [stakedAmount, pendingRewards]
        const userInfo = userInfoResult as [bigint, bigint];
        setUserStakedAmount(userInfo[0]);
        setUserPendingRewards(pendingResult as bigint);
        setUserEspBalance(espBalResult as bigint);
        setUserEspAllowance(espAllowResult as bigint);
      } else {
        setUserStakedAmount(ZERO);
        setUserPendingRewards(ZERO);
        setUserEspBalance(ZERO);
        setUserEspAllowance(ZERO);
      }

      setError(null);
    } catch (err: any) {
      console.error('useStaking: fetch error', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to load staking data');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [walletAddress, isContractDeployed]);

  const refresh = useCallback(async () => {
    if (isContractDeployed) {
      contractCache.invalidateCache(CONTRACT_ADDRESSES.ESPStaking);
      contractCache.invalidateCache(CONTRACT_ADDRESSES.ESP);
    }
    await fetchStakingData();
  }, [fetchStakingData, isContractDeployed]);

  // Initial fetch + poll
  useEffect(() => {
    mountedRef.current = true;
    fetchStakingData();

    const interval = setInterval(fetchStakingData, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchStakingData]);

  // Formatted values
  const userSharePercent =
    totalStaked > ZERO
      ? ((Number(userStakedAmount) / Number(totalStaked)) * 100).toFixed(2) + '%'
      : '0%';

  const formatted: StakingFormatted = {
    totalStaked: formatEsp(totalStaked),
    stakerSharePercent: (stakerShareBps / 100).toFixed(0) + '%',
    totalRewardsDistributed: formatUsdc(totalRewardsDistributed),
    undistributedRewards: formatUsdc(undistributedRewards),
    userStakedAmount: formatEsp(userStakedAmount),
    userPendingRewards: formatUsdc(userPendingRewards),
    userEspBalance: formatEsp(userEspBalance),
    userSharePercent,
  };

  return {
    totalStaked,
    stakerShareBps,
    totalRewardsDistributed,
    undistributedRewards,
    isPaused,
    userStakedAmount,
    userPendingRewards,
    userEspBalance,
    userEspAllowance,
    formatted,
    loading,
    error,
    refresh,
  };
}
