import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/apiService';
import { getActivePlayerIds } from '../utils/contractInteractions';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { PRICE_POLL_INTERVAL_MS } from '../constants/trading';
import fakeData from '../fakedata.json';

/** Format a USDC price with enough precision to show meaningful digits */
function formatPrice(price: number): string {
  if (price === 0) return '0.00 USDC';
  if (price >= 1) return `${price.toFixed(2)} USDC`;
  if (price >= 0.01) return `${price.toFixed(4)} USDC`;
  const leadingZeros = Math.max(0, Math.floor(-Math.log10(Math.abs(price))));
  return `${price.toFixed(leadingZeros + 2)} USDC`;
}

interface PriceContextType {
  /** Formatted prices for display (e.g. "0.0042 USDC") */
  prices: Record<number, string>;
  /** Raw numeric prices for calculations */
  rawPrices: Record<number, number>;
  /** 24h price change percentages keyed by playerTokenId string */
  priceChanges: Record<string, number | null>;
  /** Active player IDs from the contract */
  activePlayerIds: number[];
  /** True while the initial price fetch is in progress */
  pricesLoading: boolean;
  /** Timestamp of the last successful price update */
  lastUpdated: number;
  /** Force an immediate price refresh (e.g. after a trade) */
  refreshPrices: () => Promise<void>;
}

const PriceContext = createContext<PriceContextType>({
  prices: {},
  rawPrices: {},
  priceChanges: {},
  activePlayerIds: [],
  pricesLoading: true,
  lastUpdated: 0,
  refreshPrices: async () => {},
});

export const usePriceContext = () => useContext(PriceContext);

export const PriceProvider = ({ children }: { children: React.ReactNode }) => {
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [rawPrices, setRawPrices] = useState<Record<number, number>>({});
  const [priceChanges, setPriceChanges] = useState<Record<string, number | null>>({});
  const [activePlayerIds, setActivePlayerIds] = useState<number[]>([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(0);

  const isVisible = usePageVisibility();
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const changesIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch active player IDs on mount ──────────────────────────────────────
  useEffect(() => {
    const fetchActiveIds = async () => {
      try {
        const ids = await getActivePlayerIds();
        setActivePlayerIds(ids.map(id => Number(id)));
      } catch {
        // Fallback to fake data IDs if contract fails
        setActivePlayerIds(fakeData.teamPlayers.map(p => p.id));
      }
    };
    fetchActiveIds();
  }, []);

  // ── Fetch prices from backend ─────────────────────────────────────────────
  const fetchPrices = useCallback(async (bustCache = false) => {
    try {
      const data = await apiService.getLivePrices(bustCache);

      const newPrices: Record<number, string> = {};
      const newRawPrices: Record<number, number> = {};

      for (const { playerTokenId, price } of data.prices) {
        newPrices[playerTokenId] = formatPrice(price);
        newRawPrices[playerTokenId] = price;
      }

      setPrices(newPrices);
      setRawPrices(newRawPrices);
      setLastUpdated(data.timestamp);
      setPricesLoading(false);
    } catch (err) {
      console.error('PriceContext: Failed to fetch live prices:', err);
      setPricesLoading(false);
    }
  }, []);

  // ── Fetch 24h price changes ───────────────────────────────────────────────
  const fetchPriceChanges = useCallback(async () => {
    try {
      const data = await apiService.getPlayerPriceChanges();
      const map: Record<string, number | null> = {};
      for (const p of data.players || []) {
        map[p.playerTokenId] = p.change24h;
      }
      setPriceChanges(map);
    } catch {
      // Non-critical — keep existing changes
    }
  }, []);

  // ── Manual refresh (post-trade) ───────────────────────────────────────────
  const refreshPrices = useCallback(async () => {
    await fetchPrices(true); // bust cache

    // Reset the polling timer so next tick is a full interval away
    if (priceIntervalRef.current) {
      clearInterval(priceIntervalRef.current);
    }
    priceIntervalRef.current = setInterval(() => fetchPrices(), PRICE_POLL_INTERVAL_MS);
  }, [fetchPrices]);

  // ── Visibility-aware price polling ────────────────────────────────────────
  useEffect(() => {
    if (!isVisible) {
      // Tab hidden — stop polling
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = null;
      }
      return;
    }

    // Tab visible — immediate fetch + start interval
    fetchPrices();
    priceIntervalRef.current = setInterval(() => fetchPrices(), PRICE_POLL_INTERVAL_MS);

    return () => {
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = null;
      }
    };
  }, [isVisible, fetchPrices]);

  // ── Visibility-aware price changes polling (60s) ──────────────────────────
  useEffect(() => {
    if (!isVisible) {
      if (changesIntervalRef.current) {
        clearInterval(changesIntervalRef.current);
        changesIntervalRef.current = null;
      }
      return;
    }

    fetchPriceChanges();
    changesIntervalRef.current = setInterval(fetchPriceChanges, 60000);

    return () => {
      if (changesIntervalRef.current) {
        clearInterval(changesIntervalRef.current);
        changesIntervalRef.current = null;
      }
    };
  }, [isVisible, fetchPriceChanges]);

  return (
    <PriceContext.Provider
      value={{
        prices,
        rawPrices,
        priceChanges,
        activePlayerIds,
        pricesLoading,
        lastUpdated,
        refreshPrices,
      }}
    >
      {children}
    </PriceContext.Provider>
  );
};
