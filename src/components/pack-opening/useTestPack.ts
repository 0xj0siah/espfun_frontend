import { useCallback } from 'react';
import fakeData from '../../fakedata.json';
import { getRarityFromRating } from './constants';
import type { RevealCard } from './types';

export function useTestPack() {
  const generateTestCards = useCallback((): RevealCard[] => {
    const allPlayers = fakeData.teamPlayers;

    // Guarantee at least one epic/legendary for exciting demo
    const highRated = allPlayers.filter(p => p.rating >= 90);
    const others = allPlayers.filter(p => p.rating < 90);

    // Pick 1 guaranteed high-rated + 3 random from all
    const shuffledHigh = [...highRated].sort(() => Math.random() - 0.5);
    const shuffledOthers = [...others].sort(() => Math.random() - 0.5);

    const selected: typeof allPlayers = [];
    if (shuffledHigh.length > 0) {
      selected.push(shuffledHigh[0]);
    }
    // Fill remaining from others (or high if not enough others)
    const remaining = [...shuffledOthers, ...shuffledHigh.slice(1)].sort(() => Math.random() - 0.5);
    while (selected.length < 4 && remaining.length > 0) {
      const next = remaining.pop()!;
      if (!selected.find(s => s.id === next.id)) {
        selected.push(next);
      }
    }

    // Shuffle final order so the guaranteed epic/legendary isn't always first
    selected.sort(() => Math.random() - 0.5);

    return selected.map(player => ({
      id: player.id,
      name: player.name,
      game: player.game,
      position: player.position,
      rating: player.rating,
      shares: Math.floor(Math.random() * 5 + 1) * 1e18, // 1-5 tokens in wei
      image: player.image,
      teamLogo: player.image.replace(/\/[^/]*$/, '/logo.webp'),
      team: player.team || player.game,
      rarity: getRarityFromRating(player.rating),
      isRevealed: false,
    }));
  }, []);

  return { generateTestCards };
}
