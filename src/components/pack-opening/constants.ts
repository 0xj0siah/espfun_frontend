import type { RarityTier } from './types';

// Timing constants (milliseconds)
export const OPENING_ANIMATION_DURATION = 2800;
export const PACK_SHAKE_START = 0;
export const PACK_SHAKE_END = 1200;
export const PACK_RIP_START = 1200;
export const PACK_RIP_END = 2200;
export const LIGHT_BURST_START = 1500;
export const CARDS_APPEAR_START = 2200;

export const CARD_FLIP_DURATION = 0.6; // seconds (for motion)
export const AUTO_REVEAL_DELAY = 4000;
export const CARD_SETTLE_DELAY = 1200;
export const SCREEN_FLASH_DURATION = 200;

// Rarity thresholds (based on player rating)
export const LEGENDARY_THRESHOLD = 95;
export const EPIC_THRESHOLD = 90;
export const RARE_THRESHOLD = 85;

export function getRarityFromRating(rating: number): RarityTier {
  if (rating >= LEGENDARY_THRESHOLD) return 'legendary';
  if (rating >= EPIC_THRESHOLD) return 'epic';
  if (rating >= RARE_THRESHOLD) return 'rare';
  return 'common';
}

// Rarity display config
export const RARITY_CONFIG: Record<RarityTier, {
  label: string;
  borderColor: string;
  gradientFrom: string;
  gradientTo: string;
  glowColor: string;
  textColor: string;
  particleColors: string[];
}> = {
  common: {
    label: 'Common',
    borderColor: 'border-gray-400',
    gradientFrom: 'from-gray-500',
    gradientTo: 'to-gray-700',
    glowColor: 'rgba(156, 163, 175, 0.4)',
    textColor: 'text-gray-400',
    particleColors: ['#9CA3AF', '#6B7280', '#D1D5DB'],
  },
  rare: {
    label: 'Rare',
    borderColor: 'border-blue-400',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-800',
    glowColor: 'rgba(59, 130, 246, 0.5)',
    textColor: 'text-blue-400',
    particleColors: ['#3B82F6', '#60A5FA', '#93C5FD'],
  },
  epic: {
    label: 'Epic',
    borderColor: 'border-purple-400',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-indigo-800',
    glowColor: 'rgba(147, 51, 234, 0.5)',
    textColor: 'text-purple-400',
    particleColors: ['#9333EA', '#A855F7', '#C084FC'],
  },
  legendary: {
    label: 'Legendary',
    borderColor: 'border-amber-400',
    gradientFrom: 'from-amber-400',
    gradientTo: 'to-orange-700',
    glowColor: 'rgba(245, 158, 11, 0.6)',
    textColor: 'text-amber-400',
    particleColors: ['#F59E0B', '#FBBF24', '#FCD34D', '#FFD700'],
  },
};

// Pack tier visual config
export const PACK_TIER_CONFIG: Record<string, {
  gradientFrom: string;
  gradientTo: string;
  borderColor: string;
  glowColor: string;
  accentColor: string;
}> = {
  PRO: {
    gradientFrom: 'from-blue-600',
    gradientTo: 'to-blue-900',
    borderColor: 'border-blue-400',
    glowColor: '0 0 20px rgba(59, 130, 246, 0.3)',
    accentColor: '#3B82F6',
  },
  EPIC: {
    gradientFrom: 'from-purple-600',
    gradientTo: 'to-indigo-900',
    borderColor: 'border-purple-400',
    glowColor: '0 0 20px rgba(147, 51, 234, 0.3)',
    accentColor: '#9333EA',
  },
  LEGENDARY: {
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-orange-800',
    borderColor: 'border-amber-400',
    glowColor: '0 0 25px rgba(245, 158, 11, 0.4)',
    accentColor: '#F59E0B',
  },
};

// Pack foil wrapper visual designs (shared across selection + opening animation)
export const PACK_DESIGNS: Record<string, {
  foilGradient: string;
  foilAccent: string;
  tierLabel: string;
  tierColor: string;
  tierBg: string;
  glowColor: string;
  tearColor: string;
}> = {
  PRO: {
    foilGradient: 'linear-gradient(165deg, #1a3a5c 0%, #1e4976 15%, #2563eb 40%, #1e40af 55%, #1a3a5c 75%, #1e4976 100%)',
    foilAccent: '#3b82f6',
    tierLabel: 'PRO',
    tierColor: '#93c5fd',
    tierBg: 'rgba(37,99,235,0.3)',
    glowColor: 'rgba(59,130,246,0.25)',
    tearColor: '#60a5fa',
  },
  EPIC: {
    foilGradient: 'linear-gradient(165deg, #3b1a5c 0%, #4c1d95 15%, #7c3aed 40%, #6d28d9 55%, #3b1a5c 75%, #4c1d95 100%)',
    foilAccent: '#8b5cf6',
    tierLabel: 'EPIC',
    tierColor: '#c4b5fd',
    tierBg: 'rgba(124,58,237,0.3)',
    glowColor: 'rgba(139,92,246,0.3)',
    tearColor: '#a78bfa',
  },
  LEGENDARY: {
    foilGradient: 'linear-gradient(165deg, #5c3a1a 0%, #92400e 15%, #f59e0b 35%, #d97706 50%, #b45309 65%, #92400e 80%, #5c3a1a 100%)',
    foilAccent: '#f59e0b',
    tierLabel: 'LEGENDARY',
    tierColor: '#fde68a',
    tierBg: 'rgba(245,158,11,0.3)',
    glowColor: 'rgba(245,158,11,0.35)',
    tearColor: '#fbbf24',
  },
};

// Card dimensions
export const CARD_WIDTH = 200;
export const CARD_HEIGHT = 300;
export const CARD_WIDTH_MOBILE = 160;
export const CARD_HEIGHT_MOBILE = 240;

// Rive animation asset paths
export const RIVE_PACK_OPEN_PATH = '/rive/pack-open.riv';
export const RIVE_CARD_REVEAL_PATH = '/rive/card-reveal-vfx.riv';
export const RIVE_FOIL_IDLE_PATH = '/rive/pack-foil-idle.riv';

// Fallback timeout when Rive burstComplete event doesn't fire
export const RIVE_FALLBACK_TIMEOUT = 5000;

// Map pack tier strings to Rive number inputs
export const TIER_TO_RIVE_INDEX: Record<string, number> = {
  PRO: 0,
  EPIC: 1,
  LEGENDARY: 2,
};

// Map rarity tiers to Rive number inputs
export const RARITY_TO_RIVE_INDEX: Record<RarityTier, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};
