import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

const PASSWORD_STORAGE_KEY = 'espfun_access_granted';

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);

  const correctPassword = import.meta.env.VITE_ACCESS_PASSWORD;

  useEffect(() => {
    // Check if user has already authenticated in this session
    const hasAccess = sessionStorage.getItem(PASSWORD_STORAGE_KEY);
    if (hasAccess === 'true') {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === correctPassword) {
      sessionStorage.setItem(PASSWORD_STORAGE_KEY, 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  // Show nothing while checking authentication status
  if (isChecking) {
    return null;
  }

  // If authenticated, show the app
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Show password gate
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
      {/* Background decorative elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/5 to-purple-600/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-green-500/5 to-emerald-600/5 rounded-full blur-3xl"></div>
      </div>

      <Card className="w-[320px] p-6 bg-card/50 backdrop-blur-sm border-border">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-1">
            ESP.FUN
          </h1>
          <p className="text-xs text-muted-foreground">Enter password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full h-9"
              autoFocus
            />
            {error && (
              <p className="text-destructive text-xs mt-1.5">{error}</p>
            )}
          </div>

          <Button 
            type="submit"
            className="w-full h-9 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            Access
          </Button>
        </form>

        <p className="text-[10px] text-muted-foreground text-center mt-3">
          Private Access
        </p>
      </Card>
    </div>
  );
}
