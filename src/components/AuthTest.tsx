import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAuthentication } from '../hooks/useAuthentication';
import { usePrivy } from '@privy-io/react-auth';

export const AuthTest: React.FC = () => {
  const { authenticated, login, logout, user } = usePrivy();
  const { 
    isAuthenticated, 
    isAuthenticating, 
    error, 
    authenticate, 
    clearAuthentication,
    hasAuthToken,
    walletConnected,
    hasAttemptedAuth
  } = useAuthentication();

  const handleAuthenticate = async () => {
    console.log('🔍 Debug - User object:', user);
    console.log('🔍 Debug - Wallet address:', user?.wallet?.address);
    console.log('🔍 Debug - Authenticated status:', authenticated);
    
    try {
      await authenticate();
    } catch (err) {
      console.error('Authentication test failed:', err);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Authentication Test</CardTitle>
        <CardDescription>
          Test the complete JWT authentication flow with proper rate limiting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Privy Status</h3>
            <p className="text-sm">
              Connected: <span className={authenticated ? 'text-green-600' : 'text-red-600'}>
                {authenticated ? 'Yes' : 'No'}
              </span>
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">JWT Status</h3>
            <p className="text-sm">
              Authenticated: <span className={isAuthenticated ? 'text-green-600' : 'text-red-600'}>
                {isAuthenticated ? 'Yes' : 'No'}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Debug Information</h3>
          <div className="bg-gray-100 p-3 rounded text-xs space-y-1">
            <div>Authenticating: {isAuthenticating ? 'Yes' : 'No'}</div>
            <div>Has Auth Token: {hasAuthToken ? 'Yes' : 'No'}</div>
            <div>Wallet Connected: {walletConnected ? 'Yes' : 'No'}</div>
            <div>Has Attempted Auth: {hasAttemptedAuth ? 'Yes' : 'No'}</div>
            <div className="break-all">User Address: {user?.wallet?.address || 'None'}</div>
            <div>User ID: {user?.id || 'None'}</div>
            {error && <div className="text-red-600">Error: {error}</div>}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {!authenticated ? (
            <Button onClick={login} variant="default">
              Connect Wallet (Privy)
            </Button>
          ) : (
            <Button onClick={logout} variant="outline">
              Disconnect Wallet
            </Button>
          )}
          
          {authenticated && !isAuthenticated && (
            <Button 
              onClick={handleAuthenticate} 
              disabled={isAuthenticating}
              variant="default"
            >
              {isAuthenticating ? 'Authenticating...' : 'Get JWT Token'}
            </Button>
          )}
          
          {isAuthenticated && (
            <Button onClick={clearAuthentication} variant="destructive">
              Clear JWT Token
            </Button>
          )}
        </div>

        {error && error.includes('wait') && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            <strong>Rate Limited:</strong> {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
