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
import { usePriceContext } from '../context/PriceContext';
import { pushLivePrice } from '../lib/tradingview/datafeed';
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

  const { rawPrices } = usePriceContext();
  const livePrice = rawPrices[player.id] ?? undefined;

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
              livePrice={livePrice}
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
    [useFallback, candles, chartLoading, timeRange, handleTimeRangeChange, player, isMobile, livePrice]
  );

  // Push live price to TradingView datafeed when not using fallback chart
  useEffect(() => {
    if (!useFallback && livePrice != null && livePrice > 0) {
      pushLivePrice(player.id.toString(), livePrice);
    }
  }, [useFallback, livePrice, player.id]);

  const explorerBase = 'https://basescan.org/tx/';

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

// Inline style for the trade table columns — avoids Tailwind JIT purging arbitrary grid values.
// Columns: Type(52px) | Trader(flex) | Amount(88px) | Time(68px) | Link(20px)
const TRADE_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '52px 1fr 88px 68px 20px',
  gap: '0 12px',
};

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
    <Card className="overflow-hidden border-0 shadow-sm">
      {/* Card header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Trades</h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {!loading && trades.length > 0 ? `${trades.length} trades` : ''}
        </span>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      ) : trades.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-10">
          No trades recorded yet. Be the first to trade!
        </div>
      ) : (
        <div>
          {/* Column header */}
          <div
            style={TRADE_GRID}
            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/40 px-4 py-2"
          >
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.025, duration: 0.15 }}
                style={TRADE_GRID}
                className={`items-center px-4 py-2.5 border-b border-border/20 last:border-b-0 hover:bg-accent/50 transition-colors ${
                  i % 2 === 1 ? 'bg-muted/20' : ''
                }`}
              >
                {/* Type badge */}
                <span
                  className={`inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-sm w-fit ${
                    isBuy
                      ? 'bg-green-500/15 text-green-500'
                      : 'bg-red-500/15 text-red-500'
                  }`}
                >
                  {isBuy ? 'BUY' : 'SELL'}
                </span>

                {/* Trader address */}
                <span className="font-mono text-[11px] text-muted-foreground truncate">
                  {shortenAddress(trade.trader)}
                </span>

                {/* Amount — colored by trade direction */}
                <span
                  className={`text-right text-xs font-semibold tabular-nums ${
                    isBuy ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {formatUSDC(trade.amount)}
                </span>

                {/* Time */}
                <span className="text-right text-[11px] text-muted-foreground tabular-nums">
                  {formatTimeAgo(trade.time)}
                </span>

                {/* Explorer link */}
                {trade.txHash ? (
                  <a
                    href={`${explorerBase}${trade.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span />
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
