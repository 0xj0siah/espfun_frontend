import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

/** Fetches analytics overview (TVL, revenue, volume, users, top movers). */
export function useAnalyticsOverview(pollInterval = 60000) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const result = await apiService.getAnalyticsOverview();
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, pollInterval);
    return () => clearInterval(interval);
  }, [fetch, pollInterval]);

  return { data, loading, error, refetch: fetch };
}

/** Fetches TVL history for charting. */
export function useTVLHistory(days = 30) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiService.getTVLHistory(days);
        if (!cancelled) {
          setData(result.history || []);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load TVL data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [days]);

  return { data, loading, error };
}

/** Fetches revenue history for charting. Polls to pick up new trades. */
export function useRevenueHistory(period: 'hourly' | 'daily' = 'daily', days = 30, pollInterval = 60000) {
  const [data, setData] = useState<any[]>([]);
  const [totalDistributed, setTotalDistributed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const result = await apiService.getRevenueHistory(period, days);
      setData(result.timeline || []);
      setTotalDistributed(result.totalDistributed || 0);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  }, [period, days]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, pollInterval);
    return () => clearInterval(interval);
  }, [fetch, pollInterval]);

  return { data, totalDistributed, loading, error, refetch: fetch };
}

/** Fetches user's portfolio (requires auth). */
export function usePortfolio(pollInterval = 30000) {
  const [data, setData] = useState<{ totalValue: number; holdings: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const result = await apiService.getPortfolio();
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      setLoading(false);
      return;
    }
    fetch();
    const interval = setInterval(fetch, pollInterval);
    return () => clearInterval(interval);
  }, [fetch, pollInterval]);

  return { data, loading, error, refetch: fetch };
}

/** Fetches OHLC candle data for a player token. */
export function usePlayerOHLC(
  playerTokenId: string | null,
  interval: '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
  days = 7
) {
  const [candles, setCandles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerTokenId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await apiService.getPlayerOHLC(playerTokenId, interval, days);
        if (!cancelled) setCandles(result.candles || []);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [playerTokenId, interval, days]);

  return { candles, loading };
}

/** Fetches recent trades for a player (or all players). */
export function useRecentTrades(playerTokenId?: string, limit = 20, pollInterval = 15000) {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const result = await apiService.getRecentTrades(playerTokenId, limit);
      setTrades(result.trades || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [playerTokenId, limit]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, pollInterval);
    return () => clearInterval(interval);
  }, [fetch, pollInterval]);

  return { trades, loading, refetch: fetch };
}
