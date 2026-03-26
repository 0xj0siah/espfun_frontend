import { useState, useMemo } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { motion } from 'motion/react';
import { Coins, TrendingUp, Wallet, Info, CheckCircle, XCircle, Loader2, ExternalLink, ArrowDownToLine, ArrowUpFromLine, Gift } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWalletTransactions } from '../hooks/useWalletTransactions';
import { useStaking } from '../hooks/useStaking';
import { createPublicClient, http, parseUnits, encodeFunctionData } from 'viem';
import { CONTRACTS, CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../contracts';

type TxState = 'idle' | 'approving' | 'staking' | 'unstaking' | 'claiming' | 'distributing' | 'success' | 'error';

// Mock daily revenue share data — replace with real API/contract data after deployment
const DAILY_REVENUE_DATA = [
  { date: 'Mar 10', usdc: 0 },
  { date: 'Mar 11', usdc: 0 },
  { date: 'Mar 12', usdc: 0 },
  { date: 'Mar 13', usdc: 0 },
  { date: 'Mar 14', usdc: 0 },
  { date: 'Mar 15', usdc: 0 },
  { date: 'Mar 16', usdc: 0 },
  { date: 'Mar 17', usdc: 0 },
  { date: 'Mar 18', usdc: 0 },
  { date: 'Mar 19', usdc: 0 },
  { date: 'Mar 20', usdc: 0 },
  { date: 'Mar 21', usdc: 0 },
  { date: 'Mar 22', usdc: 0 },
  { date: 'Mar 23', usdc: 0 },
];

const publicClient = createPublicClient({
  chain: {
    id: NETWORK_CONFIG.chainId,
    name: NETWORK_CONFIG.name,
    rpcUrls: {
      default: { http: [NETWORK_CONFIG.rpcUrl] },
      public: { http: [NETWORK_CONFIG.rpcUrl] },
    },
    blockExplorers: {
      default: { name: 'Explorer', url: NETWORK_CONFIG.blockExplorer },
    },
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    testnet: true,
  },
  transport: http(NETWORK_CONFIG.rpcUrl, { timeout: 30000, retryCount: 3 }),
});

export default function StakingSection() {
  const { login, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransactionWithWallet } = useWalletTransactions();

  const walletAddress = wallets[0]?.address;
  const staking = useStaking(walletAddress);

  // Form state
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // Transaction state
  const [txState, setTxState] = useState<TxState>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const isContractDeployed =
    CONTRACT_ADDRESSES.ESPStaking !== '0x0000000000000000000000000000000000000000';

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
      setStakeAmount('');
      await staking.refresh();
    } catch (err: any) {
      console.error('Stake error:', err);
      setTxState('error');
      setTxError(err.message || 'Transaction failed');
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
      setUnstakeAmount('');
      await staking.refresh();
    } catch (err: any) {
      console.error('Unstake error:', err);
      setTxState('error');
      setTxError(err.message || 'Transaction failed');
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
      await staking.refresh();
    } catch (err: any) {
      console.error('Claim error:', err);
      setTxState('error');
      setTxError(err.message || 'Transaction failed');
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
      await staking.refresh();
    } catch (err: any) {
      console.error('Distribute error:', err);
      setTxState('error');
      setTxError(err.message || 'Transaction failed');
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-3"
        >
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-3 rounded-xl">
            <Coins className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Staking
            </h2>
            <p className="text-sm text-muted-foreground">Stake ESP tokens to earn USDC from platform fees</p>
          </div>
        </motion.div>
        <Badge variant="secondary" className="bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border-0">
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
        <Card className="p-6 lg:col-span-2 border-0 shadow-lg">
          {!authenticated ? (
            // Wallet not connected
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="bg-accent/50 p-4 rounded-full">
                <Wallet className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Connect your wallet to start staking</p>
              <Button
                onClick={login}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
              >
                Connect Wallet
              </Button>
            </div>
          ) : (
            // Stake / Unstake tabs
            <Tabs defaultValue="stake" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="stake" className="flex items-center gap-2">
                  <ArrowDownToLine className="w-4 h-4" />
                  Stake
                </TabsTrigger>
                <TabsTrigger value="unstake" className="flex items-center gap-2">
                  <ArrowUpFromLine className="w-4 h-4" />
                  Unstake
                </TabsTrigger>
              </TabsList>

              {/* Stake Tab */}
              <TabsContent value="stake" className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Amount to Stake</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      disabled={isTxPending}
                      min="0"
                      step="any"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setStakeAmount(staking.userEspBalance > BigInt(0) ? formatUnitsRaw(staking.userEspBalance, 18) : '')}
                      disabled={isTxPending}
                    >
                      Max
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Balance: {staking.formatted.userEspBalance} ESP
                  </p>
                </div>

                <Button
                  onClick={handleStake}
                  disabled={isTxPending || !stakeAmount || !isContractDeployed || parseFloat(stakeAmount) <= 0}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
                >
                  {isTxPending && txState !== 'unstaking' ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{statusMessage}</>
                  ) : (
                    'Stake ESP'
                  )}
                </Button>

                {/* Daily Revenue Chart */}
                <div className="pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Daily Revenue Distributed (USDC)</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={DAILY_REVENUE_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'currentColor' }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'currentColor' }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="usdc"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#revenueGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#10b981' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* Unstake Tab */}
              <TabsContent value="unstake" className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Amount to Unstake</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={unstakeAmount}
                      onChange={(e) => setUnstakeAmount(e.target.value)}
                      disabled={isTxPending}
                      min="0"
                      step="any"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setUnstakeAmount(staking.userStakedAmount > BigInt(0) ? formatUnitsRaw(staking.userStakedAmount, 18) : '')}
                      disabled={isTxPending}
                    >
                      Max
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Staked: {staking.formatted.userStakedAmount} ESP
                  </p>
                </div>

                <Button
                  onClick={handleUnstake}
                  disabled={isTxPending || !unstakeAmount || !isContractDeployed || parseFloat(unstakeAmount) <= 0}
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white"
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
            </Tabs>
          )}
        </Card>

        {/* ── Right Column: Info Cards ─────────────────────────── */}
        <div className="space-y-6">
          {/* Protocol Stats */}
          <Card className="p-6 border-0 shadow-lg bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10">
            <h3 className="mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-emerald-500" />
              Protocol Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total ESP Staked</span>
                <span className="text-primary font-medium">{staking.formatted.totalStaked}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Revenue Share</span>
                <span className="text-primary font-medium">{staking.formatted.stakerSharePercent}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Rewards Paid</span>
                <span className="text-primary font-medium">{staking.formatted.totalRewardsDistributed} USDC</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Undistributed</span>
                <span className="text-primary font-medium">{staking.formatted.undistributedRewards} USDC</span>
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
          <Card className="p-6 border-0 shadow-lg">
            <h3 className="mb-4 flex items-center">
              <Wallet className="w-5 h-5 mr-2 text-blue-500" />
              Your Position
            </h3>
            {authenticated ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Staked ESP</span>
                  <span className="text-primary font-medium">{staking.formatted.userStakedAmount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Share</span>
                  <span className="text-primary font-medium">{staking.formatted.userSharePercent}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending Rewards</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {staking.formatted.userPendingRewards} USDC
                  </span>
                </div>
                {staking.userPendingRewards > BigInt(0) && (
                  <Button
                    onClick={handleClaim}
                    disabled={isTxPending || !isContractDeployed}
                    className="w-full mt-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  >
                    {txState === 'claiming' ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Claiming...</>
                    ) : (
                      <><Gift className="w-4 h-4 mr-2" />Claim Rewards</>
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
          <Card className="p-6 border-0 shadow-lg">
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
