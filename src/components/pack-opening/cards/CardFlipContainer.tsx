import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { PlayerCard } from './PlayerCard';
import { CardBack } from './CardBack';
import { RiveCardRevealVFX } from '../effects/RiveCardRevealVFX';
import { CARD_FLIP_DURATION } from '../constants';
import type { RevealCard } from '../types';

interface CardFlipContainerProps {
  card: RevealCard;
  isFlipped: boolean;
  onClick: () => void;
  width: number;
  height: number;
  className?: string;
  riveBuffer?: ArrayBuffer | null;
}

export function CardFlipContainer({
  card,
  isFlipped,
  onClick,
  width,
  height,
  className = '',
  riveBuffer,
}: CardFlipContainerProps) {
  // Trigger Rive VFX after the flip animation completes
  const [showVFX, setShowVFX] = useState(false);

  useEffect(() => {
    if (!isFlipped) {
      setShowVFX(false);
      return;
    }
    // Wait for flip animation to complete before triggering VFX
    const timer = setTimeout(() => setShowVFX(true), CARD_FLIP_DURATION * 1000);
    return () => clearTimeout(timer);
  }, [isFlipped]);

  return (
    <div
      className={`cursor-pointer relative ${className}`}
      onClick={onClick}
      style={{ width, height, perspective: 1000 }}
    >
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{
          duration: CARD_FLIP_DURATION,
          ease: [0.65, 0, 0.35, 1], // Snappy custom bezier
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Card Back (face-down state) */}
        <CardBack width={width} height={height} />

        {/* Card Front (face-up state, pre-rotated 180) */}
        <PlayerCard card={card} width={width} height={height} />
      </motion.div>

      {/* Rive reveal VFX overlay — plays after flip completes */}
      {riveBuffer && (
        <RiveCardRevealVFX
          rarity={card.rarity}
          isPlaying={showVFX}
          riveBuffer={riveBuffer}
          width={width}
          height={height}
        />
      )}
    </div>
  );
}
