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

// Rarity border/accent colors as raw hex for inline styles
const RARITY_FRAME: Record<string, { border: string; accent: string; headerBg: string; nameBg: string }> = {
  common: { border: '#6b7280', accent: '#9ca3af', headerBg: 'linear-gradient(135deg, #374151, #4b5563)', nameBg: 'rgba(55,65,81,0.95)' },
  rare: { border: '#3b82f6', accent: '#60a5fa', headerBg: 'linear-gradient(135deg, #1e3a5f, #1e40af)', nameBg: 'rgba(30,58,95,0.95)' },
  epic: { border: '#8b5cf6', accent: '#a78bfa', headerBg: 'linear-gradient(135deg, #4c1d95, #6d28d9)', nameBg: 'rgba(76,29,149,0.95)' },
  legendary: { border: '#f59e0b', accent: '#fbbf24', headerBg: 'linear-gradient(135deg, #92400e, #b45309)', nameBg: 'rgba(146,64,14,0.95)' },
};

export function PlayerCard({ card, width, height }: PlayerCardProps) {
  const config = RARITY_CONFIG[card.rarity];
  const frame = RARITY_FRAME[card.rarity];

  return (
    <div
      className="absolute inset-0 rounded-lg overflow-hidden"
      style={{
        width,
        height,
        backfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
      }}
    >
      {/* === Outer card frame - the "printed card" base === */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: '#0f0f0f',
          border: `3px solid ${frame.border}`,
          boxShadow: `0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px ${frame.border}30`,
        }}
      />

      {/* Rarity effects (holo, shimmer) layered on top of everything */}
      <RarityEffects rarity={card.rarity} />

      {/* === Card interior content (inset from the frame) === */}
      <div className="relative z-10 h-full flex flex-col m-[3px]">

        {/* Top strip - rating + game + position */}
        <div
          className="flex items-center justify-between px-2 py-1 rounded-t-[5px]"
          style={{ background: frame.headerBg }}
        >
          {/* Rating number */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-white"
            style={{
              background: `linear-gradient(135deg, ${frame.accent}, ${frame.border})`,
              boxShadow: `0 0 6px ${frame.accent}60`,
            }}
          >
            {card.rating}
          </div>

          {/* Position */}
          <span className="text-white/80 text-[9px] font-semibold uppercase tracking-wider">{card.position}</span>

          {/* Game logo/text */}
          <span className="text-white/60 text-[8px] font-bold uppercase tracking-wider">{card.game}</span>
        </div>

        {/* === Main image area - the hero of the card === */}
        <div className="flex-1 relative overflow-hidden" style={{ background: '#1a1a2e' }}>
          {/* Team logo watermark */}
          <div
            className="absolute inset-0 z-0 opacity-15"
            style={{
              backgroundImage: `url(${card.teamLogo})`,
              backgroundSize: '55%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />

          {/* Gradient backdrop behind player */}
          <div
            className="absolute inset-0 z-[1]"
            style={{
              background: `radial-gradient(ellipse at 50% 60%, ${frame.border}15 0%, transparent 65%)`,
            }}
          />

          {/* Player image - big, centered, the star of the card */}
          <ImageWithFallback
            src={card.image}
            alt={card.name}
            className="relative z-[2] w-full h-full object-contain"
            style={{
              filter: `drop-shadow(0 2px 8px rgba(0,0,0,0.6))`,
            }}
          />

          {/* Bottom vignette */}
          <div className="absolute bottom-0 left-0 right-0 h-12 z-[3] bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/60 to-transparent" />
        </div>

        {/* === Name plate - overlaps the bottom of the image === */}
        <div
          className="relative -mt-1 px-2 py-1.5 z-[5]"
          style={{ background: frame.nameBg }}
        >
          <h3
            className="text-white font-black text-[13px] text-center truncate tracking-wide"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
          >
            {card.name}
          </h3>
        </div>

        {/* === Bottom info bar === */}
        <div
          className="flex items-center justify-between px-2 py-1.5 rounded-b-[5px]"
          style={{ background: 'rgba(15,15,15,0.98)' }}
        >
          {/* Rarity label */}
          <span
            className="text-[8px] font-black uppercase tracking-[0.15em]"
            style={{ color: frame.accent }}
          >
            {config.label}
          </span>

          {/* Shares */}
          <div className="flex items-center gap-1">
            <span className="text-white/50 text-[8px]">Shares:</span>
            <span className="text-white font-bold text-[9px]">{formatShares(card.shares)}</span>
          </div>

          {/* ESP.FUN tiny branding */}
          <span className="text-white/20 text-[7px] font-bold tracking-wider">ESP.FUN</span>
        </div>
      </div>
    </div>
  );
}
