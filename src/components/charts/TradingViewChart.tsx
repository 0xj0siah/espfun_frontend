import { useEffect, useRef, useCallback, memo, useState } from 'react';
import {
  createDatafeed,
  registerPlayer,
  type PlayerSymbol,
} from '../../lib/tradingview/datafeed';
import type {
  IChartingLibraryWidget,
  ChartingLibraryWidgetOptions,
} from '../../types/tradingview';
import { Skeleton } from '../ui/skeleton';

interface TradingViewChartProps {
  /** Player token ID — used as the symbol ticker */
  playerTokenId: string;
  /** Display name shown in the chart header */
  playerName: string;
  /** Game name for symbol description */
  game?: string;
  /** Current price (for symbol registration) */
  price?: string;
  /** Chart container height in px */
  height?: number;
}

/** Check if the TradingView Charting Library is available. */
function isTVAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.TradingView?.widget;
}

const LIBRARY_PATH = '/charting_library/';

/** Dark theme overrides matching the ESP.FUN design system */
const DARK_OVERRIDES: Record<string, string | number | boolean> = {
  'paneProperties.background': '#09090b',
  'paneProperties.backgroundType': 'solid',
  'paneProperties.vertGridProperties.color': 'rgba(255,255,255,0.03)',
  'paneProperties.horzGridProperties.color': 'rgba(255,255,255,0.03)',
  'scalesProperties.backgroundColor': '#09090b',
  'scalesProperties.lineColor': 'rgba(255,255,255,0.06)',
  'scalesProperties.textColor': '#a1a1aa',
  'mainSeriesProperties.candleStyle.upColor': '#22c55e',
  'mainSeriesProperties.candleStyle.downColor': '#ef4444',
  'mainSeriesProperties.candleStyle.borderUpColor': '#22c55e',
  'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
  'mainSeriesProperties.candleStyle.wickUpColor': '#22c55e',
  'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
};

const DARK_STUDIES_OVERRIDES: Record<string, string | number | boolean> = {
  'volume.volume.color.0': 'rgba(239,68,68,0.3)',
  'volume.volume.color.1': 'rgba(34,197,94,0.3)',
};

export default memo(function TradingViewChart({
  playerTokenId,
  playerName,
  game,
  price,
  height = 420,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<IChartingLibraryWidget | null>(null);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  // Register the player symbol so the datafeed can resolve it
  useEffect(() => {
    registerPlayer({
      tokenId: playerTokenId,
      name: playerName,
      game,
      price,
    });
  }, [playerTokenId, playerName, game, price]);

  // Detect dark mode
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  // Initialize the widget
  useEffect(() => {
    if (!containerRef.current) return;

    if (!isTVAvailable()) {
      setUnavailable(true);
      return;
    }

    // Delay widget creation by one frame so the container has settled its
    // layout dimensions.  On mobile the initial render can produce a
    // momentarily unconstrained width that TradingView reads via autosize,
    // pushing sibling elements to the right.
    let disposed = false;
    const frameId = requestAnimationFrame(() => {
      if (disposed || !containerRef.current) return;
      initWidget(containerRef.current);
    });

    function initWidget(container: HTMLDivElement) {
    const datafeed = createDatafeed();

    const widgetOptions: ChartingLibraryWidgetOptions = {
      container,
      datafeed,
      symbol: playerTokenId,
      interval: '60',
      library_path: LIBRARY_PATH,
      locale: 'en',
      autosize: true,
      theme: isDark ? 'Dark' : 'Light',
      timezone: 'Etc/UTC',

      // Tailored feature flags for a crypto trading view
      disabled_features: [
        'header_symbol_search',
        'header_compare',
        'symbol_search_hot_key',
        'display_market_status',
        'go_to_date',
        'timeframes_toolbar',
        'use_localstorage_for_settings',
        'volume_force_overlay',
      ],
      enabled_features: [
        'hide_left_toolbar_by_default',
        'study_templates',
        'side_toolbar_in_fullscreen_mode',
        'header_in_fullscreen_mode',
      ],

      overrides: isDark ? DARK_OVERRIDES : {},
      studies_overrides: isDark ? DARK_STUDIES_OVERRIDES : {},

      loading_screen: {
        backgroundColor: isDark ? '#09090b' : '#ffffff',
        foregroundColor: isDark ? '#a1a1aa' : '#71717a',
      },

      time_frames: [
        { text: '1h', resolution: '5' as any, description: '1 Hour' },
        { text: '1D', resolution: '15' as any, description: '1 Day' },
        { text: '7D', resolution: '60' as any, description: '7 Days' },
        { text: '1M', resolution: '240' as any, description: '1 Month' },
        { text: '1Y', resolution: '1D' as any, description: '1 Year' },
      ],
    };

    const Widget = window.TradingView!.widget;
    const tvWidget = new Widget(widgetOptions);
    widgetRef.current = tvWidget;

    tvWidget.onChartReady(() => {
      setReady(true);

      // Add volume indicator by default
      tvWidget.activeChart().createStudy('Volume', false, false, undefined, {
        'volume.volume.color.0': 'rgba(239,68,68,0.3)',
        'volume.volume.color.1': 'rgba(34,197,94,0.3)',
      });
    });
    } // end initWidget

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
      setReady(false);
    };
  }, [playerTokenId, isDark]);

  // Update symbol if player changes without full remount
  const prevTokenRef = useRef(playerTokenId);
  useEffect(() => {
    if (
      widgetRef.current &&
      ready &&
      prevTokenRef.current !== playerTokenId
    ) {
      widgetRef.current.activeChart().setSymbol(playerTokenId);
      prevTokenRef.current = playerTokenId;
    }
  }, [playerTokenId, ready]);

  // If TradingView library isn't available, render nothing (parent will fallback)
  if (unavailable) {
    return null;
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-border/30 bg-card/30 w-full max-w-full">
      {!ready && (
        <div className="absolute inset-0 z-10">
          <Skeleton className="w-full h-full rounded-xl" />
        </div>
      )}
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full max-w-full overflow-hidden"
      />
    </div>
  );
});
