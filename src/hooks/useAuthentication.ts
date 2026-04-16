import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy, useSignMessage, useWallets } from '@privy-io/react-auth';
import { authenticateWallet } from '../services/authService';
import { apiService } from '../services/apiService';
import { useAuthContext } from '../context/AuthContext';
import { AUTH_COOLDOWN_MS } from '../constants/trading';
import { getPreferredWallet, savePreferredWallet } from '../utils/walletPreference';

export const useAuthentication = () => {
  const {
    globalAuthState,
    setGlobalAuthState,
    isGloballyAuthenticating,
    setIsGloballyAuthenticating,
    lastAuthAttempt,
    setLastAuthAttempt,
  } = useAuthContext();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedAuth, setHasAttemptedAuth] = useState(false);
  const [lastWalletAddress, setLastWalletAddress] = useState<string | null>(null);
  const { authenticated, user } = usePrivy();
  const { signMessage } = useSignMessage();
  const { wallets } = useWallets();

  // Refs to break the dependency cycle — authenticate reads these without
  // needing them in its dependency array, so it won't be re-created on every
  // state change it itself causes.
  const isAuthenticatingRef = useRef(false);
  const isAuthenticatedRef = useRef(false);
  const isGloballyAuthenticatingRef = useRef(false);
  const lastAuthAttemptRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { isAuthenticatingRef.current = isAuthenticating; }, [isAuthenticating]);
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);
  useEffect(() => { isGloballyAuthenticatingRef.current = isGloballyAuthenticating; }, [isGloballyAuthenticating]);
  useEffect(() => { lastAuthAttemptRef.current = lastAuthAttempt; }, [lastAuthAttempt]);

  // Helper to detect if we're using an embedded wallet
  const isEmbeddedWallet = useCallback(() => {
    const activeWallet = getPreferredWallet(wallets);
    if (!activeWallet) return false;
    return activeWallet.walletClientType === 'privy';
  }, [wallets]);

  // Soft clear: reset in-memory auth state without destroying the backend cookie.
  // Used for reauth flows, 401 recovery, and state flickers.
  const softClearAuthentication = useCallback(() => {
    apiService.resetInMemoryAuth();
    setIsAuthenticated(false);
    setError(null);
    setHasAttemptedAuth(false);
    setGlobalAuthState(false);
    setIsGloballyAuthenticating(false);
    setLastAuthAttempt(0);
  }, [setGlobalAuthState, setIsGloballyAuthenticating, setLastAuthAttempt]);

  // Hard clear: destroy both in-memory state AND backend cookie.
  // Used ONLY for explicit user logout or wallet disconnect.
  const clearAuthentication = useCallback(() => {
    apiService.clearAuthToken();
    setIsAuthenticated(false);
    setError(null);
    setHasAttemptedAuth(false);
    setGlobalAuthState(false);
    setIsGloballyAuthenticating(false);
    setLastAuthAttempt(0);
  }, [setGlobalAuthState, setIsGloballyAuthenticating, setLastAuthAttempt]);

  // Track wallet disconnection and address changes to clear authentication
  useEffect(() => {
    const currentWalletAddress = user?.wallet?.address || null;

    // If wallet was disconnected, clear authentication
    if (!authenticated && lastWalletAddress) {
      clearAuthentication();
      setLastWalletAddress(null);
      return;
    }

    // If wallet address changed (switched wallets), clear authentication
    if (authenticated && lastWalletAddress && currentWalletAddress && lastWalletAddress !== currentWalletAddress) {
      clearAuthentication();
    }

    // Update last wallet address
    if (currentWalletAddress !== lastWalletAddress) {
      setLastWalletAddress(currentWalletAddress);
    }
  }, [authenticated, user?.wallet?.address, lastWalletAddress, clearAuthentication]);

  // Sync local auth state with apiService + context (picks up session restoration from AuthProvider)
  useEffect(() => {
    const shouldBeAuthenticated = apiService.isAuthenticated() && authenticated;
    if (shouldBeAuthenticated !== isAuthenticated) {
      setIsAuthenticated(shouldBeAuthenticated);
    }
  }, [authenticated, isAuthenticated, globalAuthState]);

  // Handle JWT authentication
  const authenticate = useCallback(async () => {
    if (!authenticated || !user?.wallet?.address) {
      const errorMessage = !authenticated
        ? "Please connect your wallet first."
        : "Wallet address not available. Please reconnect your wallet.";
      setError(errorMessage);
      return false;
    }

    // Global rate limiting — read from refs to avoid dependency churn
    const now = Date.now();
    if (isGloballyAuthenticatingRef.current) {
      return false;
    }

    if (now - lastAuthAttemptRef.current < AUTH_COOLDOWN_MS) {
      const waitTime = Math.ceil((AUTH_COOLDOWN_MS - (now - lastAuthAttemptRef.current)) / 1000);
      setError(`Please wait ${waitTime} seconds before trying again (backend rate limiting)`);
      return false;
    }

    // Prevent multiple simultaneous authentication attempts
    if (isAuthenticatingRef.current) {
      return false;
    }

    // Check if already authenticated
    if (isAuthenticatedRef.current) {
      return true;
    }

    // Check if we already have a valid token in memory
    if (apiService.isAuthenticated()) {
      setIsAuthenticated(true);
      return true;
    }

    setIsGloballyAuthenticating(true);
    setLastAuthAttempt(now);
    setIsAuthenticating(true);
    setError(null);
    setHasAttemptedAuth(true);

    try {
      const activeWallet = getPreferredWallet(wallets);
      const isEmbedded = isEmbeddedWallet();

      // Use the correct address: activeWallet.address for external wallets, user.wallet.address for embedded
      const walletAddress = activeWallet?.address || user.wallet.address;

      // Create a signer interface that handles both embedded and external wallets
      const signer = {
        signMessage: async (message: string): Promise<string> => {
          if (!activeWallet) {
            throw new Error('No wallet connected');
          }

          if (isEmbedded) {
            // For embedded wallets, use Privy's signMessage hook (seamless)
            const result = await signMessage({ message });
            const signature = typeof result === 'string' ? result : result.signature;
            if (!signature) {
              throw new Error('Failed to get signature from Privy');
            }
            return signature;
          } else {
            // For external wallets, we need to use the wallet's native signing capability
            try {
              // Get a wallet client to sign with the external wallet
              const walletClient = await activeWallet.getEthereumProvider();

              if (!walletClient) {
                throw new Error('Could not get wallet provider');
              }

              // Convert message to hex for personal_sign
              // personal_sign expects: personal_sign(hexMessage, address)
              const hexMessage = '0x' + Array.from(new TextEncoder().encode(message))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

              const signature = await walletClient.request({
                method: 'personal_sign',
                params: [hexMessage, activeWallet.address],
              });

              if (!signature || typeof signature !== 'string') {
                throw new Error('Failed to get signature from wallet');
              }

              return signature;
            } catch (error: any) {
              // Handle user rejection
              if (error.code === 4001 || error.message?.includes('User rejected') || error.message?.includes('denied')) {
                throw new Error('Signature request was rejected. Please approve the signature in your wallet to authenticate.');
              }

              throw error;
            }
          }
        }
      };

      await authenticateWallet(walletAddress, signer);
      if (activeWallet) savePreferredWallet(activeWallet);
      setIsAuthenticated(true);
      setGlobalAuthState(true); // Update global auth state
      return true;
    } catch (err: any) {
      // Handle specific backend errors
      if (err.message.includes('Too many requests')) {
        setError('Too many authentication attempts. Please wait 10 seconds and try again.');
      } else if (err.message.includes('Backend server is not available')) {
        setError('Backend server unavailable. FDFPair trading requires backend authentication.');
      } else if (err.message.includes('Invalid signature')) {
        setError('Invalid signature. Please try again.');
      } else if (err.message.includes('rejected') || err.message.includes('denied')) {
        // User rejected signature in their wallet
        setError('Signature request rejected. Please approve the signature request in your wallet to continue.');
      } else {
        setError(err.message || "Authentication failed");
      }

      setIsAuthenticated(false);
      return false;
    } finally {
      setIsAuthenticating(false);
      setIsGloballyAuthenticating(false);
    }
  }, [authenticated, user?.wallet?.address, signMessage, wallets, isEmbeddedWallet, setGlobalAuthState, setIsGloballyAuthenticating, setLastAuthAttempt]);

  // Validate current token
  const validateToken = useCallback(async (): Promise<boolean> => {
    try {
      const isValid = await apiService.validateToken();
      if (!isValid) {
        // apiService.validateToken already cleared the token on 401 —
        // just sync local state here (soft clear to avoid double logout POST)
        softClearAuthentication();
        setError('Your session has expired. Please authenticate again.');
      }
      return isValid;
    } catch (error) {
      return false;
    }
  }, [softClearAuthentication]);

  // Force re-authentication (preserves cookie — only clears in-memory state)
  const forceReAuth = useCallback(async (): Promise<boolean> => {
    softClearAuthentication();
    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
    return await authenticate();
  }, [softClearAuthentication, authenticate]);

  // Automatic reauthentication for API calls (doesn't show user errors).
  // Uses soft clear to preserve the cookie — if reauth fails, session restore can still work.
  const autoReAuth = useCallback(async (): Promise<boolean> => {
    softClearAuthentication();
    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      return await authenticate();
    } catch (error) {
      return false;
    }
  }, [softClearAuthentication, authenticate]);

  // Keep a stable ref so the apiService handler doesn't need to be re-registered
  const autoReAuthRef = useRef(autoReAuth);
  const softClearRef = useRef(softClearAuthentication);
  useEffect(() => { autoReAuthRef.current = autoReAuth; }, [autoReAuth]);
  useEffect(() => { softClearRef.current = softClearAuthentication; }, [softClearAuthentication]);

  // Register auth error handler once on mount — uses refs so it never re-registers
  useEffect(() => {
    apiService.setAuthErrorHandler(() => {
      // Soft clear: session expired, but don't destroy the cookie — user can still
      // restore via cookie on next page load if they don't explicitly re-auth now.
      softClearRef.current();
      setError('Your session has expired. Please authenticate again.');
    });

    apiService.setAutoReAuthHandler(() => autoReAuthRef.current());

    return () => {
      apiService.setAuthErrorHandler(() => {});
      apiService.setAutoReAuthHandler(() => Promise.resolve(false));
    };
  }, []); // stable — no deps, reads through refs

  return {
    isAuthenticated,
    isAuthenticating,
    error,
    authenticate,
    clearAuthentication,
    autoReAuth,
    validateToken,
    hasAuthToken: apiService.isAuthenticated(),
    walletConnected: authenticated && !!user?.wallet?.address,
    hasAttemptedAuth
  };
};
