import { useEffect, useRef, useState, memo } from 'react';
import {
  createChart,
  ColorType,
  CandlestickData,
  Time,
  IChartApi,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
  ISeriesApi,
  createTextWatermark,
  createSeriesMarkers,
} from 'lightweight-charts';
import { Skeleton } from '../ui/skeleton';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type ChartMode = 'candles' | 'line' | 'area';

interface CandlestickChartProps {
  candles: CandlestickData<Time>[];
  loading?: boolean;
  height?: number;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  playerName?: string;
  isMobile?: boolean;
}

const TIME_RANGES = [
  { label: '1H', value: '1h', interval: '5m' as const, days: 1 },
  { label: '24H', value: '24h', interval: '15m' as const, days: 1 },
  { label: '7D', value: '7d', interval: '1h' as const, days: 7 },
  { label: '30D', value: '30d', interval: '4h' as const, days: 30 },
  { label: 'ALL', value: 'all', interval: '1d' as const, days: 365 },
];

export { TIME_RANGES };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(0);
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function formatVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

function computeSMA(
  candles: CandlestickData<Time>[],
  period: number
): { time: Time; value: number }[] {
  const out: { time: Time; value: number }[] = [];
  if (candles.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += (candles[i] as any).close;
  out.push({ time: candles[period - 1].time, value: sum / period });
  for (let i = period; i < candles.length; i++) {
    sum += (candles[i] as any).close - (candles[i - period] as any).close;
    out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

/** Detect local highs/lows for pivot markers. */
function detectPivots(
  candles: CandlestickData<Time>[],
  lookback: number = 5
): { time: Time; position: string; shape: string; color: string; text: string }[] {
  const markers: any[] = [];
  if (candles.length < lookback * 2 + 1) return markers;
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i] as any;
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      const adj = candles[j] as any;
      if (adj.high >= c.high) isHigh = false;
      if (adj.low <= c.low) isLow = false;
    }
    if (isHigh) {
      markers.push({
        time: c.time,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: 'rgba(239,68,68,0.6)',
        text: formatPrice(c.high),
      });
    }
    if (isLow) {
      markers.push({
        time: c.time,
        position: 'belowBar',
        shape: 'arrowUp',
        color: 'rgba(34,197,94,0.6)',
        text: formatPrice(c.low),
      });
    }
  }
  return markers;
}

// ---------------------------------------------------------------------------
// Toolbar sub-components (stable references — defined outside memo)
// ---------------------------------------------------------------------------

function ToolbarBtn({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all select-none ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-accent/40 text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

const CHART_MODES: { mode: ChartMode; label: string; icon: JSX.Element }[] = [
  {
    mode: 'candles',
    label: 'Candlestick',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="4" y1="2" x2="4" y2="14" />
        <rect x="2" y="5" width="4" height="6" rx="0.5" fill="currentColor" opacity="0.25" />
        <line x1="12" y1="3" x2="12" y2="13" />
        <rect x="10" y="5" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.25" />
      </svg>
    ),
  },
  {
    mode: 'line',
    label: 'Line',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 12 L5.5 6 L9 9 L14 3" />
      </svg>
    ),
  },
  {
    mode: 'area',
    label: 'Area',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 12 L5.5 6 L9 9 L14 3 V14 H2 Z" fill="currentColor" opacity="0.12" />
        <path d="M2 12 L5.5 6 L9 9 L14 3" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CandlestickChart({
  candles,
  loading = false,
  height = 400,
  timeRange,
  onTimeRangeChange,
  playerName,
  isMobile = false,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  const [chartMode, setChartMode] = useState<ChartMode>('candles');
  const [showMA7, setShowMA7] = useState(false);
  const [showMA25, setShowMA25] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showPivots, setShowPivots] = useState(false);
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);

  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  // -- colour palette -------------------------------------------------------
  const C = {
    up: '#22c55e',
    down: '#ef4444',
    upA: 'rgba(34,197,94,0.25)',
    downA: 'rgba(239,68,68,0.25)',
    line: '#3b82f6',
    areaTop: 'rgba(59,130,246,0.35)',
    areaBot: 'rgba(59,130,246,0.02)',
    ma7: '#f59e0b',
    ma25: '#8b5cf6',
    grid: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    cross: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
    crossLabel: isDark ? '#27272a' : '#f4f4f5',
    text: isDark ? '#a1a1aa' : '#71717a',
    border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    wm: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    wmSub: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
  };

  // -- chart effect ---------------------------------------------------------
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;

    // ---- Create chart ----
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: C.text,
        fontSize: isMobile ? 10 : 12,
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: C.grid },
        horzLines: { color: C.grid },
      },
      width: container.clientWidth,
      height,
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: C.cross,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: C.crossLabel,
        },
        horzLine: {
          color: C.cross,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: C.crossLabel,
        },
      },
      rightPriceScale: {
        borderColor: C.border,
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.22 : 0.05 },
      },
      timeScale: {
        borderColor: C.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: isMobile ? 2 : 5,
        minBarSpacing: isMobile ? 2 : 3,
      },
      handleScroll: { vertTouchDrag: false },
    });

    // ---- Main series ----
    let mainSeries: ISeriesApi<any>;
    const customPriceFormat = {
      type: 'custom' as const,
      formatter: formatPrice,
      minMove: 0.000001,
    };

    if (chartMode === 'line') {
      mainSeries = chart.addSeries(LineSeries, {
        color: C.line,
        lineWidth: 2,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderWidth: 1,
        crosshairMarkerBackgroundColor: C.line,
        crosshairMarkerBorderColor: isDark ? '#18181b' : '#ffffff',
        priceLineVisible: true,
        lastValueVisible: true,
        priceFormat: customPriceFormat,
      });
    } else if (chartMode === 'area') {
      mainSeries = chart.addSeries(AreaSeries, {
        topColor: C.areaTop,
        bottomColor: C.areaBot,
        lineColor: C.line,
        lineWidth: 2,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderWidth: 1,
        crosshairMarkerBackgroundColor: C.line,
        crosshairMarkerBorderColor: isDark ? '#18181b' : '#ffffff',
        priceLineVisible: true,
        lastValueVisible: true,
        priceFormat: customPriceFormat,
      });
    } else {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: C.up,
        downColor: C.down,
        borderDownColor: C.down,
        borderUpColor: C.up,
        wickDownColor: C.down,
        wickUpColor: C.up,
        priceLineVisible: true,
        lastValueVisible: true,
        priceFormat: customPriceFormat,
      });
    }

    // ---- Volume ----
    let volumeSeries: ISeriesApi<any> | null = null;
    if (showVolume) {
      volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
        drawTicks: false,
        borderVisible: false,
      });
    }

    // ---- MA overlays ----
    let ma7Series: ISeriesApi<any> | null = null;
    let ma25Series: ISeriesApi<any> | null = null;
    if (showMA7) {
      ma7Series = chart.addSeries(LineSeries, {
        color: C.ma7,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
    }
    if (showMA25) {
      ma25Series = chart.addSeries(LineSeries, {
        color: C.ma25,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
    }

    // ---- Populate data ----
    if (candles.length > 0) {
      // Main series
      if (chartMode === 'candles') {
        mainSeries.setData(candles);
      } else {
        mainSeries.setData(
          candles.map((c: any) => ({ time: c.time, value: c.close }))
        );
      }

      // Volume
      if (volumeSeries) {
        volumeSeries.setData(
          candles.map((c: any) => {
            const isUp = c.close >= c.open;
            return {
              time: c.time,
              value:
                c.volume != null && c.volume > 0
                  ? c.volume
                  : Math.abs(c.high - c.low) * 1000,
              color: isUp ? C.upA : C.downA,
            };
          })
        );
      }

      // MAs
      if (ma7Series) ma7Series.setData(computeSMA(candles, 7));
      if (ma25Series) ma25Series.setData(computeSMA(candles, 25));

      // Pivot markers
      if (showPivots && chartMode === 'candles') {
        const pivotMarkers = detectPivots(candles);
        if (pivotMarkers.length > 0) {
          try {
            createSeriesMarkers(mainSeries, pivotMarkers as any);
          } catch {
            // markers API may not be available
          }
        }
      }

      // Price line at last close
      const last = candles[candles.length - 1] as any;
      const first = candles[0] as any;
      const isOverallUp = last.close >= first.open;
      mainSeries.createPriceLine({
        price: last.close,
        color: isOverallUp ? C.up : C.down,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: '',
      });

      chart.timeScale().fitContent();
    }

    // ---- Watermark ----
    if (playerName) {
      try {
        const pane = chart.panes()[0];
        createTextWatermark(pane, {
          horzAlign: 'center',
          vertAlign: 'center',
          lines: [
            {
              text: playerName,
              color: C.wm,
              fontSize: 48,
              fontStyle: 'bold',
              fontFamily: "'Inter', sans-serif",
            },
            {
              text: 'USDC',
              color: C.wmSub,
              fontSize: 24,
              fontFamily: "'Inter', sans-serif",
            },
          ],
        });
      } catch {
        // watermark API may differ across versions
      }
    }

    // ---- Pre-compute MA lookup maps for legend (O(n) once, O(1) per hover) ----
    const ma7Map = new Map<any, number>();
    const ma25Map = new Map<any, number>();
    if (showMA7) {
      for (const pt of computeSMA(candles, 7)) ma7Map.set(pt.time, pt.value);
    }
    if (showMA25) {
      for (const pt of computeSMA(candles, 25)) ma25Map.set(pt.time, pt.value);
    }

    // ---- OHLCV legend on crosshair ----
    const legend = legendRef.current;

    const buildLegendHTML = (ohlc: any, vol?: number, compact?: boolean) => {
      if (!ohlc) return '';
      const isUp = ohlc.close >= ohlc.open;
      const pct =
        ohlc.open > 0
          ? (((ohlc.close - ohlc.open) / ohlc.open) * 100).toFixed(2)
          : '0.00';
      const sign = parseFloat(pct) >= 0 ? '+' : '';
      const col = isUp ? C.up : C.down;
      if (compact) {
        return `<span style="color:${col};font-weight:600">${sign}${pct}%</span> <span>C <b>${formatPrice(ohlc.close)}</b></span>`;
      }
      const volHtml =
        vol != null
          ? `<span>V <b>${formatVol(vol)}</b></span>`
          : '';
      // MA values in legend (uses pre-built lookup maps)
      const ma7val = showMA7 && ma7Map.has(ohlc.time)
        ? `<span style="color:${C.ma7}">MA7 <b>${formatPrice(ma7Map.get(ohlc.time)!)}</b></span>`
        : '';
      const ma25val = showMA25 && ma25Map.has(ohlc.time)
        ? `<span style="color:${C.ma25}">MA25 <b>${formatPrice(ma25Map.get(ohlc.time)!)}</b></span>`
        : '';

      return `
        <span style="color:${col};font-weight:600">${sign}${pct}%</span>
        <span>O <b>${formatPrice(ohlc.open)}</b></span>
        <span>H <b>${formatPrice(ohlc.high)}</b></span>
        <span>L <b>${formatPrice(ohlc.low)}</b></span>
        <span>C <b>${formatPrice(ohlc.close)}</b></span>
        ${volHtml}${ma7val}${ma25val}
      `;
    };

    // Build time→candle lookup for line/area mode legend
    const candleByTime = new Map<any, any>();
    candles.forEach((c: any) => candleByTime.set(c.time, c));

    const updateLegend = (param: any) => {
      if (!legend) return;

      if (!param?.time || !param.seriesData) {
        // Default: show latest candle
        if (candles.length > 0) {
          const last = candles[candles.length - 1] as any;
          const vol = volumeSeries
            ? (last.volume ?? Math.abs(last.high - last.low) * 1000)
            : undefined;
          legend.innerHTML = buildLegendHTML(last, vol, isMobile);
        }
        return;
      }

      // Resolve OHLC — for line/area modes, map back to original candle
      let ohlc: any;
      if (chartMode === 'candles') {
        ohlc = param.seriesData.get(mainSeries);
      } else {
        ohlc = candleByTime.get(param.time);
        if (!ohlc) {
          const pt = param.seriesData.get(mainSeries);
          if (pt)
            ohlc = {
              open: pt.value,
              high: pt.value,
              low: pt.value,
              close: pt.value,
              time: param.time,
            };
        }
      }
      if (!ohlc) return;

      let vol: number | undefined;
      if (volumeSeries) {
        const vd = param.seriesData.get(volumeSeries);
        if (vd) vol = vd.value;
      }

      legend.innerHTML = buildLegendHTML(ohlc, vol, isMobile);
    };

    chart.subscribeCrosshairMove(updateLegend);
    updateLegend({}); // show latest on mount

    chartRef.current = chart;

    // ---- Resize observer ----
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        chartRef.current.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(container);

    return () => {
      chart.unsubscribeCrosshairMove(updateLegend);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, height, isDark, playerName, chartMode, showMA7, showMA25, showVolume, showPivots, isMobile]);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <Skeleton key={r.value} className="h-7 w-12 rounded-md" />
          ))}
        </div>
        <Skeleton className="w-full rounded-lg" style={{ height }} />
      </div>
    );
  }

  // ---- Render ----
  return (
    <div className="space-y-2">
      {isMobile ? (
        <>
          {/* Mobile: single scrollable row — time ranges + chart modes + indicators popover */}
          <div
            className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => onTimeRangeChange(range.value)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all shrink-0 ${
                  timeRange === range.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-accent/40 text-muted-foreground'
                }`}
              >
                {range.label}
              </button>
            ))}

            <div className="w-px h-4 bg-border/50 mx-0.5 shrink-0" />

            {CHART_MODES.map(({ mode, label, icon }) => (
              <ToolbarBtn
                key={mode}
                active={chartMode === mode}
                onClick={() => setChartMode(mode)}
                title={label}
              >
                {icon}
              </ToolbarBtn>
            ))}

            <div className="w-px h-4 bg-border/50 mx-0.5 shrink-0" />

            <div className="relative shrink-0">
              <button
                onClick={() => setShowIndicatorMenu((v) => !v)}
                className={`p-1.5 rounded-md transition-all ${
                  showMA7 || showMA25 || showPivots
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-accent/40 text-muted-foreground'
                }`}
                title="Indicators"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="2" y1="4" x2="14" y2="4" />
                  <circle cx="5" cy="4" r="1.5" fill="currentColor" />
                  <line x1="2" y1="12" x2="14" y2="12" />
                  <circle cx="11" cy="12" r="1.5" fill="currentColor" />
                </svg>
              </button>
              {showIndicatorMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowIndicatorMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2 space-y-1 min-w-[120px]">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 pb-1">Indicators</div>
                    <ToolbarBtn active={showMA7} onClick={() => setShowMA7((v) => !v)}>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-0.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                        MA 7
                      </span>
                    </ToolbarBtn>
                    <ToolbarBtn active={showMA25} onClick={() => setShowMA25((v) => !v)}>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-0.5 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
                        MA 25
                      </span>
                    </ToolbarBtn>
                    <ToolbarBtn active={showVolume} onClick={() => setShowVolume((v) => !v)}>
                      Volume
                    </ToolbarBtn>
                    <ToolbarBtn active={showPivots} onClick={() => setShowPivots((v) => !v)}>
                      Pivots
                    </ToolbarBtn>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile: condensed legend */}
          <div
            ref={legendRef}
            className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-muted-foreground"
          />
        </>
      ) : (
        <>
          {/* Desktop Row 1: time ranges + OHLCV legend */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1">
              {TIME_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => onTimeRangeChange(range.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    timeRange === range.value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-accent/40 text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            <div
              ref={legendRef}
              className="flex items-center gap-3 text-xs font-mono tabular-nums text-muted-foreground overflow-hidden"
            />
          </div>

          {/* Desktop Row 2: chart mode + indicators */}
          <div className="flex items-center gap-1 flex-wrap">
            <div className="flex gap-0.5">
              {CHART_MODES.map(({ mode, label, icon }) => (
                <ToolbarBtn
                  key={mode}
                  active={chartMode === mode}
                  onClick={() => setChartMode(mode)}
                  title={label}
                >
                  {icon}
                </ToolbarBtn>
              ))}
            </div>

            <div className="w-px h-5 bg-border/50 mx-1.5" />

            <ToolbarBtn
              active={showMA7}
              onClick={() => setShowMA7((v) => !v)}
              title="7-period Moving Average"
            >
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-0.5 rounded-full"
                  style={{ backgroundColor: '#f59e0b' }}
                />
                MA7
              </span>
            </ToolbarBtn>
            <ToolbarBtn
              active={showMA25}
              onClick={() => setShowMA25((v) => !v)}
              title="25-period Moving Average"
            >
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-0.5 rounded-full"
                  style={{ backgroundColor: '#8b5cf6' }}
                />
                MA25
              </span>
            </ToolbarBtn>

            <div className="w-px h-5 bg-border/50 mx-1.5" />

            <ToolbarBtn
              active={showVolume}
              onClick={() => setShowVolume((v) => !v)}
              title="Toggle Volume"
            >
              Vol
            </ToolbarBtn>
            <ToolbarBtn
              active={showPivots}
              onClick={() => setShowPivots((v) => !v)}
              title="Show Pivot High/Low markers"
            >
              Pivots
            </ToolbarBtn>
          </div>
        </>
      )}

      {/* Chart area */}
      {candles.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-accent/10 text-muted-foreground gap-2"
          style={{ height }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="opacity-30"
          >
            <path d="M3 3v18h18" />
            <path d="M7 16l4-8 4 4 4-6" />
          </svg>
          <span className="text-sm">No price data available yet</span>
          <span className="text-xs opacity-60">
            Trade to generate chart data
          </span>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-border/30 bg-card/30">
          <div ref={chartContainerRef} />
        </div>
      )}
    </div>
  );
});
