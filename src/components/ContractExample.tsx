// Example of how to use the contract ABIs with Privy wallet
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getContractData, CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../contracts';
import { useWalletTransactions } from '../hooks/useWalletTransactions';

export function ContractInteractionExample() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransactionWithWallet, isEmbeddedWallet } = useWalletTransactions();
  const wallet = wallets[0]; // Get the first wallet

  // Example: Get Player contract data
  const playerContract = getContractData('Player');
  console.log('Player Contract:', {
    address: playerContract.address,
    abi: playerContract.abi,
  });

  // Example: Send a transaction to a contract
  const handleContractInteraction = async () => {
    if (!wallet) return;

    try {
      // Example transaction to Player contract using unified wallet system
      // This automatically handles embedded wallets seamlessly and shows prompts for external wallets
      const result = await sendTransactionWithWallet({
        to: CONTRACT_ADDRESSES.Player,
        value: '0', // No ETH being sent
        data: '0x...', // Contract method call data would go here
      });
      
      console.log('Transaction sent:', result.hash);
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  return (
    <div>
      <h3>Contract Interaction Example</h3>
      <p>Player Contract: {CONTRACT_ADDRESSES.Player}</p>
      <p>Network: {NETWORK_CONFIG.name}</p>
      <p>Wallet Type: {isEmbeddedWallet ? 'Embedded (Seamless)' : 'External (Prompts)'}</p>
      <button onClick={handleContractInteraction}>
        Interact with Contract
      </button>
    </div>
  );
}
