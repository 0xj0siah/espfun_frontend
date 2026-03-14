import type { PackInfo, UserPoints } from '../../services/apiService';

export type RarityTier = 'common' | 'rare' | 'epic' | 'legendary';

export interface RevealCard {
  id: number;
  name: string;
  game: string;
  position: string;
  rating: number;
  shares: number;
  image: string;
  teamLogo: string;
  team: string;
  rarity: RarityTier;
  isRevealed: boolean;
}

// State machine phases
export type PackOpeningPhase =
  | { type: 'SELECTION' }
  | { type: 'PURCHASING'; packId: string }
  | { type: 'OPENING_ANIMATION'; cards: RevealCard[]; pack: PackInfo }
  | { type: 'CARD_REVEAL'; cards: RevealCard[]; currentIndex: number }
  | { type: 'SUMMARY'; cards: RevealCard[] }
  | { type: 'ERROR'; message: string };

// State machine actions
export type PackOpeningAction =
  | { type: 'SELECT_PACK'; packId: string }
  | { type: 'PURCHASE_SUCCESS'; cards: RevealCard[]; pack: PackInfo }
  | { type: 'PURCHASE_FAILURE'; message: string }
  | { type: 'TEST_OPEN'; cards: RevealCard[]; pack: PackInfo }
  | { type: 'OPENING_COMPLETE' }
  | { type: 'REVEAL_CARD'; index: number }
  | { type: 'ALL_REVEALED' }
  | { type: 'RESET' };

// Props shared across phase components
export interface PackSelectionPhaseProps {
  availablePacks: PackInfo[];
  userPoints: UserPoints | null;
  isAuthenticated: boolean;
  walletConnected: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  loading: boolean;
  error: string | null;
  testMode: boolean;
  onToggleTestMode: () => void;
  onSelectPack: (pack: PackInfo) => void;
  onTestOpen: () => void;
  riveFoilIdleBuffer?: ArrayBuffer | null;
}

export interface PackOpeningPhaseProps {
  pack: PackInfo;
  onComplete: () => void;
  riveBuffer?: ArrayBuffer | null;
}

export interface CardRevealPhaseProps {
  cards: RevealCard[];
  currentIndex: number;
  onRevealCard: (index: number) => void;
  onAllRevealed: () => void;
  riveCardRevealBuffer?: ArrayBuffer | null;
}

export interface CollectionSummaryPhaseProps {
  cards: RevealCard[];
  onOpenAnother: () => void;
  onClose: () => void;
}
