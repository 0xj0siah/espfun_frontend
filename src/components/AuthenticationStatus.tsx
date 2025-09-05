import { usePrivy } from '@privy-io/react-auth';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Shield, ShieldCheck, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { useAuthentication } from '../hooks/useAuthentication';

export const AuthenticationStatus = () => {
  const { authenticated } = usePrivy();
  const { 
    isAuthenticated, 
    isAuthenticating, 
    error, 
    authenticate 
  } = useAuthentication();

  if (!authenticated) {
    return null; // Don't show if wallet not connected
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {isAuthenticated ? (
            <>
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <Badge variant="secondary" className="text-green-700 bg-green-100">
                Authenticated
              </Badge>
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 text-yellow-500" />
              <Badge variant="secondary" className="text-yellow-700 bg-yellow-100">
                Not Authenticated
              </Badge>
            </>
          )}
        </div>
        {!isAuthenticated && (
          <Button
            size="sm"
            variant="outline"
            onClick={authenticate}
            disabled={isAuthenticating}
            className="h-6 px-2 text-xs"
          >
            {isAuthenticating ? 'Auth...' : 'Authenticate'}
          </Button>
        )}
      </div>
      
      {!isAuthenticated && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Backend authentication required for enhanced features. Click "Authenticate" to sign a message with your wallet.
          </AlertDescription>
        </Alert>
      )}
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
