import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { motion } from 'motion/react';
import { Coins, TrendingUp, Wallet, Info, CheckCircle, XCircle, Loader2, ExternalLink, ArrowDownToLine, ArrowUpFromLine, Gift } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWalletTransactions } from '../hooks/useWalletTransactions';
import { getPreferredWallet } from '../utils/walletPreference';
import { useStaking } from '../hooks/useStaking';
import { usePublicClient } from '../hooks/usePublicClient';
import { parseUnits, encodeFunctionData } from 'viem';
import { CONTRACT_ADDRESSES, CONTRACTS, NETWORK_CONFIG, isContractDeployed as checkContractDeployed } from '../contracts';
import { toast } from 'sonner';
import { useRevenueHistory, useAnalyticsOverview } from '../hooks/useAnalytics';

type TxState = 'idle' | 'approving' | 'staking' | 'unstaking' | 'claiming' | 'distributing' | 'success' | 'error';

export default function StakingSection() {
  const { t } = useTranslation();
  const { login, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransactionWithWallet } = useWalletTransactions();
  const publicClient = usePublicClient();

  const walletAddress = getPreferredWallet(wallets)?.address;
  const staking = useStaking(walletAddress);

  // Form state
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // Transaction state
  const [txState, setTxState] = useState<TxState>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const isContractDeployed = checkContractDeployed('ESPStaking');

  // Real revenue data from backend
  const { data: revenueTimeline, totalDistributed, loading: revenueLoading, error: revenueError } = useRevenueHistory('daily', 30);
  const { data: analytics } = useAnalyticsOverview();

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const tickColor = isDark ? '#a1a1aa' : '#71717a';

  // Format revenue timeline for chart (matching TVL chart pattern)
  const revenueData = useMemo(() => {
    const tz = 'America/New_York';
    let data = revenueTimeline.map((snap: any) => {
      const d = new Date(snap.periodStart);
      const isValid = !isNaN(d.getTime());
      return {
        date: isValid
          ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })
          : '',
        fullDate: isValid
          ? d.toLocaleString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              timeZone: tz,
            })
          : '',
        usdc: Number(snap.totalFees) || 0,
      };
    });
    // Duplicate single data point so Recharts draws a visible line + area
    if (data.length === 1) {
      data = [{ ...data[0], date: '' }, data[0]];
    }
    return data;
  }, [revenueTimeline]);

  // Input validation
  const stakeError = useMemo(() => {
    if (!stakeAmount) return null;
    const num = parseFloat(stakeAmount);
    if (isNaN(num) || num <= 0) return 'Enter a valid amount';
    try {
      const amount = parseUnits(stakeAmount, 18);
      if (amount > staking.userEspBalance) return 'Insufficient ESP balance';
    } catch {
      return 'Enter a valid amount';
    }
    return null;
  }, [stakeAmount, staking.userEspBalance]);

  const unstakeError = useMemo(() => {
    if (!unstakeAmount) return null;
    const num = parseFloat(unstakeAmount);
    if (isNaN(num) || num <= 0) return 'Enter a valid amount';
    try {
      const amount = parseUnits(unstakeAmount, 18);
      if (amount > staking.userStakedAmount) return 'Exceeds staked amount';
    } catch {
      return 'Enter a valid amount';
    }
    return null;
  }, [unstakeAmount, staking.userStakedAmount]);

  const resetTxState = () => {
    setTxState('idle');
    setTxHash(null);
    setTxError(null);
  };

  // ── Stake ────────────────────────────────────────────────────
  const handleStake = async () => {
    if (!walletAddress || !stakeAmount) return;
    resetTxState();

    try {
      const amount = parseUnits(stakeAmount, 18);
      const stakingAddr = CONTRACT_ADDRESSES.ESPStaking as `0x${string}`;
      const espAddr = CONTRACT_ADDRESSES.ESP as `0x${string}`;

      // Check allowance and approve if needed
      if (staking.userEspAllowance < amount) {
        setTxState('approving');
        const approveData = encodeFunctionData({
          abi: CONTRACTS.ESP.abi as any,
          functionName: 'approve',
          args: [stakingAddr, amount],
        });
        const approveResult = await sendTransactionWithWallet({ to: espAddr, data: approveData });
        await publicClient.waitForTransactionReceipt({ hash: approveResult.hash as `0x${string}` });
      }

      // Stake
      setTxState('staking');
      const stakeData = encodeFunctionData({
        abi: CONTRACTS.ESPStaking.abi as any,
        functionName: 'stake',
        args: [amount],
      });
      const result = await sendTransactionWithWallet({ to: stakingAddr, data: stakeData });
      setTxHash(result.hash);
      await publicClient.waitForTransactionReceipt({ hash: result.hash as `0x${string}` });

      setTxState('success');
      toast.success(`Successfully staked ${stakeAmount} ESP`);
      setStakeAmount('');
      await staking.refresh();
    } catch (err: any) {
      console.error('Stake error:', err);
      setTxState('error');
      setTxError(err.message || 'Transaction failed');
      toast.error(err.message || 'Stake failed');
    }
  };

  // ── Unstake ──────────────────────────────────────────────────
  const handleUnstake = async () => {
    if (!walletAddress || !unstakeAmount) return;
    resetTxState();

    try {
      const amount = parseUnits(unstakeAmount, 18);
      const stakingAddr = CONTRACT_ADDRESSES.ESPStaking as `0x${string}`;

      setTxState('unstaking');
      const data = encodeFunctionData({
        abi: CONTRACTS.ESPStaking.abi as any,
        functionName: 'unstake',
        args: [amount],
      });
      const result = await sendTransactionWithWallet({ to: stakingAddr, data });
      setTxHash(result.hash);
      await publicClient.waitForTransactionReceipt({ hash: result.hash as `0x${string}` });

      setTxState('success');
      toast.success(`Successfully unstaked ${unstakeAmount} ESP`);
      setUnstakeAmount('');
      await staking.refresh();
    } catch (err: any) {
      console.error('Unstake error:', err);
      setTxState('error');
      setTxError(err.message || 'Transaction failed');
      toast.error(err.message || 'Unstake failed');
    }
  };

  // ── Claim ────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (!walletAddress) return;
    resetTxState();

    try {
      const stakingAddr = CONTRACT_ADDRESSES.ESPStaking as `0x${string}`;

      setTxState('claiming');
      const data = encodeFunctionData({
        abi: CONTRACTS.ESPStaking.abi as any,
        functionName: 'claimRewards',
        args: [],
      });
      const result = await sendTransactionWithWallet({ to: stakingAddr, data });
      setTxHash(result.hash);
      await publicClient.waitForTransactionReceipt({ hash: result.hash as `0x${string}` });

      setTxState('success');
      toast.success('Claimed USDC rewards');
      await staking.refresh();
    } catch (err: any) {
      console.error('Claim error:', err);
      setTxState('error');
      setTxError(err.message || 'Transaction failed');
      toast.error(err.message || 'Claim failed');
    }
  };

  // ── Distribute ───────────────────────────────────────────────
  const handleDistribute = async () => {
    if (!walletAddress) return;
    resetTxState();

    try {
      const stakingAddr = CONTRACT_ADDRESSES.ESPStaking as `0x${string}`;

      setTxState('distributing');
      const data = encodeFunctionData({
        abi: CONTRACTS.ESPStaking.abi as any,
        functionName: 'distributeRewards',
        args: [],
      });
      const result = await sendTransactionWithWallet({ to: stakingAddr, data });
      setTxHash(result.hash);
      await publicClient.waitForTransactionReceipt({ hash: result.hash as `0x${string}` });

      setTxState('success');
      toast.success('Rewards distributed');
      await staking.refresh();
    } catch (err: any) {
      console.error('Distribute error:', err);
      setTxState('error');
      setTxError(err.message || 'Transaction failed');
      toast.error(err.message || 'Distribution failed');
    }
  };

  // ── Status messages ──────────────────────────────────────────
  const statusMessage = useMemo(() => {
    switch (txState) {
      case 'approving': return 'Approving ESP tokens...';
      case 'staking': return 'Staking ESP tokens...';
      case 'unstaking': return 'Unstaking ESP tokens...';
      case 'claiming': return 'Claiming USDC rewards...';
      case 'distributing': return 'Distributing rewards...';
      case 'success': return 'Transaction confirmed!';
      case 'error': return txError || 'Transaction failed';
      default: return null;
    }
  }, [txState, txError]);

  const isTxPending = ['approving', 'staking', 'unstaking', 'claiming', 'distributing'].includes(txState);

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-3"
        >
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
            <Coins className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              {t('staking.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('staking.subtitle')}</p>
          </div>
        </motion.div>
        <Badge variant="secondary" className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 dark:from-blue-900/30 dark:to-purple-900/30 dark:text-blue-300 border-0">
          {staking.formatted.stakerSharePercent} Revenue Share
        </Badge>
      </div>

      {/* Not deployed banner */}
      {!isContractDeployed && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            The staking contract has not been deployed yet. This feature is coming soon.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left Column: Action Card ─────────────────────────── */}
        <Card className="p-6 lg:col-span-2 border-0 shadow-lg flex flex-col min-h-[24rem]">
          {!authenticated ? (
            // Wallet not connected
            <div className="flex flex-col items-center justify-center flex-1 py-16 space-y-4">
              <div className="bg-accent/50 p-4 rounded-full">
                <Wallet className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">{t('staking.connectWallet')}</p>
              <Button
                onClick={login}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                Connect Wallet
              </Button>
            </div>
          ) : (
            // Stake / Unstake tabs
            <Tabs defaultValue="stake" className="w-full flex flex-col flex-1 min-h-0">
              <TabsList className="grid w-full grid-cols-2 mb-6 h-11 bg-muted/60 dark:bg-muted/40 p-1 rounded-xl">
                <TabsTrigger value="stake" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:hover:bg-muted-foreground/10 transition-all">
                  <ArrowDownToLine className="w-4 h-4" />
                  Stake
                </TabsTrigger>
                <TabsTrigger value="unstake" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:hover:bg-muted-foreground/10 transition-all">
                  <ArrowUpFromLine className="w-4 h-4" />
                  Unstake
                </TabsTrigger>
              </TabsList>

              {/* Stake Tab */}
              <TabsContent value="stake" className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">{t('staking.amountToStake')}</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    disabled={isTxPending}
                    min="0"
                    step="any"
                    className={`lg:h-12 lg:text-base ${stakeError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  />
                  <div className="flex gap-1.5 mt-2">
                    {[25, 50, 75, 100].map(pct => (
                      <Button
                        key={pct}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-7 lg:h-9 lg:text-sm"
                        onClick={() => {
                          const balance = staking.userEspBalance;
                          if (balance <= BigInt(0)) return;
                          const amount = (balance * BigInt(pct)) / BigInt(100);
                          setStakeAmount(formatUnitsRaw(amount, 18));
                        }}
                        disabled={isTxPending}
                      >
                        {pct === 100 ? 'MAX' : `${pct}%`}
                      </Button>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      Balance: {staking.formatted.userEspBalance} ESP
                    </p>
                    {stakeError && (
                      <p className="text-xs text-red-500">{stakeError}</p>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleStake}
                  disabled={isTxPending || !stakeAmount || !isContractDeployed || !!stakeError}
                  variant="ghost"
                  className="w-full h-11 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                  {isTxPending && txState !== 'unstaking' ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{statusMessage}</>
                  ) : (
                    'Stake ESP'
                  )}
                </Button>

              </TabsContent>

              {/* Unstake Tab */}
              <TabsContent value="unstake" className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">{t('staking.amountToUnstake')}</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    disabled={isTxPending}
                    min="0"
                    step="any"
                    className={`lg:h-12 lg:text-base ${unstakeError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  />
                  <div className="flex gap-1.5 mt-2">
                    {[25, 50, 75, 100].map(pct => (
                      <Button
                        key={pct}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-7 lg:h-9 lg:text-sm"
                        onClick={() => {
                          const staked = staking.userStakedAmount;
                          if (staked <= BigInt(0)) return;
                          const amount = (staked * BigInt(pct)) / BigInt(100);
                          setUnstakeAmount(formatUnitsRaw(amount, 18));
                        }}
                        disabled={isTxPending}
                      >
                        {pct === 100 ? 'MAX' : `${pct}%`}
                      </Button>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      Staked: {staking.formatted.userStakedAmount} ESP
                    </p>
                    {unstakeError && (
                      <p className="text-xs text-red-500">{unstakeError}</p>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleUnstake}
                  disabled={isTxPending || !unstakeAmount || !isContractDeployed || !!unstakeError}
                  variant="ghost"
                  className="w-full h-11 text-base font-semibold bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                  {isTxPending && txState === 'unstaking' ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{statusMessage}</>
                  ) : (
                    'Unstake ESP'
                  )}
                </Button>
              </TabsContent>

              {/* Transaction Status Alert */}
              {txState !== 'idle' && (
                <div className="mt-4">
                  <Alert variant={txState === 'error' ? 'destructive' : 'default'}>
                    {txState === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : txState === 'error' ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <AlertDescription className="flex items-center justify-between">
                      <span>{statusMessage}</span>
                      {txHash && (
                        <a
                          href={`${NETWORK_CONFIG.blockExplorer}/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-500 hover:underline ml-2 shrink-0"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Daily Revenue Chart — visible on both tabs */}
              <div className="pt-4 flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <p className="text-xs text-muted-foreground">{t('staking.dailyRevenue')}</p>
                  {analytics?.revenue?.allTime != null && (
                    <span className="text-xs text-primary font-medium">
                      Total: ${analytics.revenue.allTime.toFixed(2)}
                    </span>
                  )}
                </div>
                {revenueLoading ? (
                  <Skeleton className="flex-1 w-full rounded-lg" />
                ) : revenueError ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-red-400">
                    Failed to load revenue data — check backend connection
                  </div>
                ) : revenueData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    No revenue data available yet
                  </div>
                ) : (
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: tickColor }}
                          tickLine={false}
                          axisLine={false}
                          interval={revenueData.length <= 7 ? 0 : Math.ceil(revenueData.length / 6) - 1}
                        />
                        <YAxis
                          tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
                          domain={[0, 'auto']}
                          tick={{ fontSize: 11, fill: tickColor }}
                          tickLine={false}
                          axisLine={false}
                          width={60}
                        />
                        <RechartsTooltip
                          formatter={(value: number) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                          labelFormatter={(_label: any, payload: any) => payload?.[0]?.payload?.fullDate || _label}
                          contentStyle={{
                            backgroundColor: isDark ? 'hsl(240 10% 4%)' : 'hsl(0 0% 100%)',
                            color: isDark ? '#e4e4e7' : '#18181b',
                            border: isDark ? '1px solid hsl(240 4% 16%)' : '1px solid hsl(240 6% 90%)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="usdc"
                          stroke="#7c3aed"
                          strokeWidth={2}
                          fill="url(#revenueGradient)"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </Tabs>
          )}
        </Card>

        {/* ── Right Column: Info Cards ─────────────────────────── */}
        <div className="space-y-6">
          {/* Protocol Stats */}
          <Card className="p-6 border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10">
            <h3 className="mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-500" />
              Protocol Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('staking.totalStaked')}</span>
                {staking.loading ? <Skeleton className="h-4 w-20" /> : (
                  <span className="text-primary font-medium">{staking.formatted.totalStaked}</span>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Revenue Share
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Percentage of platform trading fees distributed to ESP stakers</TooltipContent>
                  </Tooltip>
                </span>
                {staking.loading ? <Skeleton className="h-4 w-12" /> : (
                  <span className="text-primary font-medium">{staking.formatted.stakerSharePercent}</span>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Estimated APY
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Based on recent reward distribution rate. Available after contract deployment.</TooltipContent>
                  </Tooltip>
                </span>
                {staking.loading ? <Skeleton className="h-4 w-12" /> : (
                  <span className="text-purple-600 dark:text-purple-400 font-medium">&mdash;</span>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Rewards Paid</span>
                {staking.loading ? <Skeleton className="h-4 w-24" /> : (
                  <span className="text-primary font-medium">{staking.formatted.totalRewardsDistributed} USDC</span>
                )}
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Undistributed
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">USDC fees collected but not yet distributed to stakers. Anyone can trigger distribution.</TooltipContent>
                  </Tooltip>
                </span>
                {staking.loading ? <Skeleton className="h-4 w-20" /> : (
                  <span className="text-primary font-medium">{staking.formatted.undistributedRewards} USDC</span>
                )}
              </div>
              {staking.undistributedRewards > BigInt(0) && authenticated && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={handleDistribute}
                  disabled={isTxPending || !isContractDeployed}
                >
                  {txState === 'distributing' ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Distributing...</>
                  ) : (
                    'Distribute Rewards'
                  )}
                </Button>
              )}
            </div>
          </Card>

          {/* Your Position */}
          <Card className="p-6 border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h3 className="mb-4 flex items-center">
              <Wallet className="w-5 h-5 mr-2 text-blue-500" />
              Your Position
            </h3>
            {authenticated ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('staking.yourStakedEsp')}</span>
                  {staking.loading ? <Skeleton className="h-4 w-20" /> : (
                    <span className="text-primary font-medium">{staking.formatted.userStakedAmount}</span>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    {t('staking.yourShare')}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Your percentage of the total staked ESP pool</TooltipContent>
                    </Tooltip>
                  </span>
                  {staking.loading ? <Skeleton className="h-4 w-12" /> : (
                    <span className="text-primary font-medium">{staking.formatted.userSharePercent}</span>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    Pending Rewards
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top">USDC rewards earned but not yet claimed to your wallet</TooltipContent>
                    </Tooltip>
                  </span>
                  {staking.loading ? <Skeleton className="h-4 w-20" /> : (
                    <span className="text-purple-600 dark:text-purple-400 font-medium">
                      {staking.formatted.userPendingRewards} USDC
                    </span>
                  )}
                </div>
                {staking.userPendingRewards > BigInt(0) && (
                  <Button
                    onClick={handleClaim}
                    disabled={isTxPending || !isContractDeployed}
                    className="w-full mt-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  >
                    {txState === 'claiming' ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('staking.claiming')}</>
                    ) : (
                      <><Gift className="w-4 h-4 mr-2" />{t('staking.claimRewards')}</>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Connect wallet to view your position
              </p>
            )}
          </Card>

          {/* How It Works */}
          <Card className="p-6 border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h3 className="mb-4 flex items-center">
              <Info className="w-5 h-5 mr-2 text-muted-foreground" />
              How It Works
            </h3>
            <div className="space-y-3">
              {[
                'Stake your ESP tokens to earn a share of platform trading fees',
                'Trading fees (USDC) accumulate in the staking contract automatically',
                'Claim your USDC rewards at any time — no lock-up period',
              ].map((step, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-xs font-medium shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-muted-foreground">{step}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Raw formatUnits without locale formatting — for input fields */
function formatUnitsRaw(value: bigint, decimals: number): string {
  // Manual conversion: avoids locale formatting so the value works in number inputs
  const str = value.toString().padStart(decimals + 1, '0');
  const intPart = str.slice(0, str.length - decimals) || '0';
  const fracPart = str.slice(str.length - decimals).replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}
