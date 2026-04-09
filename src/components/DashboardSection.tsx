import { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { motion } from 'motion/react';
import { LayoutDashboard, DollarSign, Wallet, TrendingUp, Users, BarChart3, Star } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTVLHistory } from '../hooks/useAnalytics';
import { useIsMobile } from './ui/use-mobile';
import { apiService } from '../services/apiService';
import { usePrivy } from '@privy-io/react-auth';
import { formatUnits } from 'viem';
import { getContractData } from '../contracts';
import { readContractCached } from '../utils/contractCache';
import fakeData from '../fakedata.json';

interface DashboardSectionProps {
  preloadedPrices: Record<number, string>;
  activePlayerIds: number[];
  pricesLoading: boolean;
}

export default memo(function DashboardSection({ preloadedPrices, activePlayerIds, pricesLoading }: DashboardSectionProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { user, authenticated } = usePrivy();
  const walletAddress = user?.wallet?.address;

  const { data: tvlHistory, loading: tvlLoading, error: tvlError } = useTVLHistory(30);

  // Fetch live TVL from backend
  const [tvl, setTvl] = useState<{ total: number; amm: number; bondingCurve: number } | null>(null);
  useEffect(() => {
    apiService.getTVLLatest().then((data: any) => {
      if (data && data.totalTVL != null) {
        setTvl({ total: data.totalTVL, amm: data.ammTVL, bondingCurve: data.bondingCurveTVL });
      }
    }).catch(() => {});
  }, []);

  // Portfolio: read token balances in background (not displayed individually, just total)
  const [portfolioTotal, setPortfolioTotal] = useState(0);
  const [holdingsCount, setHoldingsCount] = useState(0);
  const [holdingsLoading, setHoldingsLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress || !authenticated || activePlayerIds.length === 0) return;

    const fetchHoldings = async () => {
      setHoldingsLoading(true);
      try {
        const playerContract = getContractData('Player');
        let total = 0;
        let count = 0;

        await Promise.allSettled(
          activePlayerIds.map(async (playerId) => {
            try {
              const result = await readContractCached({
                address: playerContract.address as `0x${string}`,
                abi: playerContract.abi as any,
                functionName: 'balanceOf',
                args: [walletAddress as `0x${string}`, BigInt(playerId)],
              });
              const bal = result as bigint;
              if (bal > 0n) {
                const formatted = parseFloat(formatUnits(bal, 18));
                const priceStr = preloadedPrices[playerId] || '';
                const priceNum = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
                total += formatted * priceNum;
                count++;
              }
            } catch { /* skip */ }
          })
        );

        setPortfolioTotal(total);
        setHoldingsCount(count);
      } catch {
        setPortfolioTotal(0);
        setHoldingsCount(0);
      } finally {
        setHoldingsLoading(false);
      }
    };

    fetchHoldings();
  }, [walletAddress, authenticated, activePlayerIds.join(','), JSON.stringify(preloadedPrices)]);

  // Volume / trades from backend analytics
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    apiService.getAnalyticsOverview().then(setStats).catch(() => {});
  }, []);

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const tickColor = isDark ? '#a1a1aa' : '#71717a';

  // Format TVL history for chart (EDT timezone)
  const tvlChartData = (() => {
    const tz = 'America/New_York';
    let data = tvlHistory.map((snap: any) => {
      const d = new Date(snap.createdAt);
      // Guard against invalid dates
      const isValid = !isNaN(d.getTime());
      return {
        date: isValid
          ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })
          : '',
        fullDate: isValid
          ? d.toLocaleString('en-US', {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              timeZone: tz, timeZoneName: 'short',
            })
          : '',
        tvl: Number(snap.totalTVL) || 0,
      };
    });
    // Duplicate single data point so Recharts draws a visible line + area
    if (data.length === 1) {
      data = [{ ...data[0], date: '' }, data[0]];
    }
    return data;
  })();

  // Note: we intentionally render the chart even when all values are 0 (flat line = valid state).

  const formatUSDC = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center space-x-3"
      >
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
          <LayoutDashboard className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">Platform overview and your portfolio</p>
        </div>
      </motion.div>

      {/* Top Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* TVL Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-5 border-0 shadow-lg bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-900/10 dark:to-emerald-900/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Value Locked</p>
              <DollarSign className="w-4 h-4 text-green-500" />
            </div>
            {!tvl ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <p className="text-2xl font-bold">{formatUSDC(tvl.total)}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">AMM: {formatUSDC(tvl.amm)}</span>
                  <span className="text-xs text-muted-foreground">BC: {formatUSDC(tvl.bondingCurve)}</span>
                </div>
              </>
            )}
          </Card>
        </motion.div>

        {/* Portfolio Value Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-5 border-0 shadow-lg bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Your Portfolio</p>
              <Wallet className="w-4 h-4 text-blue-500" />
            </div>
            {!authenticated ? (
              <p className="text-sm text-muted-foreground">Connect wallet to view</p>
            ) : holdingsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <p className="text-2xl font-bold">{formatUSDC(portfolioTotal)}</p>
                <p className="text-xs text-muted-foreground mt-1">{holdingsCount} players held</p>
              </>
            )}
          </Card>
        </motion.div>

        {/* 24h Volume */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-5 border-0 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">24h Volume</p>
              <BarChart3 className="w-4 h-4 text-orange-500" />
            </div>
            {!stats ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <p className="text-2xl font-bold">{formatUSDC(stats.volume?.last24h || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.trades?.last24h || 0} trades</p>
              </>
            )}
          </Card>
        </motion.div>

        {/* Platform Users */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-5 border-0 shadow-lg bg-gradient-to-br from-yellow-50/50 to-orange-50/50 dark:from-yellow-900/10 dark:to-orange-900/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Platform Users</p>
              <Users className="w-4 h-4 text-yellow-500" />
            </div>
            {!stats ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <p className="text-2xl font-bold">{stats.users?.total?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.users?.activeTraders24h || 0} active today</p>
              </>
            )}
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* TVL Chart */}
        <Card className="p-6 lg:col-span-2 border-0 shadow-lg">
          <h3 className="mb-4 flex items-center text-lg font-semibold">
            <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
            TVL Over Time
          </h3>
          {tvlLoading ? (
            <Skeleton className="h-48 lg:h-64 w-full rounded-lg" />
          ) : tvlError ? (
            <div className="h-48 lg:h-64 flex items-center justify-center text-sm text-red-400">
              Failed to load TVL data — check backend connection
            </div>
          ) : tvlChartData.length === 0 ? (
            <div className="h-48 lg:h-64 flex items-center justify-center text-sm text-muted-foreground">
              No TVL activity recorded yet
            </div>
          ) : (
            <div className="h-48 lg:h-64 xl:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tvlChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: tickColor }}
                    tickLine={false}
                    axisLine={false}
                    interval={tvlChartData.length <= 7 ? 0 : Math.ceil(tvlChartData.length / 6) - 1}
                  />
                  <YAxis
                    tickFormatter={formatUSDC}
                    domain={[0, (max: number) => max > 0 ? max * 1.1 : 10]}
                    tick={{ fontSize: 11, fill: tickColor }}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatUSDC(value), 'TVL']}
                    labelFormatter={(_label: any, payload: any) => payload?.[0]?.payload?.fullDate || _label}
                    contentStyle={{
                      backgroundColor: isDark ? 'hsl(240 10% 4%)' : 'hsl(0 0% 100%)',
                      color: isDark ? '#e4e4e7' : '#18181b',
                      border: isDark ? '1px solid hsl(240 4% 16%)' : '1px solid hsl(240 6% 90%)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="tvl" stroke="#22c55e" fill="url(#tvlGradient)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Protocol Stats Side Panel */}
        <div className="space-y-6">
          <Card className="p-6 border-0 shadow-lg">
            <h3 className="mb-4 flex items-center font-semibold">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
              Protocol Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">All-Time Volume</span>
                {!stats ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <span className="text-sm font-medium">{formatUSDC(stats.volume?.allTime || 0)}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">All-Time Fees</span>
                {!stats ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <span className="text-sm font-medium">{formatUSDC(stats.revenue?.allTime || 0)}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Trades</span>
                {!stats ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <span className="text-sm font-medium">{(stats.trades?.allTime || 0).toLocaleString()}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active Players</span>
                <span className="text-sm font-medium">{activePlayerIds.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">7d Volume</span>
                {!stats ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <span className="text-sm font-medium">{formatUSDC(stats.volume?.last7d || 0)}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">7d Fees</span>
                {!stats ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <span className="text-sm font-medium">{formatUSDC(stats.revenue?.last7d || 0)}</span>
                )}
              </div>
            </div>
          </Card>

          {/* Your Stats */}
          <Card className="p-6 border-0 shadow-lg">
            <h3 className="mb-4 flex items-center font-semibold">
              <Star className="w-5 h-5 mr-2 text-yellow-500" />
              Your Stats
            </h3>
            {!authenticated ? (
              <p className="text-sm text-muted-foreground text-center py-4">Connect wallet to view</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Portfolio Value</span>
                  {holdingsLoading ? (
                    <Skeleton className="h-4 w-16" />
                  ) : (
                    <span className="text-sm font-medium text-primary">{formatUSDC(portfolioTotal)}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Players Held</span>
                  {holdingsLoading ? (
                    <Skeleton className="h-4 w-8" />
                  ) : (
                    <span className="text-sm font-medium">{holdingsCount}</span>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
});
