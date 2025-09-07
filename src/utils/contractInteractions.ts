// Contract interaction utilities using viem and Privy
import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { monadTestnet } from 'viem/chains';
import { CONTRACT_ADDRESSES, CONTRACTS } from '../contracts';

// Create public client for read operations
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http('https://testnet-rpc.monad.xyz')
});

// Development Players contract functions
export async function getUserPlayerIds(userAddress: string): Promise<bigint[]> {
  try {
    console.log('getUserPlayerIds called with address:', userAddress);
    console.log('Contract address:', CONTRACT_ADDRESSES.DevelopmentPlayers);

    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.DevelopmentPlayers,
      abi: CONTRACTS.DevelopmentPlayers.abi,
      functionName: 'getUserPlayerIds',
      args: [userAddress]
    });

    console.log('getUserPlayerIds result:', result);
    return result as bigint[];
  } catch (error) {
    console.error('Error fetching user player IDs:', error);
    return [];
  }
}

export async function getLockedBalances(userAddress: string, playerIds: bigint[]): Promise<bigint[]> {
  try {
    console.log('getLockedBalances called with:', { userAddress, playerIds });

    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.DevelopmentPlayers,
      abi: CONTRACTS.DevelopmentPlayers.abi,
      functionName: 'getLockedBalances',
      args: [userAddress, playerIds]
    });

    console.log('getLockedBalances result:', result);
    return result as bigint[];
  } catch (error) {
    console.error('Error fetching locked balances:', error);
    return [];
  }
}

// Helper function to get development players data
export async function getDevelopmentPlayersData(userAddress: string): Promise<{
  playerIds: bigint[];
  lockedBalances: bigint[];
  totalPlayers: number;
}> {
  try {
    console.log('getDevelopmentPlayersData called with address:', userAddress);
    console.log('Contract address:', CONTRACT_ADDRESSES.DevelopmentPlayers);

    // First get all player IDs for the user
    const playerIds = await getUserPlayerIds(userAddress);
    console.log('Player IDs received:', playerIds);

    if (playerIds.length === 0) {
      console.log('No player IDs found for user - this is normal if user has no locked players');
      return {
        playerIds: [],
        lockedBalances: [],
        totalPlayers: 0
      };
    }

    // Then get locked balances for all player IDs
    const lockedBalances = await getLockedBalances(userAddress, playerIds);
    console.log('Locked balances received:', lockedBalances);

    const result = {
      playerIds,
      lockedBalances,
      totalPlayers: playerIds.length
    };

    console.log('Returning development players data:', result);
    return result;
  } catch (error) {
    console.error('Error fetching development players data:', error);
    console.error('Error details:', error);
    return {
      playerIds: [],
      lockedBalances: [],
      totalPlayers: 0
    };
  }
}

// Test function to verify contract connectivity and data
export async function testDevelopmentPlayersContract(userAddress: string): Promise<{
  contractAddress: string;
  isConnected: boolean;
  userPlayerIds: bigint[];
  sampleLockedBalance?: bigint;
  error?: string;
}> {
  try {
    console.log('Testing DevelopmentPlayers contract...');
    console.log('Contract address:', CONTRACT_ADDRESSES.DevelopmentPlayers);
    console.log('User address:', userAddress);

    // Test basic connectivity by calling getUserPlayerIds
    const playerIds = await getUserPlayerIds(userAddress);
    console.log('Test result - User player IDs:', playerIds);

    let sampleLockedBalance: bigint | undefined;
    if (playerIds.length > 0) {
      // Test getting a locked balance for the first player
      const balances = await getLockedBalances(userAddress, [playerIds[0]]);
      sampleLockedBalance = balances[0];
      console.log('Test result - Sample locked balance:', sampleLockedBalance);
    }

    return {
      contractAddress: CONTRACT_ADDRESSES.DevelopmentPlayers,
      isConnected: true,
      userPlayerIds: playerIds,
      sampleLockedBalance,
    };
  } catch (error) {
    console.error('Contract test failed:', error);
    return {
      contractAddress: CONTRACT_ADDRESSES.DevelopmentPlayers,
      isConnected: false,
      userPlayerIds: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Player contract functions
export async function getActivePlayerIds(): Promise<bigint[]> {
  try {
    console.log('getActivePlayerIds called');

    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.Player,
      abi: CONTRACTS.Player.abi,
      functionName: 'getActivePlayerIds',
      args: []
    });

    console.log('getActivePlayerIds result:', result);
    return result as bigint[];
  } catch (error) {
    console.error('Error fetching active player IDs:', error);
    return [];
  }
}

export async function getPlayerBalance(userAddress: string, playerId: bigint): Promise<bigint> {
  try {
    console.log('getPlayerBalance called with:', { userAddress, playerId });

    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.Player,
      abi: CONTRACTS.Player.abi,
      functionName: 'balanceOf',
      args: [userAddress, playerId]
    });

    console.log('getPlayerBalance result:', result);
    return result as bigint;
  } catch (error) {
    console.error('Error fetching player balance:', error);
    return BigInt(0);
  }
}

export async function getMultiplePlayerBalances(userAddress: string, playerIds: bigint[]): Promise<bigint[]> {
  try {
    console.log('getMultiplePlayerBalances called with:', { userAddress, playerIds });

    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.Player,
      abi: CONTRACTS.Player.abi,
      functionName: 'balanceOfBatch',
      args: [playerIds.map(() => userAddress), playerIds]
    });

    console.log('getMultiplePlayerBalances result:', result);
    return result as bigint[];
  } catch (error) {
    console.error('Error fetching multiple player balances:', error);
    return playerIds.map(() => BigInt(0));
  }
}
