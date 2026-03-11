import { useReducer, useEffect, useCallback } from 'react';
import type { PackOpeningPhase, PackOpeningAction, RevealCard } from './types';
import type { PackInfo } from '../../services/apiService';
import { OPENING_ANIMATION_DURATION } from './constants';

function packOpeningReducer(state: PackOpeningPhase, action: PackOpeningAction): PackOpeningPhase {
  switch (action.type) {
    case 'SELECT_PACK':
      if (state.type !== 'SELECTION') return state;
      return { type: 'PURCHASING', packId: action.packId };

    case 'PURCHASE_SUCCESS':
      if (state.type !== 'PURCHASING') return state;
      return { type: 'OPENING_ANIMATION', cards: action.cards, pack: action.pack };

    case 'PURCHASE_FAILURE':
      return { type: 'ERROR', message: action.message };

    case 'TEST_OPEN':
      if (state.type !== 'SELECTION') return state;
      return { type: 'OPENING_ANIMATION', cards: action.cards, pack: action.pack };

    case 'OPENING_COMPLETE':
      if (state.type !== 'OPENING_ANIMATION') return state;
      return { type: 'CARD_REVEAL', cards: state.cards, currentIndex: -1 };

    case 'REVEAL_CARD':
      if (state.type !== 'CARD_REVEAL') return state;
      const updatedCards = state.cards.map((card, i) =>
        i === action.index ? { ...card, isRevealed: true } : card
      );
      return { type: 'CARD_REVEAL', cards: updatedCards, currentIndex: action.index };

    case 'ALL_REVEALED':
      if (state.type !== 'CARD_REVEAL') return state;
      return { type: 'SUMMARY', cards: state.cards.map(c => ({ ...c, isRevealed: true })) };

    case 'RESET':
      return { type: 'SELECTION' };

    default:
      return state;
  }
}

export function usePackOpeningMachine() {
  const [phase, dispatch] = useReducer(packOpeningReducer, { type: 'SELECTION' });

  // Auto-advance from OPENING_ANIMATION to CARD_REVEAL
  useEffect(() => {
    if (phase.type === 'OPENING_ANIMATION') {
      const timer = setTimeout(() => {
        dispatch({ type: 'OPENING_COMPLETE' });
      }, OPENING_ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [phase.type]);

  const selectPack = useCallback((packId: string) => {
    dispatch({ type: 'SELECT_PACK', packId });
  }, []);

  const purchaseSuccess = useCallback((cards: RevealCard[], pack: PackInfo) => {
    dispatch({ type: 'PURCHASE_SUCCESS', cards, pack });
  }, []);

  const purchaseFailure = useCallback((message: string) => {
    dispatch({ type: 'PURCHASE_FAILURE', message });
  }, []);

  const testOpen = useCallback((cards: RevealCard[], pack: PackInfo) => {
    dispatch({ type: 'TEST_OPEN', cards, pack });
  }, []);

  const revealCard = useCallback((index: number) => {
    dispatch({ type: 'REVEAL_CARD', index });
  }, []);

  const allRevealed = useCallback(() => {
    dispatch({ type: 'ALL_REVEALED' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    phase,
    dispatch,
    selectPack,
    purchaseSuccess,
    purchaseFailure,
    testOpen,
    revealCard,
    allRevealed,
    reset,
  };
}
