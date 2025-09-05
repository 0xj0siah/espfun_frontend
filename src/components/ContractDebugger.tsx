import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createPublicClient, http } from 'viem';
import { CONTRACTS, NETWORK_CONFIG } from '../contracts';
import { Card } from './ui/card';
import { Button } from './ui/button';

export const ContractDebugger = () => {
  const { user, authenticated } = usePrivy();
  const [developmentPlayersResult, setDevelopmentPlayersResult] = useState<any>(null);
  const [playerBalancesResult, setPlayerBalancesResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create public client for contract interactions
  const publicClient = createPublicClient({
    chain: {
      id: NETWORK_CONFIG.chainId,
      name: NETWORK_CONFIG.name,
      rpcUrls: {
        default: { http: [NETWORK_CONFIG.rpcUrl] },
        public: { http: [NETWORK_CONFIG.rpcUrl] },
      },
      blockExplorers: {
        default: { name: 'MonadScan', url: NETWORK_CONFIG.blockExplorer },
      },
      nativeCurrency: {
        name: 'MON',
        symbol: 'MON',
        decimals: 18,
      },
      testnet: true,
    },
    transport: http(NETWORK_CONFIG.rpcUrl),
  });

  const testContracts = async () => {
    if (!authenticated || !user?.wallet?.address) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Testing contracts for address:', user.wallet.address);
      
      // Test DevelopmentPlayers.getUserPlayerIds
      console.log('🔍 Testing DevelopmentPlayers.getUserPlayerIds...');
      try {
        const devPlayersResult = await publicClient.readContract({
          address: CONTRACTS.DevelopmentPlayers.address as `0x${string}`,
          abi: CONTRACTS.DevelopmentPlayers.abi,
          functionName: 'getUserPlayerIds',
          args: [user.wallet.address as `0x${string}`],
        });
        console.log('✅ DevelopmentPlayers.getUserPlayerIds result:', devPlayersResult);
        setDevelopmentPlayersResult(devPlayersResult);
      } catch (devError) {
        console.error('❌ DevelopmentPlayers.getUserPlayerIds failed:', devError);
        setDevelopmentPlayersResult({ error: devError.message });
      }

      // Test Player contract - check balances for specific player IDs
      console.log('🔍 Testing Player contract balances...');
      const testPlayerIds = [1, 2, 3, 4, 5]; // Test first 5 player IDs
      const balanceResults: any = {};

      for (const playerId of testPlayerIds) {
        try {
          const balance = await publicClient.readContract({
            address: CONTRACTS.Player.address as `0x${string}`,
            abi: CONTRACTS.Player.abi,
            functionName: 'balanceOf',
            args: [user.wallet.address as `0x${string}`, BigInt(playerId)],
          });
          balanceResults[playerId] = Number(balance);
          console.log(`✅ Player ${playerId} balance:`, Number(balance));
        } catch (balanceError) {
          console.error(`❌ Player ${playerId} balance check failed:`, balanceError);
          balanceResults[playerId] = { error: balanceError.message };
        }
      }

      setPlayerBalancesResult(balanceResults);

      // Also try getting active players
      try {
        const activePlayerIds = await publicClient.readContract({
          address: CONTRACTS.Player.address as `0x${string}`,
          abi: CONTRACTS.Player.abi,
          functionName: 'getActivePlayerIds',
          args: [],
        });
        console.log('✅ Active player IDs:', activePlayerIds);
        setPlayerBalancesResult(prev => ({ ...prev, activePlayerIds }));
      } catch (activeError) {
        console.error('❌ Failed to get active players:', activeError);
      }

    } catch (generalError) {
      console.error('❌ General contract test failed:', generalError);
      setError(generalError.message);
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <Card className="p-6">
        <p>Please connect your wallet to test contracts</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contract Debugger</h3>
        <Button onClick={testContracts} disabled={loading}>
          {loading ? 'Testing...' : 'Test Contracts'}
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-medium">Wallet Address:</h4>
          <code className="text-sm bg-gray-100 p-2 rounded block break-all">
            {user?.wallet?.address}
          </code>
        </div>

        <div>
          <h4 className="font-medium">Contract Addresses:</h4>
          <div className="text-sm space-y-1">
            <div>DevelopmentPlayers: <code className="bg-gray-100 p-1 rounded">{CONTRACTS.DevelopmentPlayers.address}</code></div>
            <div>Player: <code className="bg-gray-100 p-1 rounded">{CONTRACTS.Player.address}</code></div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}

        {developmentPlayersResult && (
          <div>
            <h4 className="font-medium">DevelopmentPlayers.getUserPlayerIds Result:</h4>
            <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(developmentPlayersResult, null, 2)}
            </pre>
          </div>
        )}

        {playerBalancesResult && (
          <div>
            <h4 className="font-medium">Player Contract Balance Results:</h4>
            <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(playerBalancesResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
};
