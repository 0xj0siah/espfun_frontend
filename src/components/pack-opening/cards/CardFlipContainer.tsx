import { motion } from 'motion/react';
import { PlayerCard } from './PlayerCard';
import { CardBack } from './CardBack';
import { CARD_FLIP_DURATION } from '../constants';
import type { RevealCard } from '../types';

interface CardFlipContainerProps {
  card: RevealCard;
  isFlipped: boolean;
  onClick: () => void;
  width: number;
  height: number;
  className?: string;
}

export function CardFlipContainer({
  card,
  isFlipped,
  onClick,
  width,
  height,
  className = '',
}: CardFlipContainerProps) {
  return (
    <div
      className={`cursor-pointer ${className}`}
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
    </div>
  );
}
