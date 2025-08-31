// Utility functions for contract interactions and formatting
import { formatEther } from 'viem';

// Format wei to ETH string
export function formatPriceToETH(wei: bigint | string | number): string {
  if (typeof wei === 'string' && wei.includes('ETH')) {
    return wei; // Already formatted
  }
  
  if (typeof wei === 'string') {
    wei = BigInt(wei);
  } else if (typeof wei === 'number') {
    wei = BigInt(wei);
  }
  
  try {
    const ethValue = formatEther(wei);
    return `${parseFloat(ethValue).toFixed(3)} ETH`;
  } catch (error) {
    console.error('Error formatting price:', error);
    return '0.000 ETH';
  }
}

// Parse ETH string to number for calculations
export function parseETHToNumber(ethString: string): number {
  return parseFloat(ethString.replace(' ETH', ''));
}

// Contract method signatures for FDFPair
export const FDF_PAIR_METHODS = {
  getCurrentPrice: 'getCurrentPrice', // Method name for getting current price
  getReserves: 'getReserves', // Method name for getting reserves
  calculatePrice: 'calculatePrice', // Method name for price calculation
} as const;

// Common contract error types
export const CONTRACT_ERRORS = {
  NETWORK_ERROR: 'Network connection failed',
  CONTRACT_ERROR: 'Contract call failed',
  INVALID_PLAYER: 'Player ID not found',
  INSUFFICIENT_LIQUIDITY: 'Insufficient liquidity',
} as const;

// Simulate price volatility for realistic demo
export function generateRealisticPrice(basePrice: number, playerId: number): string {
  const seed = playerId * 123456789; // Consistent randomness per player
  const random = (seed % 10000) / 10000;
  
  // Add some volatility (-20% to +30%)
  const volatility = (random - 0.4) * 0.5;
  const newPrice = basePrice * (1 + volatility);
  
  return `${Math.max(0.1, newPrice).toFixed(3)} ETH`;
}
