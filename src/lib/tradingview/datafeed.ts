import type {
  IBasicDataFeed,
  DatafeedConfiguration,
  LibrarySymbolInfo,
  ResolutionString,
  PeriodParams,
  Bar,
  HistoryCallback,
  DatafeedErrorCallback,
  ResolveCallback,
  SearchSymbolsCallback,
  SubscribeBarsCallback,
  OnReadyCallback,
} from '../../types/tradingview';
import { apiService } from '../../services/apiService';

// ---------------------------------------------------------------------------
// Resolution mapping: TradingView resolution → backend interval
// ---------------------------------------------------------------------------

type BackendInterval = '5m' | '15m' | '1h' | '4h' | '1d';

const RESOLUTION_MAP: Record<string, BackendInterval> = {
  '5': '5m',
  '15': '15m',
  '60': '1h',
  '240': '4h',
  '1D': '1d',
  'D': '1d',
};

const SUPPORTED_RESOLUTIONS: ResolutionString[] = ['5', '15', '60', '240', '1D'];

function resolutionToInterval(resolution: string): BackendInterval {
  return RESOLUTION_MAP[resolution] ?? '1h';
}

/** Estimate how many days of data we need for the given time range. */
function periodToDays(from: number, to: number): number {
  const diffSec = to - from;
  const days = Math.ceil(diffSec / 86400);
  // Clamp to reasonable range; always fetch a bit extra for countBack coverage
  return Math.min(Math.max(days + 2, 3), 365);
}

/** Seconds in one bar for a given resolution. */
function resolutionToSeconds(resolution: string): number {
  if (resolution === '1D' || resolution === 'D') return 86400;
  const mins = parseInt(resolution, 10);
  return isNaN(mins) ? 3600 : mins * 60;
}

// ---------------------------------------------------------------------------
// Streaming (polling-based real-time updates)
// ---------------------------------------------------------------------------

interface Subscription {
  symbolInfo: LibrarySymbolInfo;
  resolution: string;
  onTick: SubscribeBarsCallback;
  lastBarTime: number;
  lastBar: Bar | null;
  timer: ReturnType<typeof setInterval>;
}

const subscriptions = new Map<string, Subscription>();

function startPolling(
  listenerGuid: string,
  symbolInfo: LibrarySymbolInfo,
  resolution: string,
  onTick: SubscribeBarsCallback,
  lastBarTime: number
) {
  const interval = resolutionToInterval(resolution);
  const pollMs = resolutionToSeconds(resolution) < 3600 ? 15_000 : 30_000;

  const timer = setInterval(async () => {
    try {
      const tokenId = symbolInfo.ticker ?? symbolInfo.name;
      const result = await apiService.getPlayerOHLC(tokenId, interval, 1);
      const candles: any[] = result.candles ?? [];
      if (candles.length === 0) return;

      const sub = subscriptions.get(listenerGuid);
      if (!sub) return;

      // Push the most recent candle as a real-time bar update
      const latest = candles[candles.length - 1];
      const bar: Bar = {
        time: latest.time * 1000,
        open: Number(latest.open),
        high: Number(latest.high),
        low: Number(latest.low),
        close: Number(latest.close),
        volume: latest.volume != null ? Number(latest.volume) : undefined,
      };

      if (bar.time >= sub.lastBarTime) {
        sub.lastBarTime = bar.time;
        sub.lastBar = bar;
        onTick(bar);
      }
    } catch {
      // Silent fail — next poll will retry
    }
  }, pollMs);

  subscriptions.set(listenerGuid, {
    symbolInfo,
    resolution,
    onTick,
    lastBarTime,
    lastBar: null,
    timer,
  });
}

function stopPolling(listenerGuid: string) {
  const sub = subscriptions.get(listenerGuid);
  if (sub) {
    clearInterval(sub.timer);
    subscriptions.delete(listenerGuid);
  }
}

/**
 * Push a live price into any active TradingView subscription for the given token.
 * Called from AdvancedTradeView when PriceContext updates.
 */
export function pushLivePrice(tokenId: string, price: number): void {
  subscriptions.forEach((sub) => {
    const subTokenId = sub.symbolInfo.ticker ?? sub.symbolInfo.name;
    if (subTokenId !== tokenId) return;
    if (!sub.lastBar) return;

    const updatedBar: Bar = {
      time: sub.lastBar.time,
      open: sub.lastBar.open,
      high: Math.max(sub.lastBar.high, price),
      low: Math.min(sub.lastBar.low, price),
      close: price,
      volume: sub.lastBar.volume,
    };

    sub.lastBar = updatedBar;
    sub.onTick(updatedBar);
  });
}

// ---------------------------------------------------------------------------
// Datafeed Configuration
// ---------------------------------------------------------------------------

const DATAFEED_CONFIG: DatafeedConfiguration = {
  supported_resolutions: SUPPORTED_RESOLUTIONS,
  exchanges: [
    { value: 'ESP.FUN', name: 'ESP.FUN', desc: 'ESP.FUN Fantasy Esports' },
  ],
  symbols_types: [
    { name: 'Player', value: 'crypto' },
  ],
  supports_marks: false,
  supports_timescale_marks: false,
  supports_time: false,
  supports_search: false,
  supports_group_request: false,
};

// ---------------------------------------------------------------------------
// Player symbol registry — populated by the component before chart loads
// ---------------------------------------------------------------------------

export interface PlayerSymbol {
  tokenId: string;
  name: string;
  game?: string;
  price?: string;
}

let registeredPlayers: PlayerSymbol[] = [];

/** Register players that can be resolved by the datafeed. */
export function registerPlayers(players: PlayerSymbol[]) {
  registeredPlayers = players;
}

/** Register a single player (convenience for single-player views). */
export function registerPlayer(player: PlayerSymbol) {
  const idx = registeredPlayers.findIndex((p) => p.tokenId === player.tokenId);
  if (idx >= 0) {
    registeredPlayers[idx] = player;
  } else {
    registeredPlayers.push(player);
  }
}

// ---------------------------------------------------------------------------
// Datafeed implementation
// ---------------------------------------------------------------------------

export function createDatafeed(): IBasicDataFeed {
  return {
    onReady(callback: OnReadyCallback) {
      // Must be async per TradingView docs
      setTimeout(() => callback(DATAFEED_CONFIG), 0);
    },

    searchSymbols(
      userInput: string,
      _exchange: string,
      _symbolType: string,
      onResult: SearchSymbolsCallback
    ) {
      const query = userInput.toLowerCase();
      const results = registeredPlayers
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.tokenId.includes(query)
        )
        .map((p) => ({
          symbol: p.name,
          full_name: `ESP.FUN:${p.name}`,
          description: p.game ? `${p.name} — ${p.game}` : p.name,
          exchange: 'ESP.FUN',
          ticker: p.tokenId,
          type: 'crypto',
        }));
      onResult(results);
    },

    resolveSymbol(
      symbolName: string,
      onResolve: ResolveCallback,
      onError: DatafeedErrorCallback
    ) {
      setTimeout(() => {
        // Find by tokenId or name
        const player = registeredPlayers.find(
          (p) =>
            p.tokenId === symbolName ||
            p.name === symbolName ||
            `ESP.FUN:${p.name}` === symbolName
        );

        if (!player) {
          onError('unknown_symbol');
          return;
        }

        const symbolInfo: LibrarySymbolInfo = {
          ticker: player.tokenId,
          name: player.name,
          description: player.game
            ? `${player.name} (${player.game})`
            : player.name,
          type: 'crypto',
          session: '24x7',
          exchange: 'ESP.FUN',
          listed_exchange: 'ESP.FUN',
          timezone: 'Etc/UTC',
          format: 'price',
          pricescale: 1000000, // 6 decimal places for small crypto prices
          minmov: 1,
          has_intraday: true,
          has_daily: true,
          has_weekly_and_monthly: false,
          supported_resolutions: SUPPORTED_RESOLUTIONS,
          intraday_multipliers: ['5', '15', '60', '240'],
          volume_precision: 2,
          data_status: 'streaming',
          visible_plots_set: 'ohlcv',
        };

        onResolve(symbolInfo);
      }, 0);
    },

    async getBars(
      symbolInfo: LibrarySymbolInfo,
      resolution: ResolutionString,
      periodParams: PeriodParams,
      onResult: HistoryCallback,
      onError: DatafeedErrorCallback
    ) {
      const { from, to, firstDataRequest } = periodParams;
      const tokenId = symbolInfo.ticker ?? symbolInfo.name;
      const interval = resolutionToInterval(resolution);
      const days = periodToDays(from, to);

      try {
        const result = await apiService.getPlayerOHLC(tokenId, interval, days);
        const candles: any[] = result.candles ?? [];

        if (candles.length === 0) {
          onResult([], { noData: true });
          return;
        }

        const bars: Bar[] = candles
          .map((c: any) => ({
            time: c.time * 1000, // Backend returns seconds, TV expects ms
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: c.volume != null ? Number(c.volume) : Math.abs(c.high - c.low) * 1000,
          }))
          .filter((bar) => bar.time >= from * 1000 && bar.time < to * 1000)
          .sort((a, b) => a.time - b.time);

        if (bars.length === 0) {
          onResult([], { noData: true });
          return;
        }

        onResult(bars, { noData: false });
      } catch (err: any) {
        onError(err.message ?? 'Failed to fetch bars');
      }
    },

    subscribeBars(
      symbolInfo: LibrarySymbolInfo,
      resolution: ResolutionString,
      onTick: SubscribeBarsCallback,
      listenerGuid: string,
      _onResetCacheNeeded: () => void
    ) {
      startPolling(listenerGuid, symbolInfo, resolution, onTick, Date.now());
    },

    unsubscribeBars(listenerGuid: string) {
      stopPolling(listenerGuid);
    },
  };
}
