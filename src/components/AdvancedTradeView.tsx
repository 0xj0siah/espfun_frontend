import { useState, useCallback, useEffect, lazy, Suspense, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Skeleton } from './ui/skeleton';
import { usePlayerOHLC, useRecentTrades } from '../hooks/useAnalytics';
import { useIsMobile } from './ui/use-mobile';
import PlayerPurchaseModal from './PlayerPurchaseModal';

const CandlestickChart = lazy(() => import('./charts/CandlestickChart'));
const TradingViewChart = lazy(() => import('./charts/TradingViewChart'));
import { TIME_RANGES } from './charts/CandlestickChart';

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
}

interface AdvancedTradeViewProps {
  player: Player;
  onBack: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUSDC(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export default function AdvancedTradeView({ player, onBack }: AdvancedTradeViewProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = useState('7d');

  // Clean up stale Vaul Drawer body styles (position:fixed, overflow:hidden).
  // When navigating here from a mobile Drawer, the Drawer may unmount before
  // Vaul restores body styles. This safety net ensures the page is interactive.
  useEffect(() => {
    const body = document.body;
    if (body.style.position === 'fixed') {
      const scrollY = -parseInt(body.style.top || '0', 10);
      const scrollX = -parseInt(body.style.left || '0', 10);
      body.style.removeProperty('position');
      body.style.removeProperty('top');
      body.style.removeProperty('left');
      body.style.removeProperty('height');
      body.style.removeProperty('overflow');
      window.scrollTo(scrollX, scrollY);
    }
    body.style.pointerEvents = '';
  }, []);
  const rangeConfig = TIME_RANGES.find((r) => r.value === timeRange) || TIME_RANGES[2];

  // Dynamic chart height — 45vh on mobile, fixed 420px on desktop
  const chartHeight = useMemo(
    () => (isMobile ? Math.max(Math.round(window.innerHeight * 0.42), 240) : 420),
    [isMobile]
  );

  // Use TradingView Advanced Charts when available, otherwise fall back to lightweight-charts
  const useFallback = typeof window === 'undefined' || !window.TradingView?.widget;
  const { candles, loading: chartLoading } = usePlayerOHLC(
    useFallback ? player.id.toString() : null,
    rangeConfig.interval,
    rangeConfig.days
  );

  const { trades, loading: tradesLoading } = useRecentTrades(player.id.toString(), 15);

  const handleTimeRangeChange = useCallback((range: string) => {
    setTimeRange(range);
  }, []);

  /** Renders the TradingView chart with fallback to lightweight-charts */
  const renderChart = useCallback(
    (h: number) => {
      if (useFallback) {
        return (
          <Suspense fallback={<Skeleton className="w-full rounded-lg" style={{ height: h }} />}>
            <CandlestickChart
              candles={candles}
              loading={chartLoading}
              height={h}
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
              playerName={player.name}
              isMobile={isMobile}
            />
          </Suspense>
        );
      }

      return (
        <Suspense fallback={<Skeleton className="w-full rounded-lg" style={{ height: h }} />}>
          <TradingViewChart
            playerTokenId={player.id.toString()}
            playerName={player.name}
            game={player.game}
            price={player.price}
            height={h}
          />
        </Suspense>
      );
    },
    [useFallback, candles, chartLoading, timeRange, handleTimeRangeChange, player, isMobile]
  );

  const explorerBase = 'https://sepolia.basescan.org/tx/';

  return (
    <div className={isMobile ? 'space-y-2 overflow-hidden w-full max-w-full' : 'space-y-4'}>
      {/* Header — slim single-line on mobile, full on desktop */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className={isMobile ? 'p-1.5 h-auto' : 'gap-1.5'}
        >
          <ArrowLeft className="w-4 h-4" />
          {!isMobile && 'Back'}
        </Button>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ImageWithFallback
            src={player.image}
            alt={player.name}
            className={`rounded-full object-cover shrink-0 ${isMobile ? 'w-7 h-7' : 'w-10 h-10'}`}
          />
          {isMobile ? (
            /* Mobile: inline name + price + trend */
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-sm font-semibold truncate">{player.name}</span>
              <span className="text-sm font-medium shrink-0">{player.price}</span>
              {player.trend === 'up' ? (
                <TrendingUp className="w-3 h-3 text-green-500 shrink-0" />
              ) : player.trend === 'down' ? (
                <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />
              ) : null}
            </div>
          ) : (
            /* Desktop: two-line with badge */
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{player.name}</h2>
                <Badge variant="outline" className="text-xs">{player.game}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{player.price}</span>
                {player.trend === 'up' ? (
                  <span className="flex items-center text-green-500 text-xs">
                    <TrendingUp className="w-3 h-3 mr-0.5" /> Up
                  </span>
                ) : player.trend === 'down' ? (
                  <span className="flex items-center text-red-500 text-xs">
                    <TrendingDown className="w-3 h-3 mr-0.5" /> Down
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Main content */}
      {isMobile ? (
        <div key="mobile-layout" className="space-y-3 max-w-full overflow-hidden">
          {/* Chart — hero element, viewport-height based */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="w-full max-w-full overflow-hidden">
            {renderChart(chartHeight)}
          </motion.div>

          {/* Compact purchase panel — always visible */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, x: 0 }} transition={{ delay: 0.1 }} className="w-full min-w-0 overflow-hidden">
            <PlayerPurchaseModal
              player={player}
              isOpen={true}
              onClose={() => {}}
              renderMode="panel"
            />
          </motion.div>

          {/* Recent trades */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <RecentTradesCard trades={trades} loading={tradesLoading} explorerBase={explorerBase} />
          </motion.div>
        </div>
      ) : (
        // Desktop: chart + recent trades left, trading panel right
        <div key="desktop-layout" className="flex gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 min-w-0 space-y-4"
          >
            {renderChart(chartHeight)}
            <RecentTradesCard trades={trades} loading={tradesLoading} explorerBase={explorerBase} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="w-[360px] shrink-0 sticky top-4 self-start"
          >
            <PlayerPurchaseModal
              player={player}
              isOpen={true}
              onClose={() => {}}
              renderMode="panel"
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

function RecentTradesCard({
  trades,
  loading,
  explorerBase,
}: {
  trades: any[];
  loading: boolean;
  explorerBase: string;
}) {
  return (
    <Card className="p-4 border-0 shadow-sm">
      <h3 className="text-sm font-medium mb-3 text-muted-foreground">Recent Trades</h3>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      ) : trades.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          No trades recorded yet. Be the first to trade!
        </div>
      ) : (
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-[60px_1fr_1fr_80px_28px] gap-2 text-[11px] font-medium text-muted-foreground px-2 pb-1 border-b border-border/40">
            <span>Type</span>
            <span>Trader</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Time</span>
            <span />
          </div>

          {trades.map((trade: any, i: number) => {
            const isBuy = trade.type === 'buy';
            return (
              <motion.div
                key={`${trade.txHash}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-[60px_1fr_1fr_80px_28px] gap-2 items-center text-xs px-2 py-1.5 rounded-md hover:bg-accent/40 transition-colors"
              >
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 h-5 justify-center ${
                    isBuy
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}
                >
                  {isBuy ? 'BUY' : 'SELL'}
                </Badge>

                <span className="font-mono text-muted-foreground truncate">
                  {shortenAddress(trade.trader)}
                </span>

                <span className="text-right font-medium tabular-nums">
                  {formatUSDC(trade.amount)}
                </span>

                <span className="text-right text-muted-foreground tabular-nums">
                  {formatTimeAgo(trade.time)}
                </span>

                {trade.txHash && (
                  <a
                    href={`${explorerBase}${trade.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
