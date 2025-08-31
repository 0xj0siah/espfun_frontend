import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getContractData } from '../contracts';
import { generateRealisticPrice, parseETHToNumber } from '../utils/contractUtils';

// Hook to fetch player price from FDFPair contract
export function usePlayerPrice(playerId: number) {
  const [price, setPrice] = useState<string>('0 ETH');
  const [loading, setLoading] = useState(false);
  const { ready } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    if (!ready || !playerId) return;

    const fetchPrice = async () => {
      setLoading(true);
      try {
        const fdfPairContract = getContractData('FDFPair');
        
        // TODO: Replace with actual contract call when ready
        // For now, generate realistic prices based on player ID
        const basePrice = 0.5 + (playerId % 10) * 0.2; // Base price between 0.5-2.5 ETH
        const simulatedPrice = generateRealisticPrice(basePrice, playerId);
        setPrice(simulatedPrice);
        
        // Example of actual contract call (uncomment when ready):
        /*
        if (wallets[0]) {
          const contract = new Contract(
            fdfPairContract.address, 
            fdfPairContract.abi, 
            wallets[0].provider
          );
          const priceWei = await contract.getCurrentPrice(playerId);
          setPrice(formatPriceToETH(priceWei));
        }
        */
        
      } catch (error) {
        console.error('Error fetching price for player', playerId, error);
        setPrice('-- ETH');
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
    
    // Update prices every 30 seconds to simulate market changes
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, [playerId, ready, wallets]);

  return { price, loading };
}

// Hook to fetch multiple player prices at once (more efficient)
export function usePlayerPrices(playerIds: number[]) {
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const { ready } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    if (!ready || playerIds.length === 0) return;

    const fetchPrices = async () => {
      setLoading(true);
      try {
        const fdfPairContract = getContractData('FDFPair');
        const newPrices: Record<number, string> = {};
        
        // TODO: Replace with actual batch contract call when ready
        // For now, generate realistic prices for each player
        for (const playerId of playerIds) {
          const basePrice = 0.5 + (playerId % 10) * 0.2; // Base price between 0.5-2.5 ETH
          const simulatedPrice = generateRealisticPrice(basePrice, playerId);
          newPrices[playerId] = simulatedPrice;
        }
        
        // Example of actual batch contract call (uncomment when ready):
        /*
        if (wallets[0]) {
          const contract = new Contract(
            fdfPairContract.address, 
            fdfPairContract.abi, 
            wallets[0].provider
          );
          
          const pricePromises = playerIds.map(id => 
            contract.getCurrentPrice(id).catch(() => BigInt(0))
          );
          
          const pricesWei = await Promise.all(pricePromises);
          
          playerIds.forEach((id, index) => {
            newPrices[id] = formatPriceToETH(pricesWei[index]);
          });
        }
        */
        
        setPrices(newPrices);
      } catch (error) {
        console.error('Error fetching player prices:', error);
        // Set fallback prices on error
        const fallbackPrices: Record<number, string> = {};
        playerIds.forEach(id => {
          fallbackPrices[id] = '1.000 ETH';
        });
        setPrices(fallbackPrices);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    
    // Update prices every 30 seconds to simulate market activity
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [playerIds, ready, wallets]);

  return { prices, loading };
}

// Hook for live price updates with WebSocket (for future implementation)
export function useLivePlayerPrices(playerIds: number[]) {
  const { prices, loading } = usePlayerPrices(playerIds);
  
  // TODO: Add WebSocket connection for real-time price updates
  // This would connect to a price feed service or directly to blockchain events
  
  return { prices, loading, isLive: false };
}
