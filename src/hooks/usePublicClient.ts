import { useMemo } from 'react';
import { createPublicClient, http, type PublicClient } from 'viem';
import { NETWORK_CONFIG } from '../contracts';

/**
 * Memoized viem public client for contract reads and tx receipt waiting.
 * Replaces inline createPublicClient calls that re-create every render.
 */
export function usePublicClient(): PublicClient {
  return useMemo(() => {
    return createPublicClient({
      chain: {
        id: NETWORK_CONFIG.chainId,
        name: NETWORK_CONFIG.name,
        rpcUrls: {
          default: { http: [NETWORK_CONFIG.rpcUrl] },
          public: { http: [NETWORK_CONFIG.rpcUrl] },
        },
        blockExplorers: {
          default: { name: 'Explorer', url: NETWORK_CONFIG.blockExplorer },
        },
        nativeCurrency: {
          name: 'ETH',
          symbol: 'ETH',
          decimals: 18,
        },
        testnet: true,
      },
      transport: http(NETWORK_CONFIG.rpcUrl),
    }) as PublicClient;
  }, []);
}
