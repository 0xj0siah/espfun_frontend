import type { RarityTier } from '../types';

interface RarityEffectsProps {
  rarity: RarityTier;
}

const GLOW: Record<RarityTier, string> = {
  common: '',
  rare: 'rgba(59,130,246,0.12)',
  epic: 'rgba(139,92,246,0.15)',
  legendary: 'rgba(245,158,11,0.18)',
};

export function RarityEffects({ rarity }: RarityEffectsProps) {
  if (rarity === 'common') return null;

  return (
    <>
      {/* Shimmer sweep - subtle light passing over the card surface */}
      <div
        className="absolute inset-0 z-20 pointer-events-none rounded-lg overflow-hidden"
        style={{ mixBlendMode: 'soft-light' }}
      >
        <div className="shimmer-sweep absolute inset-0" />
      </div>

      {/* Inner edge glow matching rarity color */}
      {GLOW[rarity] && (
        <div
          className="absolute inset-0 z-[15] pointer-events-none rounded-lg"
          style={{ boxShadow: `inset 0 0 25px ${GLOW[rarity]}` }}
        />
      )}

      {/* Holographic overlay - epic and legendary only */}
      {(rarity === 'epic' || rarity === 'legendary') && (
        <div
          className="absolute inset-0 z-20 pointer-events-none rounded-lg overflow-hidden"
          style={{
            mixBlendMode: 'color-dodge',
            opacity: rarity === 'legendary' ? 0.5 : 0.3,
          }}
        >
          <div className="holo-effect absolute inset-0" />
        </div>
      )}

      {/* Glow pulse on legendary border */}
      {rarity === 'legendary' && (
        <div className="absolute inset-0 z-10 pointer-events-none rounded-lg glow-pulse-border" />
      )}
    </>
  );
}
