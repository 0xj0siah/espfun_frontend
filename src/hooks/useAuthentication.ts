import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useSignMessage, useWallets } from '@privy-io/react-auth';
import { authenticateWallet } from '../services/authService';
import { apiService } from '../services/apiService';
import { useAuthContext } from '../context/AuthContext';
import { AUTH_COOLDOWN_MS } from '../constants/trading';

export const useAuthentication = () => {
  const {
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
    const activeWallet = wallets[0];
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
      console.log('🔌 Wallet disconnected, clearing authentication');
      clearAuthentication();
      setLastWalletAddress(null);
      return;
    }
    
    // If wallet address changed (switched wallets), clear authentication
    if (authenticated && lastWalletAddress && currentWalletAddress && lastWalletAddress !== currentWalletAddress) {
      console.log('🔄 Wallet address changed, clearing authentication for new wallet');
      clearAuthentication();
    }
    
    // Update last wallet address
    if (currentWalletAddress !== lastWalletAddress) {
      setLastWalletAddress(currentWalletAddress);
    }
  }, [authenticated, user?.wallet?.address, lastWalletAddress, clearAuthentication]);

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

    // Global rate limiting
    const now = Date.now();
    if (isGloballyAuthenticating) {
      console.log('Global authentication already in progress, skipping...');
      return false;
    }

    if (now - lastAuthAttempt < AUTH_COOLDOWN_MS) {
      const waitTime = Math.ceil((AUTH_COOLDOWN_MS - (now - lastAuthAttempt)) / 1000);
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

    setIsGloballyAuthenticating(true);
    setLastAuthAttempt(now);
    setIsAuthenticating(true);
    setError(null);
    setHasAttemptedAuth(true);

    try {
      const activeWallet = wallets[0];
      const isEmbedded = isEmbeddedWallet();
      
      // Use the correct address: activeWallet.address for external wallets, user.wallet.address for embedded
      const walletAddress = activeWallet?.address || user.wallet.address;
      console.log('🔐 Starting authentication with address:', walletAddress);
      
      console.log('🔐 Wallet type:', isEmbedded ? 'Embedded (Privy)' : 'External (MetaMask, etc.)');
      console.log('🔐 Wallet client type:', activeWallet?.walletClientType);

      // Create a signer interface that handles both embedded and external wallets
      const signer = {
        signMessage: async (message: string): Promise<string> => {
          console.log('🔏 Signing message:', message);
          
          if (!activeWallet) {
            throw new Error('No wallet connected');
          }
          
          if (isEmbedded) {
            // For embedded wallets, use Privy's signMessage hook (seamless)
            console.log('🔏 Using Privy signMessage for embedded wallet');
            const result = await signMessage({ message });
            const signature = typeof result === 'string' ? result : result.signature;
            if (!signature) {
              throw new Error('Failed to get signature from Privy');
            }
            console.log('🔏 Embedded wallet signature received');
            return signature;
          } else {
            // For external wallets, we need to use the wallet's native signing capability
            console.log('🔏 Using external wallet signMessage (will show wallet prompt)');
            
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
              
              console.log('🔏 Requesting signature from external wallet...');
              console.log('🔏 Message (UTF-8):', message);
              console.log('🔏 Message (Hex):', hexMessage);
              
              const signature = await walletClient.request({
                method: 'personal_sign',
                params: [hexMessage, activeWallet.address],
              });
              
              if (!signature || typeof signature !== 'string') {
                throw new Error('Failed to get signature from wallet');
              }
              
              console.log('🔏 External wallet signature received');
              return signature;
            } catch (error: any) {
              console.error('🔏 External wallet signing error:', error);
              
              // Handle user rejection
              if (error.code === 4001 || error.message?.includes('User rejected') || error.message?.includes('denied')) {
                throw new Error('Signature request was rejected. Please approve the signature in your wallet to authenticate.');
              }
              
              throw error;
            }
          }
        }
      };

      console.log('🔐 Calling authenticateWallet with:', { address: walletAddress, signerExists: !!signer });
      await authenticateWallet(walletAddress, signer);
      setIsAuthenticated(true);
      setGlobalAuthState(true); // Update global auth state
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
        console.warn('Token validation failed, clearing authentication');
        clearAuthentication();
        setError('Your session has expired. Please authenticate again.');
      }
      return isValid;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }, [clearAuthentication]);

  // Force re-authentication
  const forceReAuth = useCallback(async (): Promise<boolean> => {
    console.log('Forcing re-authentication...');
    clearAuthentication();
    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
    return await authenticate();
  }, [clearAuthentication, authenticate]);

  // Automatic reauthentication for API calls (doesn't show user errors)
  const autoReAuth = useCallback(async (): Promise<boolean> => {
    console.log('🔄 Automatic re-authentication triggered by API call');
    clearAuthentication();
    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const success = await authenticate();
      if (success) {
        console.log('🔄 Automatic re-authentication successful');
      } else {
        console.warn('🔄 Automatic re-authentication failed');
      }
      return success;
    } catch (error) {
      console.warn('🔄 Automatic re-authentication error:', error);
      return false;
    }
  }, [clearAuthentication, authenticate]);

  // Register auth error handler when component mounts
  useEffect(() => {
    const handleAuthError = (error: any) => {
      console.warn('🔐 Authentication token invalidated due to 401 error');
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
    hasAuthToken: !!localStorage.getItem('authToken'),
    walletConnected: authenticated && !!user?.wallet?.address,
    hasAttemptedAuth
  };
};
