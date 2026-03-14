import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { RarityEffects } from './RarityEffects';
import { RARITY_CONFIG } from '../constants';
import type { RevealCard } from '../types';
import { formatEther } from 'viem';

interface PlayerCardProps {
  card: RevealCard;
  width: number;
  height: number;
}

function formatShares(weiValue: number): string {
  try {
    const wei = BigInt(weiValue);
    return parseFloat(formatEther(wei)).toFixed(2);
  } catch {
    return '0.00';
  }
}

const RARITY_FRAME: Record<string, {
  border: string; accent: string; headerBg: string; nameBg: string;
  outerGlow: string; innerGlow: string;
}> = {
  common: {
    border: '#6b7280', accent: '#9ca3af',
    headerBg: 'linear-gradient(135deg, #374151, #4b5563)',
    nameBg: 'rgba(55,65,81,0.95)',
    outerGlow: 'none', innerGlow: 'none',
  },
  rare: {
    border: '#3b82f6', accent: '#60a5fa',
    headerBg: 'linear-gradient(135deg, #1e3a5f, #1e40af)',
    nameBg: 'rgba(30,58,95,0.95)',
    outerGlow: '0 0 12px rgba(59,130,246,0.2)', innerGlow: 'inset 0 0 12px rgba(59,130,246,0.08)',
  },
  epic: {
    border: '#8b5cf6', accent: '#a78bfa',
    headerBg: 'linear-gradient(135deg, #4c1d95, #6d28d9)',
    nameBg: 'rgba(76,29,149,0.95)',
    outerGlow: '0 0 20px rgba(139,92,246,0.3)', innerGlow: 'inset 0 0 16px rgba(139,92,246,0.1)',
  },
  legendary: {
    border: '#f59e0b', accent: '#fbbf24',
    headerBg: 'linear-gradient(135deg, #92400e, #d97706)',
    nameBg: 'rgba(146,64,14,0.95)',
    outerGlow: '0 0 30px rgba(245,158,11,0.35)', innerGlow: 'inset 0 0 20px rgba(245,158,11,0.12)',
  },
};

export function PlayerCard({ card, width, height }: PlayerCardProps) {
  const config = RARITY_CONFIG[card.rarity];
  const frame = RARITY_FRAME[card.rarity];

  return (
    <div
      className="absolute inset-0 rounded-xl overflow-hidden"
      style={{
        width,
        height,
        backfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
      }}
    >
      {/* Outer card frame */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: '#0a0a0f',
          border: `3px solid ${frame.border}`,
          boxShadow: `${frame.outerGlow}, ${frame.innerGlow}, 0 0 0 1px rgba(0,0,0,0.6)`,
        }}
      />

      {/* Inner border accent line */}
      <div className="absolute inset-[3px] rounded-[9px] pointer-events-none" style={{
        border: `1px solid ${frame.border}20`,
      }} />

      {/* Rarity effects (holo, shimmer) */}
      <RarityEffects rarity={card.rarity} />

      {/* Card interior */}
      <div className="relative z-10 h-full flex flex-col m-[3px]">

        {/* Top strip */}
        <div
          className="flex items-center justify-between px-2.5 py-1.5 rounded-t-[8px]"
          style={{ background: frame.headerBg }}
        >
          {/* Rating badge */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white"
            style={{
              background: `linear-gradient(145deg, ${frame.accent}, ${frame.border})`,
              boxShadow: `0 2px 8px ${frame.accent}50, inset 0 1px 0 rgba(255,255,255,0.2)`,
            }}
          >
            {card.rating}
          </div>

          {/* Position tag */}
          <div className="px-2 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <span className="text-white/90 text-[9px] font-bold uppercase tracking-wider">{card.position}</span>
          </div>

          {/* Game */}
          <span className="text-white/50 text-[8px] font-bold uppercase tracking-wider">{card.game}</span>
        </div>

        {/* Hero image area */}
        <div className="flex-1 relative overflow-hidden" style={{ background: '#0d0d1a' }}>
          {/* Team logo watermark */}
          <div
            className="absolute inset-0 z-0 opacity-10"
            style={{
              backgroundImage: `url(${card.teamLogo})`,
              backgroundSize: '50%',
              backgroundPosition: 'center 40%',
              backgroundRepeat: 'no-repeat',
              filter: 'blur(1px)',
            }}
          />

          {/* Rarity color backdrop */}
          <div className="absolute inset-0 z-[1]" style={{
            background: `
              radial-gradient(ellipse at 50% 70%, ${frame.border}12 0%, transparent 55%),
              radial-gradient(ellipse at 50% 0%, ${frame.border}08 0%, transparent 40%)
            `,
          }} />

          {/* Player photo */}
          <ImageWithFallback
            src={card.image}
            alt={card.name}
            className="relative z-[2] w-full h-full object-contain"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.7))' }}
          />

          {/* Bottom vignette */}
          <div className="absolute bottom-0 left-0 right-0 h-14 z-[3]" style={{
            background: 'linear-gradient(to top, #0a0a0f, #0a0a0f80 40%, transparent)',
          }} />

          {/* Top subtle vignette */}
          <div className="absolute top-0 left-0 right-0 h-6 z-[3]" style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)',
          }} />
        </div>

        {/* Name plate */}
        <div className="relative -mt-1.5 px-3 py-2 z-[5]" style={{ background: frame.nameBg }}>
          <h3
            className="text-white font-black text-[14px] text-center truncate tracking-wide"
            style={{ textShadow: `0 1px 4px rgba(0,0,0,0.6), 0 0 12px ${frame.border}30` }}
          >
            {card.name}
          </h3>
        </div>

        {/* Bottom info bar */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-b-[8px]"
          style={{ background: 'rgba(10,10,15,0.98)' }}
        >
          {/* Rarity label with accent dot */}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: frame.accent, boxShadow: `0 0 4px ${frame.accent}` }} />
            <span className="text-[8px] font-black uppercase tracking-[0.15em]" style={{ color: frame.accent }}>
              {config.label}
            </span>
          </div>

          {/* Shares */}
          <div className="flex items-center gap-1">
            <span className="text-white/40 text-[7px] uppercase tracking-wider">Shares</span>
            <span className="text-white font-bold text-[9px]">{formatShares(card.shares)}</span>
          </div>

          {/* Branding */}
          <span className="text-white/15 text-[6px] font-black tracking-[0.2em]">ESP.FUN</span>
        </div>
      </div>
    </div>
  );
}
