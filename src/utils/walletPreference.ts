import type { ConnectedWallet } from '@privy-io/react-auth';

const STORAGE_KEY = 'espfun_preferred_wallet';

/**
 * Save which wallet the user last authenticated with.
 */
export function savePreferredWallet(wallet: ConnectedWallet) {
  try {
    localStorage.setItem(STORAGE_KEY, wallet.walletClientType);
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
  }
}

/**
 * Pick the user's preferred wallet from Privy's wallets array.
 * Falls back to wallets[0] if no preference or no match.
 */
export function getPreferredWallet(wallets: ConnectedWallet[]): ConnectedWallet | undefined {
  if (wallets.length === 0) return undefined;
  if (wallets.length === 1) return wallets[0];

  try {
    const preferred = localStorage.getItem(STORAGE_KEY);
    if (preferred) {
      const match = wallets.find(w => w.walletClientType === preferred);
      if (match) return match;
    }
  } catch {
    // localStorage unavailable
  }

  return wallets[0];
}

export function clearPreferredWallet() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}
