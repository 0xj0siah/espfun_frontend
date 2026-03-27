// Trading types for bonding curve and FDFPair integration

/**
 * Player trading phase — determines which contract and UI to use.
 */
export enum TradingPhase {
  /** Active bonding curve launch — buy/sell via BondingCurve contract */
  BondingCurve = 'bonding_curve',
  /** Graduated but user has unclaimed tokens — show claim CTA */
  Graduated = 'graduated',
  /** Normal AMM trading via FDFPair contract */
  FDFPair = 'fdfpair',
  /** Launch was cancelled — show refund CTA */
  Cancelled = 'cancelled',
  /** Loading or no data yet */
  Unknown = 'unknown',
}

/**
 * Fee types returned by FDFPair (bonding curve has flat fee, no types).
 */
export enum FeeType {
  Normal = 0,
  FlashSale = 1,
  FeeTier = 2,
}

/**
 * Unified trade quote across both bonding curve and FDFPair phases.
 */
export interface TradeQuote {
  /** Tokens received (buy) or USDC received (sell) */
  amountToReceive: bigint;
  /** Fee amount in USDC */
  feeAmount: bigint;
  /** Fee rate in basis points (2000 = 2%, 5000 = 5%) */
  feeRate: number;
  /** Fee type — null for bonding curve (flat fee) */
  feeType: FeeType | null;
  /** Quote is being fetched */
  loading: boolean;
  /** Error message if quote fetch failed */
  error: string | null;
  /** Input changed but quote not yet refreshed */
  stale: boolean;
}

/**
 * Bonding curve launch info from BondingCurve.getLaunchInfo().
 */
export interface LaunchInfo {
  playerId: bigint;
  totalTokensForSale: bigint;
  tokensSold: bigint;
  currencyCollected: bigint;
  tokensForLiquidity: bigint;
  fundingTarget: bigint;
  virtualTokenReserve: bigint;
  virtualCurrencyReserve: bigint;
  createdAt: bigint;
  deadline: bigint;
  graduated: boolean;
  cancelled: boolean;
}

/**
 * Funding progress from BondingCurve.getProgress().
 */
export interface LaunchProgress {
  /** USDC raised so far */
  raised: bigint;
  /** Funding target in USDC */
  target: bigint;
  /** Percentage complete in basis points (10000 = 100%) */
  percentComplete: number;
}

export type TransactionStatus = 'idle' | 'pending' | 'success' | 'error';

/** Empty quote for initial state */
export const EMPTY_QUOTE: TradeQuote = {
  amountToReceive: 0n,
  feeAmount: 0n,
  feeRate: 0,
  feeType: null,
  loading: false,
  error: null,
  stale: false,
};

/**
 * Human-readable label for fee types.
 */
export function feeTypeLabel(feeType: FeeType | null): string {
  switch (feeType) {
    case FeeType.Normal: return 'Normal';
    case FeeType.FlashSale: return 'Flash Sale';
    case FeeType.FeeTier: return 'Elevated';
    case null: return 'Flat';
    default: return 'Unknown';
  }
}

/**
 * Tailwind color class for fee type badges.
 */
export function feeTypeBadgeColor(feeType: FeeType | null): string {
  switch (feeType) {
    case FeeType.Normal: return 'text-muted-foreground';
    case FeeType.FlashSale: return 'text-orange-500';
    case FeeType.FeeTier: return 'text-yellow-500';
    case null: return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
}
