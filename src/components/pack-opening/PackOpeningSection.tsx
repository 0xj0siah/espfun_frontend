import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { apiService, PackInfo, PackPurchaseResponse, UserPoints } from '../../services/apiService';
import { useAuthentication } from '../../hooks/useAuthentication';
import { usePackOpeningMachine } from './usePackOpeningMachine';
import { useTestPack } from './useTestPack';
import { getRarityFromRating } from './constants';
import type { RevealCard } from './types';
import fakeData from '../../fakedata.json';

// Phase components
import { PackSelectionPhase } from './phases/PackSelectionPhase';
import { PackOpeningPhase } from './phases/PackOpeningPhase';
import { CardRevealPhase } from './phases/CardRevealPhase';
import { CollectionSummaryPhase } from './phases/CollectionSummaryPhase';

// Helper to get player data from fakeData
function getPlayerData(playerId: number) {
  return fakeData.teamPlayers.find(p => p.id === playerId) || {
    id: playerId,
    name: `Player ${playerId}`,
    game: 'CS2',
    position: 'Unknown',
    price: '0 USDC',
    trend: 'stable' as const,
    points: 0,
    rating: 50,
    image: '/images/default-player.webp',
    stats: { kills: 0, deaths: 0, assists: 0, winRate: 0 },
    recentMatches: [],
  };
}

export default function PackOpeningSection() {
  const [availablePacks, setAvailablePacks] = useState<PackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [testMode, setTestMode] = useState(false);

  const { user, authenticated } = usePrivy();
  const { isAuthenticated, isAuthenticating, authenticate, error: authError, walletConnected } = useAuthentication();
  const { phase, selectPack, purchaseSuccess, purchaseFailure, testOpen, revealCard, allRevealed, reset } = usePackOpeningMachine();
  const { generateTestCards } = useTestPack();

  // Load packs and user points
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        if (!isAuthenticated && walletConnected && !isAuthenticating) {
          await authenticate();
        }

        // Clear cache for fresh data
        if (authenticated) {
          const currentToken = (apiService as any).token;
          if (currentToken) {
            apiService.clearAuthToken();
            apiService.setAuthToken(currentToken);
          }
        }

        const [packsResponse, pointsResponse] = await Promise.allSettled([
          apiService.getAvailablePacks(),
          apiService.getUserPoints().catch(() => null),
        ]);

        // Handle packs
        if (packsResponse.status === 'fulfilled') {
          let packs: PackInfo[] = [];
          const response = packsResponse.value;
          if (Array.isArray(response)) {
            packs = response;
          } else if (response && typeof response === 'object' && 'packs' in response) {
            packs = (response as any).packs;
          }
          if (!packs || packs.length === 0) {
            packs = getDefaultPacks();
          }
          setAvailablePacks(packs);
        } else {
          setAvailablePacks(getDefaultPacks());
        }

        if (pointsResponse.status === 'fulfilled' && pointsResponse.value) {
          setUserPoints(pointsResponse.value);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setAvailablePacks(getDefaultPacks());
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authenticated, isAuthenticated, walletConnected, isAuthenticating, authenticate]);

  // Handle pack selection (real purchase flow)
  const handleSelectPack = useCallback(async (pack: PackInfo) => {
    if (!isAuthenticated || !user?.wallet?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    selectPack(pack.id);

    try {
      // Refresh points
      const latestPoints = await apiService.getUserPoints();
      setUserPoints(latestPoints);

      if (latestPoints.tournamentPoints < pack.price) {
        purchaseFailure(`Insufficient points! You need ${pack.price} points but only have ${latestPoints.tournamentPoints}.`);
        toast.error(`Insufficient points!`);
        return;
      }

      // Purchase via API
      const response: PackPurchaseResponse = await apiService.purchasePack({ packType: pack.id });

      // Guard: backend returned no players
      if (!response.transaction.playerIds?.length) {
        purchaseFailure('Pack opened on-chain but no players were returned. Check backend logs for the PackOpened event.');
        toast.error('Pack purchase failed: no players received.');
        return;
      }

      // Transform to RevealCard[]
      const cards: RevealCard[] = response.transaction.playerIds.map((playerId, index) => {
        const playerData = getPlayerData(playerId);
        return {
          id: playerId,
          name: playerData.name,
          game: playerData.game,
          position: playerData.position,
          rating: playerData.rating,
          shares: parseInt(response.transaction.shares[index] || '1'),
          image: playerData.image,
          teamLogo: playerData.image.replace(/\/[^/]*$/, '/logo.webp'),
          team: (playerData as any).team || playerData.game,
          rarity: getRarityFromRating(playerData.rating),
          isRevealed: false,
        };
      });

      purchaseSuccess(cards, pack);

      // Refresh points after purchase
      try {
        const updatedPoints = await apiService.getUserPoints();
        setUserPoints(updatedPoints);
      } catch {
        // Points refresh failure is non-critical
      }

      toast.success(response.message || `Successfully opened ${pack.name}!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to open pack';
      purchaseFailure(msg);
      toast.error(msg);
    }
  }, [isAuthenticated, user?.wallet?.address, selectPack, purchaseSuccess, purchaseFailure]);

  // Handle test pack opening
  const handleTestOpen = useCallback(() => {
    const cards = generateTestCards();
    const testPack: PackInfo = {
      id: 'PRO',
      name: 'Test Pack',
      type: 'bronze',
      price: 0,
      description: '4 Random Players',
      isActive: true,
    };
    testOpen(cards, testPack);
  }, [generateTestCards, testOpen]);

  // Handle opening animation complete - auto-handled by state machine
  const handleOpeningComplete = useCallback(() => {
    // State machine auto-advances via useEffect in usePackOpeningMachine
  }, []);

  return (
    <div className="relative">
      {/* Selection phase (always rendered as base layer) */}
      {(phase.type === 'SELECTION' || phase.type === 'PURCHASING' || phase.type === 'ERROR') && (
        <PackSelectionPhase
          availablePacks={availablePacks}
          userPoints={userPoints}
          isAuthenticated={isAuthenticated}
          walletConnected={walletConnected}
          isAuthenticating={isAuthenticating || phase.type === 'PURCHASING'}
          authError={phase.type === 'ERROR' ? phase.message : authError}
          loading={loading}
          error={error}
          testMode={testMode}
          onToggleTestMode={() => setTestMode(prev => !prev)}
          onSelectPack={handleSelectPack}
          onTestOpen={handleTestOpen}
        />
      )}

      {/* Overlay phases */}
      <AnimatePresence>
        {phase.type === 'OPENING_ANIMATION' && (
          <PackOpeningPhase
            key="opening"
            pack={phase.pack}
            onComplete={handleOpeningComplete}
          />
        )}

        {phase.type === 'CARD_REVEAL' && (
          <CardRevealPhase
            key="reveal"
            cards={phase.cards}
            currentIndex={phase.currentIndex}
            onRevealCard={revealCard}
            onAllRevealed={allRevealed}
          />
        )}

        {phase.type === 'SUMMARY' && (
          <CollectionSummaryPhase
            key="summary"
            cards={phase.cards}
            onOpenAnother={reset}
            onClose={reset}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Default pack data when API is unavailable
function getDefaultPacks(): PackInfo[] {
  return [
    { id: 'PRO', name: 'Pro Pack', type: 'bronze', price: 100, description: '4 Players', isActive: true },
    { id: 'EPIC', name: 'Epic Pack', type: 'silver', price: 250, description: '4 Players', isActive: true },
    { id: 'LEGENDARY', name: 'Legendary Pack', type: 'gold', price: 500, description: '4 Players', isActive: true },
  ];
}
