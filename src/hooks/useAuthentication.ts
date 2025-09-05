import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy, useSignMessage } from '@privy-io/react-auth';
import { authenticateWallet } from '../services/authService';
import { apiService } from '../services/apiService';

// Global rate limiting - prevent multiple authentication attempts
let isGloballyAuthenticating = false;
let lastAuthAttempt = 0;
const AUTH_COOLDOWN = 10000; // Increased to 10 seconds due to backend rate limiting

export const useAuthentication = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedAuth, setHasAttemptedAuth] = useState(false);
  const { authenticated, user } = usePrivy();
  const { signMessage } = useSignMessage();

  // Check authentication status when wallet connection changes
  useEffect(() => {
    const checkAuthStatus = () => {
      const token = localStorage.getItem('authToken');
      const shouldBeAuthenticated = !!token && authenticated;
      
      // Only update state if it actually changed
      if (shouldBeAuthenticated !== isAuthenticated) {
        setIsAuthenticated(shouldBeAuthenticated);
      }
    };

    checkAuthStatus();
  }, [authenticated, isAuthenticated]);

  // Handle JWT authentication
  const authenticate = useCallback(async () => {
    if (!authenticated || !user?.wallet?.address) {
      const errorMessage = !authenticated 
        ? "Please connect your wallet first." 
        : "Wallet address not available. Please reconnect your wallet.";
      setError(errorMessage);
      console.error('🔐 Authentication prerequisites not met:', { 
        authenticated, 
        userExists: !!user, 
        walletExists: !!user?.wallet, 
        addressExists: !!user?.wallet?.address,
        address: user?.wallet?.address 
      });
      return false;
    }

    console.log('🔐 Starting authentication with address:', user.wallet.address);

    // Global rate limiting
    const now = Date.now();
    if (isGloballyAuthenticating) {
      console.log('Global authentication already in progress, skipping...');
      return false;
    }

    if (now - lastAuthAttempt < AUTH_COOLDOWN) {
      const waitTime = Math.ceil((AUTH_COOLDOWN - (now - lastAuthAttempt)) / 1000);
      console.log(`Authentication cooldown active, please wait ${waitTime}s`);
      setError(`Please wait ${waitTime} seconds before trying again (backend rate limiting)`);
      return false;
    }

    // Prevent multiple simultaneous authentication attempts
    if (isAuthenticating) {
      console.log('Authentication already in progress, skipping...');
      return false;
    }

    // Check if already authenticated
    if (isAuthenticated) {
      console.log('Already authenticated, skipping...');
      return true;
    }

    // Check if we already have a valid token
    const existingToken = localStorage.getItem('authToken');
    if (existingToken) {
      console.log('Valid token found, marking as authenticated');
      setIsAuthenticated(true);
      return true;
    }

    isGloballyAuthenticating = true;
    lastAuthAttempt = now;
    setIsAuthenticating(true);
    setError(null);
    setHasAttemptedAuth(true);

    try {
      // Create a signer interface that uses Privy's signMessage hook
      const signer = {
        signMessage: async (message: string): Promise<string> => {
          console.log('🔏 Privy signing message:', message);
          const result = await signMessage({ message });
          console.log('🔏 Privy signature result:', result);
          // Handle both possible return types from Privy
          const signature = typeof result === 'string' ? result : result.signature;
          if (!signature) {
            throw new Error('Failed to get signature from Privy');
          }
          return signature;
        }
      };

      console.log('🔐 Calling authenticateWallet with:', { address: user.wallet.address, signerExists: !!signer });
      await authenticateWallet(user.wallet.address, signer);
      setIsAuthenticated(true);
      return true;
    } catch (err: any) {
      console.error('Authentication failed:', err);
      
      // Handle specific backend errors
      if (err.message.includes('Too many requests')) {
        setError('Too many authentication attempts. Please wait 10 seconds and try again.');
      } else if (err.message.includes('Backend server is not available')) {
        setError('Backend server unavailable. The app will use local signatures instead.');
      } else if (err.message.includes('Invalid signature')) {
        setError('Invalid signature. Please try again.');
      } else {
        setError(err.message || "Authentication failed");
      }
      
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsAuthenticating(false);
      isGloballyAuthenticating = false;
    }
  }, [authenticated, user?.wallet?.address, signMessage, isAuthenticating, isAuthenticated]);

  // Clear authentication
  const clearAuthentication = useCallback(() => {
    apiService.clearAuthToken();
    setIsAuthenticated(false);
    setError(null);
    setHasAttemptedAuth(false);
    // Reset global state
    isGloballyAuthenticating = false;
    lastAuthAttempt = 0;
  }, []);

  return {
    isAuthenticated,
    isAuthenticating,
    error,
    authenticate,
    clearAuthentication,
    hasAuthToken: !!localStorage.getItem('authToken'),
    walletConnected: authenticated && !!user?.wallet?.address,
    hasAttemptedAuth
  };
};
