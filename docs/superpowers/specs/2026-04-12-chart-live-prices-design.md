# Chart Live Price Updates — Design Spec

## Context

Both charting implementations (CandlestickChart via lightweight-charts, TradingViewChart via TradingView widget) are disconnected from the PriceContext that powers the rest of the app. PriceContext polls the backend every 5s for live prices, but the charts rely on OHLC snapshots from the database which are only as fresh as the market cap scheduler. This makes the charts feel stale compared to the player cards, modal, and dashboard — all of which update every 5s.

## Goal

Wire PriceContext's 5s live prices into both chart implementations so the latest candle updates in real-time. Zero new API calls — reuse the existing PriceContext polling.

## Architecture

```
PriceContext (polls every 5s)
    │
    ├── rawPrices[playerId]
    │
AdvancedTradeView (orchestrator)
    │
    ├── livePrice prop ──► CandlestickChart
    │                        └── mainSeriesRef.update(lastBar)
    │
    └── pushLivePrice() ──► datafeed.ts
                              └── subscription.onTick(updatedBar)
```

## Changes

### 1. `src/lib/tradingview/datafeed.ts` — Export `pushLivePrice()`

Add a new exported function:

```typescript
export function pushLivePrice(tokenId: string, price: number): void
```

- Iterate `subscriptions` map, find any subscription whose `symbolInfo.ticker === tokenId`
- Build an updated bar: same `time` and `open` as the last bar, `close = price`, `high = max(lastHigh, price)`, `low = min(lastLow, price)`
- Call `subscription.onTick(updatedBar)`
- Track the last bar's OHLC in the subscription state (add `lastBar: Bar` to the `Subscription` interface)
- Update `lastBar` in both `startPolling` (when a new bar arrives from the OHLC endpoint) and `pushLivePrice` (when a live price update arrives)

### 2. `src/components/charts/CandlestickChart.tsx` — Accept `livePrice` prop

**Props change:**
```typescript
interface CandlestickChartProps {
  // ... existing props
  livePrice?: number;  // NEW: live price from PriceContext
}
```

**Implementation:**
- Add a `mainSeriesRef = useRef<ISeriesApi<any>>(null)` to persist the series across renders
- Add a `lastCandleRef = useRef<{ time: Time; open: number; high: number; low: number; close: number } | null>(null)` to track the current last candle
- In the chart creation effect, after `mainSeries.setData(candles)`, store `mainSeriesRef.current = mainSeries` and `lastCandleRef.current = candles[candles.length - 1]`
- Add a **separate** `useEffect` watching `livePrice`:
  - Skip if `mainSeriesRef.current` is null or `lastCandleRef.current` is null or `livePrice` is undefined/zero
  - Build updated bar: same `time` and `open`, `close = livePrice`, `high = max(existing high, livePrice)`, `low = min(existing low, livePrice)`
  - Call `mainSeriesRef.current.update(updatedBar)`
  - Update `lastCandleRef.current`
- Applies to all chart modes (candles, line, area) — for line/area, update value = livePrice

### 3. `src/components/AdvancedTradeView.tsx` — Connect PriceContext to charts

**Import:**
```typescript
import { usePriceContext } from '../context/PriceContext';
import { pushLivePrice } from '../lib/tradingview/datafeed';
```

**Live price extraction:**
```typescript
const { rawPrices } = usePriceContext();
const livePrice = rawPrices[player.id] ?? undefined;
```

**CandlestickChart — pass as prop:**
```tsx
<CandlestickChart
  candles={candles}
  loading={chartLoading}
  height={h}
  timeRange={timeRange}
  onTimeRangeChange={handleTimeRangeChange}
  playerName={player.name}
  isMobile={isMobile}
  livePrice={livePrice}   // NEW
/>
```

**TradingView — push via effect:**
```typescript
useEffect(() => {
  if (!useFallback && livePrice != null && livePrice > 0) {
    pushLivePrice(player.id.toString(), livePrice);
  }
}, [useFallback, livePrice, player.id]);
```

## Files Modified

| File | Change |
|------|--------|
| `src/lib/tradingview/datafeed.ts` | Add `lastBar` to Subscription, export `pushLivePrice()` |
| `src/components/charts/CandlestickChart.tsx` | Add `livePrice` prop, `mainSeriesRef`, `lastCandleRef`, live update effect |
| `src/components/AdvancedTradeView.tsx` | Import PriceContext, pass `livePrice` to CandlestickChart, call `pushLivePrice` for TradingView |

## What stays the same

- PriceContext polling (already 5s) — no changes
- Backend OHLC endpoint — still provides historical candle data
- usePlayerOHLC hook — still fetches initial candle data for CandlestickChart
- TradingView datafeed polling — still runs for historical bar updates (the live price push supplements it, doesn't replace it)
- All other price consumers (cards, modal, dashboard) — unchanged

## Verification

1. `npm run build` — no TS errors
2. Open AdvancedTradeView for a player, watch the chart — latest candle close should update every ~5s
3. Switch between CandlestickChart and TradingView (if available) — both should show live updates
4. Verify chart legend/crosshair reflects the updated price when hovering the latest candle
5. Verify historical candles are unaffected (only the last candle updates)
6. Tab away and return — prices should catch up on the first PriceContext refresh
