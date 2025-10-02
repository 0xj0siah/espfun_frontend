import { createContext, useContext, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

interface AuthContextType {
  globalAuthState: boolean;
  setGlobalAuthState: (state: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  globalAuthState: false,
  setGlobalAuthState: () => {},
});

export const useAuthContext = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [globalAuthState, setGlobalAuthState] = useState(false);
  const { authenticated } = usePrivy();
  
  // Reset auth state when wallet disconnects
  useEffect(() => {
    if (!authenticated) {
      setGlobalAuthState(false);
    }
  }, [authenticated]);

  return (
    <AuthContext.Provider value={{ globalAuthState, setGlobalAuthState }}>
      {children}
    </AuthContext.Provider>
  );
};