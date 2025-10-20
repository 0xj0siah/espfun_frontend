import { useWalletTransactions } from '../hooks/useWalletTransactions';
import { Badge } from './ui/badge';

/**
 * Component that displays the current wallet type to users
 * Helps users understand if they're using an embedded or external wallet
 */
export function WalletTypeIndicator() {
  const { activeWalletAddress, isEmbeddedWallet } = useWalletTransactions();

  if (!activeWalletAddress) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={isEmbeddedWallet ? "secondary" : "outline"}>
        {isEmbeddedWallet ? (
          <>
            <span className="mr-1">✨</span>
            Privy Wallet
          </>
        ) : (
          <>
            <span className="mr-1">🦊</span>
            External Wallet
          </>
        )}
      </Badge>
      
      {isEmbeddedWallet && (
        <span className="text-xs text-muted-foreground">
          (Seamless transactions)
        </span>
      )}
      
      {!isEmbeddedWallet && (
        <span className="text-xs text-muted-foreground">
          (Wallet confirmations required)
        </span>
      )}
    </div>
  );
}
