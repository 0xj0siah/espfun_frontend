import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { apiService } from '../services/apiService';

interface AuthContextType {
  globalAuthState: boolean;
  setGlobalAuthState: (state: boolean) => void;
  isGloballyAuthenticating: boolean;
  setIsGloballyAuthenticating: (state: boolean) => void;
  lastAuthAttempt: number;
  setLastAuthAttempt: (time: number) => void;
}

const AuthContext = createContext<AuthContextType>({
  globalAuthState: false,
  setGlobalAuthState: () => {},
  isGloballyAuthenticating: false,
  setIsGloballyAuthenticating: () => {},
  lastAuthAttempt: 0,
  setLastAuthAttempt: () => {},
});

export const useAuthContext = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [globalAuthState, setGlobalAuthState] = useState(false);
  const [isGloballyAuthenticating, setIsGloballyAuthenticating] = useState(false);
  const lastAuthAttemptRef = useRef(0);
  const { authenticated } = usePrivy();

  const setLastAuthAttempt = useCallback((time: number) => {
    lastAuthAttemptRef.current = time;
  }, []);

  // Reset auth state when wallet genuinely disconnects (not on initial load or flickers).
  // Only reset if we were previously authenticated — prevents clobbering session restore
  // during the Privy initialization window.
  const wasAuthenticatedRef = useRef(false);
  useEffect(() => {
    if (authenticated) {
      wasAuthenticatedRef.current = true;
    } else if (wasAuthenticatedRef.current) {
      // Wallet was connected and is now disconnected — genuine disconnect
      wasAuthenticatedRef.current = false;
      setGlobalAuthState(false);
      setIsGloballyAuthenticating(false);
      lastAuthAttemptRef.current = 0;
    }
  }, [authenticated]);

  // Restore session from httpOnly cookie on page load (runs once on mount).
  // Does NOT wait for Privy — the cookie is validated independently by the backend.
  // Once Privy loads and `authenticated` becomes true, the sync effect in
  // useAuthentication will pick up the restored session.
  useEffect(() => {
    if (apiService.isAuthenticated()) return;

    let cancelled = false;
    apiService.restoreSession().then((userData) => {
      if (!cancelled && userData) {
        setGlobalAuthState(true);
      }
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{
      globalAuthState,
      setGlobalAuthState,
      isGloballyAuthenticating,
      setIsGloballyAuthenticating,
      lastAuthAttempt: lastAuthAttemptRef.current,
      setLastAuthAttempt,
    }}>
      {children}
    </AuthContext.Provider>
  );
};