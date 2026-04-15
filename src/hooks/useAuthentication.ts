import { useState, useEffect, useCallback } from 'react';
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

  // Helper to detect if we're using an embedded wallet
  const isEmbeddedWallet = useCallback(() => {
    const activeWallet = getPreferredWallet(wallets);
    if (!activeWallet) return false;
    return activeWallet.walletClientType === 'privy';
  }, [wallets]);

  // Clear authentication
  const clearAuthentication = useCallback(() => {
    apiService.clearAuthToken();
    setIsAuthenticated(false);
    setError(null);
    setHasAttemptedAuth(false);
    // Reset both local and global state
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

    // Global rate limiting
    const now = Date.now();
    if (isGloballyAuthenticating) {
      return false;
    }

    if (now - lastAuthAttempt < AUTH_COOLDOWN_MS) {
      const waitTime = Math.ceil((AUTH_COOLDOWN_MS - (now - lastAuthAttempt)) / 1000);
      setError(`Please wait ${waitTime} seconds before trying again (backend rate limiting)`);
      return false;
    }

    // Prevent multiple simultaneous authentication attempts
    if (isAuthenticating) {
      return false;
    }

    // Check if already authenticated
    if (isAuthenticated) {
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
  }, [authenticated, user?.wallet?.address, signMessage, wallets, isEmbeddedWallet, isAuthenticating, isAuthenticated, setGlobalAuthState, isGloballyAuthenticating, lastAuthAttempt, setIsGloballyAuthenticating, setLastAuthAttempt]);

  // Validate current token
  const validateToken = useCallback(async (): Promise<boolean> => {
    try {
      const isValid = await apiService.validateToken();
      if (!isValid) {
        clearAuthentication();
        setError('Your session has expired. Please authenticate again.');
      }
      return isValid;
    } catch (error) {
      return false;
    }
  }, [clearAuthentication]);

  // Force re-authentication
  const forceReAuth = useCallback(async (): Promise<boolean> => {
    clearAuthentication();
    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
    return await authenticate();
  }, [clearAuthentication, authenticate]);

  // Automatic reauthentication for API calls (doesn't show user errors)
  const autoReAuth = useCallback(async (): Promise<boolean> => {
    clearAuthentication();
    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      return await authenticate();
    } catch (error) {
      return false;
    }
  }, [clearAuthentication, authenticate]);

  // Register auth error handler when component mounts
  useEffect(() => {
    const handleAuthError = (error: any) => {
      // Clear authentication state when token becomes invalid
      clearAuthentication();
      setError('Your session has expired. Please authenticate again.');
    };

    // Register the error handler with apiService
    apiService.setAuthErrorHandler(handleAuthError);

    // Register the auto reauthentication handler
    apiService.setAutoReAuthHandler(autoReAuth);

    // Cleanup on unmount
    return () => {
      apiService.setAuthErrorHandler(() => {});
      apiService.setAutoReAuthHandler(() => Promise.resolve(false));
    };
  }, [clearAuthentication, autoReAuth]);

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
