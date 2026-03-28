import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';

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

  // Reset auth state when wallet disconnects
  useEffect(() => {
    if (!authenticated) {
      setGlobalAuthState(false);
      setIsGloballyAuthenticating(false);
      lastAuthAttemptRef.current = 0;
    }
  }, [authenticated]);

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