// Contract interaction utilities using viem and Privy
import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { monadTestnet } from 'viem/chains';
import { CONTRACT_ADDRESSES, CONTRACTS } from '../contracts';
import { readContractCached } from './contractCache';

// Create public client for read operations
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http('https://testnet-rpc.monad.xyz')
});

// Development Players contract functions
export async function getUserPlayerIds(userAddress: string): Promise<bigint[]> {
  try {
    const result = await readContractCached({
      address: CONTRACT_ADDRESSES.DevelopmentPlayers,
      abi: CONTRACTS.DevelopmentPlayers.abi as any,
      functionName: 'getUserPlayerIds',
      args: [userAddress]
    });

    return result as bigint[];
  } catch (error) {
    console.error('Error fetching user player IDs:', error);
    return [];
  }
}

export async function getLockedBalances(userAddress: string, playerIds: bigint[]): Promise<bigint[]> {
  try {
    const result = await readContractCached({
      address: CONTRACT_ADDRESSES.DevelopmentPlayers,
      abi: CONTRACTS.DevelopmentPlayers.abi as any,
      functionName: 'getLockedBalances',
      args: [userAddress, playerIds]
    });

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
    // First get all player IDs for the user
    const playerIds = await getUserPlayerIds(userAddress);

    if (playerIds.length === 0) {
      return {
        playerIds: [],
        lockedBalances: [],
        totalPlayers: 0
      };
    }

    // Then get locked balances for all player IDs
    const lockedBalances = await getLockedBalances(userAddress, playerIds);

    return {
      playerIds,
      lockedBalances,
      totalPlayers: playerIds.length
    };
  } catch (error) {
    console.error('Error fetching development players data:', error);
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
    // Test basic connectivity by calling getUserPlayerIds
    const playerIds = await getUserPlayerIds(userAddress);

    let sampleLockedBalance: bigint | undefined;
    if (playerIds.length > 0) {
      // Test getting a locked balance for the first player
      const balances = await getLockedBalances(userAddress, [playerIds[0]]);
      sampleLockedBalance = balances[0];
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
    const result = await readContractCached({
      address: CONTRACT_ADDRESSES.Player,
      abi: CONTRACTS.Player.abi as any,
      functionName: 'getActivePlayerIds',
      args: []
    });

    return result as bigint[];
  } catch (error) {
    console.error('Error fetching active player IDs:', error);
    return [];
  }
}

export async function getPlayerBalance(userAddress: string, playerId: bigint): Promise<bigint> {
  try {
    const result = await readContractCached({
      address: CONTRACT_ADDRESSES.Player,
      abi: CONTRACTS.Player.abi as any,
      functionName: 'balanceOf',
      args: [userAddress, playerId]
    });

    return result as bigint;
  } catch (error) {
    console.error('Error fetching player balance:', error);
    return BigInt(0);
  }
}

export async function getMultiplePlayerBalances(userAddress: string, playerIds: bigint[]): Promise<bigint[]> {
  try {
    const result = await readContractCached({
      address: CONTRACT_ADDRESSES.Player,
      abi: CONTRACTS.Player.abi as any,
      functionName: 'balanceOfBatch',
      args: [playerIds.map(() => userAddress), playerIds]
    });

    return result as bigint[];
  } catch (error) {
    console.error('Error fetching multiple player balances:', error);
    return playerIds.map(() => BigInt(0));
  }
}
