import type { RarityTier } from '../types';

interface RarityEffectsProps {
  rarity: RarityTier;
}

const RARITY_VFX: Record<RarityTier, {
  glow: string;
  shimmerOpacity: number;
  holoOpacity: number;
  edgeGlow: string;
  sparkles: number;
  sparkleColor: string;
  pulseGlow: boolean;
}> = {
  common: {
    glow: '',
    shimmerOpacity: 0.06,
    holoOpacity: 0,
    edgeGlow: '',
    sparkles: 0,
    sparkleColor: '',
    pulseGlow: false,
  },
  rare: {
    glow: 'rgba(59,130,246,0.15)',
    shimmerOpacity: 0.15,
    holoOpacity: 0.2,
    edgeGlow: 'inset 0 0 20px rgba(59,130,246,0.12), inset 0 0 40px rgba(59,130,246,0.05)',
    sparkles: 3,
    sparkleColor: '#60a5fa',
    pulseGlow: false,
  },
  epic: {
    glow: 'rgba(139,92,246,0.2)',
    shimmerOpacity: 0.22,
    holoOpacity: 0.35,
    edgeGlow: 'inset 0 0 24px rgba(139,92,246,0.15), inset 0 0 50px rgba(139,92,246,0.06)',
    sparkles: 5,
    sparkleColor: '#a78bfa',
    pulseGlow: false,
  },
  legendary: {
    glow: 'rgba(245,158,11,0.25)',
    shimmerOpacity: 0.3,
    holoOpacity: 0.5,
    edgeGlow: 'inset 0 0 30px rgba(245,158,11,0.18), inset 0 0 60px rgba(245,158,11,0.08)',
    sparkles: 8,
    sparkleColor: '#fbbf24',
    pulseGlow: true,
  },
};

// Fixed sparkle positions so they don't shift on re-render
const SPARKLE_POSITIONS = [
  { top: '12%', left: '18%', delay: 0 },
  { top: '22%', right: '14%', delay: 0.8 },
  { top: '58%', left: '10%', delay: 1.5 },
  { top: '72%', right: '20%', delay: 0.4 },
  { top: '40%', left: '85%', delay: 2.1 },
  { top: '85%', left: '30%', delay: 1.2 },
  { top: '8%', left: '55%', delay: 0.6 },
  { top: '65%', left: '50%', delay: 1.8 },
];

export function RarityEffects({ rarity }: RarityEffectsProps) {
  const vfx = RARITY_VFX[rarity];

  return (
    <>
      {/* Shimmer sweep — all rarities get it, intensity varies */}
      {vfx.shimmerOpacity > 0 && (
        <div
          className="absolute inset-0 z-20 pointer-events-none rounded-xl overflow-hidden"
          style={{ mixBlendMode: 'soft-light' }}
        >
          <div
            className="shimmer-sweep absolute inset-0"
            style={{ opacity: vfx.shimmerOpacity }}
          />
        </div>
      )}

      {/* Inner edge glow */}
      {vfx.edgeGlow && (
        <div
          className="absolute inset-0 z-[15] pointer-events-none rounded-xl"
          style={{ boxShadow: vfx.edgeGlow }}
        />
      )}

      {/* Holographic rainbow overlay */}
      {vfx.holoOpacity > 0 && (
        <div
          className="absolute inset-0 z-20 pointer-events-none rounded-xl overflow-hidden"
          style={{
            mixBlendMode: 'color-dodge',
            opacity: vfx.holoOpacity,
          }}
        >
          <div className="holo-effect absolute inset-0" />
        </div>
      )}

      {/* Floating sparkles */}
      {vfx.sparkles > 0 && (
        <div className="absolute inset-0 z-[22] pointer-events-none rounded-xl overflow-hidden">
          {SPARKLE_POSITIONS.slice(0, vfx.sparkles).map((pos, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                ...pos,
                width: i % 2 === 0 ? 3 : 2,
                height: i % 2 === 0 ? 3 : 2,
                borderRadius: '50%',
                background: vfx.sparkleColor,
                boxShadow: `0 0 4px ${vfx.sparkleColor}, 0 0 8px ${vfx.sparkleColor}80`,
                animation: `sparkle-float 2.5s ease-in-out ${pos.delay}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Legendary pulsing border glow */}
      {vfx.pulseGlow && (
        <div className="absolute inset-0 z-10 pointer-events-none rounded-xl glow-pulse-border" />
      )}

      {/* Legendary — rotating light ray accent */}
      {rarity === 'legendary' && (
        <div
          className="absolute inset-0 z-[14] pointer-events-none rounded-xl overflow-hidden"
          style={{ mixBlendMode: 'screen', opacity: 0.06 }}
        >
          <div className="absolute inset-[-50%] legendary-ray" style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, rgba(245,158,11,0.4) 15deg, transparent 30deg, transparent 90deg, rgba(245,158,11,0.3) 105deg, transparent 120deg, transparent 180deg, rgba(245,158,11,0.4) 195deg, transparent 210deg, transparent 270deg, rgba(245,158,11,0.3) 285deg, transparent 300deg)',
          }} />
        </div>
      )}
    </>
  );
}
