import { useWallets, useSendTransaction } from '@privy-io/react-auth';
import { useCallback } from 'react';

/**
 * Custom hook to handle transactions for both embedded and external wallets
 * - Embedded wallets: Seamless transactions without prompts
 * - External wallets (MetaMask, etc.): Shows wallet prompts for user confirmation
 */
export function useWalletTransactions() {
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  /**
   * Determines if the active wallet is an embedded wallet
   */
  const isEmbeddedWallet = useCallback(() => {
    const activeWallet = wallets[0];
    if (!activeWallet) return false;
    
    // Privy embedded wallets have walletClientType === 'privy'
    return activeWallet.walletClientType === 'privy';
  }, [wallets]);

  /**
   * Get the active wallet address
   */
  const getActiveWalletAddress = useCallback(() => {
    return wallets[0]?.address;
  }, [wallets]);

  /**
   * Send a transaction with appropriate UI behavior based on wallet type
   * @param transaction - The transaction details
   * @param options - Optional configuration
   */
  const sendTransactionWithWallet = useCallback(
    async (
      transaction: {
        to: string;
        data?: string;
        value?: bigint | string;
        gasLimit?: bigint;
      },
      options?: {
        showUI?: boolean; // Override default UI behavior
      }
    ) => {
      const activeWallet = wallets[0];
      
      if (!activeWallet) {
        throw new Error('No wallet connected');
      }

      const isEmbedded = isEmbeddedWallet();
      
      // For embedded wallets, hide UI by default (seamless)
      // For external wallets, show UI by default (user needs to confirm in their wallet)
      const showWalletUIs = options?.showUI ?? !isEmbedded;

      console.log(`🔐 Sending transaction via ${isEmbedded ? 'embedded' : 'external'} wallet`, {
        wallet: activeWallet.address,
        showUI: showWalletUIs,
        transaction
      });

      try {
        const result = await sendTransaction(
          {
            to: transaction.to as `0x${string}`,
            data: transaction.data as `0x${string}` | undefined,
            value: typeof transaction.value === 'bigint' 
              ? transaction.value 
              : transaction.value 
                ? BigInt(transaction.value) 
                : undefined,
          },
          {
            address: activeWallet.address as `0x${string}`,
            uiOptions: {
              showWalletUIs, // Control whether to show confirmation modals
            }
          }
        );

        console.log('✅ Transaction sent:', result.hash);
        return result;
      } catch (error: any) {
        console.error('❌ Transaction failed:', error);
        
        // Provide user-friendly error messages
        if (error.code === 4001 || error.message?.includes('User rejected')) {
          throw new Error('Transaction was rejected');
        }
        
        if (error.message?.includes('insufficient funds')) {
          throw new Error('Insufficient funds for this transaction');
        }
        
        throw error;
      }
    },
    [wallets, sendTransaction, isEmbeddedWallet]
  );

  return {
    wallets,
    activeWallet: wallets[0],
    activeWalletAddress: getActiveWalletAddress(),
    isEmbeddedWallet: isEmbeddedWallet(),
    sendTransactionWithWallet,
  };
}
