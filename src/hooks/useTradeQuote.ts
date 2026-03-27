import { useState, useEffect, useRef } from 'react';
import { parseUnits } from 'viem';
import { getContractData } from '../contracts';
import { readContractCached } from '../utils/contractCache';
import {
  TradingPhase,
  FeeType,
  type TradeQuote,
  EMPTY_QUOTE,
} from '../types/trading';

interface UseTradeQuoteParams {
  playerId: number | null;
  action: 'buy' | 'sell';
  /** USDC amount for buy, token amount for sell */
  inputAmount: string;
  phase: TradingPhase;
  /** Debounce delay in ms (default 400) */
  debounceMs?: number;
}

/**
 * Phase-aware debounced trade quote hook.
 *
 * - BondingCurve: calls BondingCurve.getBuyPrice/getSellPrice (returns cost, fee)
 * - FDFPair: calls FDFPair.getBuyPrice/getSellPrice (returns arrays with fee types)
 *
 * Returns a unified TradeQuote regardless of phase.
 */
export function useTradeQuote({
  playerId,
  action,
  inputAmount,
  phase,
  debounceMs = 400,
}: UseTradeQuoteParams): TradeQuote {
  const [quote, setQuote] = useState<TradeQuote>(EMPTY_QUOTE);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Clear on invalid input
    const amount = parseFloat(inputAmount);
    if (
      !playerId ||
      !inputAmount ||
      isNaN(amount) ||
      amount <= 0 ||
      phase === TradingPhase.Unknown ||
      phase === TradingPhase.Cancelled
    ) {
      setQuote(EMPTY_QUOTE);
      return;
    }

    // Mark stale immediately
    setQuote((prev) => ({ ...prev, stale: true }));

    // Clear previous debounce
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const currentRequestId = ++requestIdRef.current;
      setQuote((prev) => ({ ...prev, loading: true, error: null }));

      try {
        let result: TradeQuote;

        if (phase === TradingPhase.BondingCurve) {
          result = await fetchBondingCurveQuote(playerId, inputAmount, action);
        } else {
          // FDFPair or Graduated (graduated users trade on FDFPair after claiming)
          result = await fetchFDFPairQuote(playerId, inputAmount, action);
        }

        // Discard if a newer request was issued
        if (currentRequestId !== requestIdRef.current) return;

        setQuote(result);
      } catch (err) {
        if (currentRequestId !== requestIdRef.current) return;
        setQuote({
          ...EMPTY_QUOTE,
          error: err instanceof Error ? err.message : 'Quote fetch failed',
        });
      }
    }, debounceMs);

    return () => clearTimeout(debounceRef.current);
  }, [playerId, action, inputAmount, phase, debounceMs]);

  return quote;
}

/**
 * Fetch quote from BondingCurve contract.
 *
 * BondingCurve.getBuyPrice(playerId, tokenAmount) → (cost, fee)
 * BondingCurve.getSellPrice(playerId, tokenAmount) → (refundAmount, fee)
 *
 * For buy: user specifies USDC to spend, we need to estimate token amount first
 * using the virtual reserve formula, then call getBuyPrice for exact cost.
 *
 * For sell: user specifies tokens to sell, getSellPrice returns exact USDC refund.
 */
async function fetchBondingCurveQuote(
  playerId: number,
  inputAmount: string,
  action: 'buy' | 'sell'
): Promise<TradeQuote> {
  const bondingCurveContract = getContractData('BondingCurve');

  if (action === 'sell') {
    // User specifies token amount to sell
    const tokenAmount = parseUnits(inputAmount, 18);

    const result = (await readContractCached({
      address: bondingCurveContract.address as `0x${string}`,
      abi: bondingCurveContract.abi as any,
      functionName: 'getSellPrice',
      args: [BigInt(playerId), tokenAmount],
    })) as [bigint, bigint];

    const [refundAmount, fee] = result;

    // Estimate fee rate from the returned values
    const grossRefund = refundAmount + fee;
    const feeRate = grossRefund > 0n ? Number((fee * 100000n) / grossRefund) : 0;

    return {
      amountToReceive: refundAmount,
      feeAmount: fee,
      feeRate,
      feeType: null, // Bonding curve has flat fee
      loading: false,
      error: null,
      stale: false,
    };
  }

  // Buy: user specifies USDC to spend.
  // We need to estimate how many tokens they can buy.
  // First get the launch info to compute virtual reserves, then estimate tokens.
  const launchResult = await readContractCached({
    address: bondingCurveContract.address as `0x${string}`,
    abi: bondingCurveContract.abi as any,
    functionName: 'getLaunchInfo',
    args: [BigInt(playerId)],
  });

  const launch = launchResult as any;
  const virtualTokenReserve = BigInt(launch.virtualTokenReserve ?? launch[6] ?? 0);
  const virtualCurrencyReserve = BigInt(launch.virtualCurrencyReserve ?? launch[7] ?? 0);
  const tokensSold = BigInt(launch.tokensSold ?? launch[2] ?? 0);
  const currencyCollected = BigInt(launch.currencyCollected ?? launch[3] ?? 0);

  const effTokens = virtualTokenReserve - tokensSold;
  const effCurrency = virtualCurrencyReserve + currencyCollected;

  if (effTokens === 0n || effCurrency === 0n) {
    return { ...EMPTY_QUOTE, error: 'No liquidity available' };
  }

  // Estimate tokens from USDC spend (before fee).
  // The bonding curve fee is applied on top of cost, so the user's USDC input
  // must cover cost + fee.  We need to find tokenAmount such that:
  //   cost + fee <= usdcInput
  // where cost = ceil(effCurrency * tokenAmount / (effTokens - tokenAmount))
  //   and fee = ceil(cost * feeBps / 100000)
  //
  // We estimate by working backward: remove fee from input, then compute tokens.
  // Get the fee rate from contract
  let feeBps = 2000n; // default 2%
  try {
    const feeResult = await readContractCached({
      address: bondingCurveContract.address as `0x${string}`,
      abi: bondingCurveContract.abi as any,
      functionName: 'bondingCurveFeeBps',
      args: [],
    });
    feeBps = BigInt(feeResult as any);
  } catch {
    // Use default
  }

  const usdcInput = parseUnits(inputAmount, 6);
  // Approximate USDC available for AMM (removing fee portion)
  // cost ≈ usdcInput * 100000 / (100000 + feeBps)
  const costEstimate = (usdcInput * 100000n) / (100000n + feeBps);

  // tokens ≈ effTokens - (effTokens * effCurrency) / (effCurrency + costEstimate)
  // = effTokens * costEstimate / (effCurrency + costEstimate)
  let tokenEstimate =
    (effTokens * costEstimate) / (effCurrency + costEstimate);

  // Ensure we don't exceed available tokens
  const totalForSale = BigInt(launch.totalTokensForSale ?? launch[1] ?? 0);
  const remaining = totalForSale - tokensSold;
  if (tokenEstimate > remaining) {
    tokenEstimate = remaining;
  }
  if (tokenEstimate === 0n) {
    return { ...EMPTY_QUOTE, error: 'Amount too small' };
  }

  // Now verify with the actual contract view function
  const buyResult = (await readContractCached({
    address: bondingCurveContract.address as `0x${string}`,
    abi: bondingCurveContract.abi as any,
    functionName: 'getBuyPrice',
    args: [BigInt(playerId), tokenEstimate],
  })) as [bigint, bigint];

  const [cost, fee] = buyResult;
  const totalCost = cost + fee;

  // If total cost exceeds input, reduce token estimate and retry
  if (totalCost > usdcInput && tokenEstimate > 1n) {
    // Scale down proportionally
    const adjustedTokens = (tokenEstimate * usdcInput) / totalCost;
    if (adjustedTokens === 0n) {
      return { ...EMPTY_QUOTE, error: 'Amount too small' };
    }

    const adjustedResult = (await readContractCached({
      address: bondingCurveContract.address as `0x${string}`,
      abi: bondingCurveContract.abi as any,
      functionName: 'getBuyPrice',
      args: [BigInt(playerId), adjustedTokens],
    })) as [bigint, bigint];

    return {
      amountToReceive: adjustedTokens,
      feeAmount: adjustedResult[1],
      feeRate: Number(feeBps),
      feeType: null,
      loading: false,
      error: null,
      stale: false,
    };
  }

  return {
    amountToReceive: tokenEstimate,
    feeAmount: fee,
    feeRate: Number(feeBps),
    feeType: null,
    loading: false,
    error: null,
    stale: false,
  };
}

/**
 * Fetch quote from FDFPair contract.
 *
 * FDFPair.getBuyPrice(playerIds[], tokenAmounts[], currencyAmounts[])
 *   → (amountsToReceive[], feeAmounts[], feeRates[], feeTypes[])
 *
 * FDFPair.getSellPrice(playerIds[], tokenAmounts[])
 *   → (amountsToReceive[], feeAmounts[], feeRates[], feeTypes[])
 */
async function fetchFDFPairQuote(
  playerId: number,
  inputAmount: string,
  action: 'buy' | 'sell'
): Promise<TradeQuote> {
  const fdfPairContract = getContractData('FDFPair');

  if (action === 'buy') {
    // User specifies USDC to spend
    const usdcAmount = parseUnits(inputAmount, 6);

    // Contract requires EITHER token amounts OR currency amounts, not both.
    // Pass empty array for tokens when specifying USDC to spend.
    const result = (await readContractCached({
      address: fdfPairContract.address as `0x${string}`,
      abi: fdfPairContract.abi as any,
      functionName: 'getBuyPrice',
      args: [
        [BigInt(playerId)],
        [], // empty — we're specifying currency, not tokens
        [usdcAmount],
      ],
    })) as [bigint[], bigint[], bigint[], number[]];

    const [amountsToReceive, feeAmounts, feeRates, feeTypes] = result;

    return {
      amountToReceive: amountsToReceive[0] ?? 0n,
      feeAmount: feeAmounts[0] ?? 0n,
      feeRate: Number(feeRates[0] ?? 0n),
      feeType: (feeTypes[0] ?? 0) as FeeType,
      loading: false,
      error: null,
      stale: false,
    };
  }

  // Sell: user specifies token amount
  const tokenAmount = parseUnits(inputAmount, 18);

  const result = (await readContractCached({
    address: fdfPairContract.address as `0x${string}`,
    abi: fdfPairContract.abi as any,
    functionName: 'getSellPrice',
    args: [[BigInt(playerId)], [tokenAmount]],
  })) as [bigint[], bigint[], bigint[], number[]];

  const [amountsToReceive, feeAmounts, feeRates, feeTypes] = result;

  return {
    amountToReceive: amountsToReceive[0] ?? 0n,
    feeAmount: feeAmounts[0] ?? 0n,
    feeRate: Number(feeRates[0] ?? 0n),
    feeType: (feeTypes[0] ?? 0) as FeeType,
    loading: false,
    error: null,
    stale: false,
  };
}
