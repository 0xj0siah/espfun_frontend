import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CardFlipContainer } from '../cards/CardFlipContainer';
import { ParticleCanvas } from '../effects/ParticleCanvas';
import { ScreenFlash } from '../effects/ScreenFlash';
import { RARITY_CONFIG, AUTO_REVEAL_DELAY, CARD_WIDTH, CARD_HEIGHT, CARD_WIDTH_MOBILE, CARD_HEIGHT_MOBILE } from '../constants';
import type { CardRevealPhaseProps, RevealCard, RarityTier } from '../types';
import { useIsMobile } from '../../ui/use-mobile';

const RARITY_ORDER: Record<RarityTier, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

export function CardRevealPhase({ cards, currentIndex, onRevealCard, onAllRevealed, riveCardRevealBuffer }: CardRevealPhaseProps) {
  const isMobile = useIsMobile();
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [particleColors, setParticleColors] = useState<string[]>([]);
  const [flashTrigger, setFlashTrigger] = useState(0);
  const [flashColor, setFlashColor] = useState('white');
  const [rarityLabel, setRarityLabel] = useState<{ text: string; color: string } | null>(null);

  const cardW = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH;
  const cardH = isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT;

  // Sort cards so the highest-rarity card is revealed last (standard pack-opening UX)
  const sortedCards = useMemo(() => {
    const indexed = cards.map((card, originalIndex) => ({ card, originalIndex }));
    indexed.sort((a, b) => RARITY_ORDER[a.card.rarity] - RARITY_ORDER[b.card.rarity]);
    return indexed;
  }, [cards]);

  // Find next unrevealed card (in sorted order)
  const nextUnrevealedSortedIdx = sortedCards.findIndex(({ card }) => !card.isRevealed);
  const allFlipped = cards.every(c => c.isRevealed);

  // Check if the last card is epic/legendary for dramatic pause
  const lastCard = sortedCards[sortedCards.length - 1]?.card;
  const lastCardIsDramatic = lastCard && (lastCard.rarity === 'epic' || lastCard.rarity === 'legendary');

  // Auto-advance to summary after all revealed
  useEffect(() => {
    if (allFlipped) {
      const timer = setTimeout(onAllRevealed, 1500);
      return () => clearTimeout(timer);
    }
  }, [allFlipped, onAllRevealed]);

  // Auto-reveal timer (fallback if user doesn't click)
  useEffect(() => {
    if (allFlipped || nextUnrevealedSortedIdx === -1) return;
    const { originalIndex } = sortedCards[nextUnrevealedSortedIdx];

    const timer = setTimeout(() => {
      handleReveal(originalIndex);
    }, AUTO_REVEAL_DELAY);
    return () => clearTimeout(timer);
  }, [nextUnrevealedSortedIdx, allFlipped]);

  const handleReveal = useCallback((originalIndex: number) => {
    if (cards[originalIndex]?.isRevealed) return;

    const card = cards[originalIndex];
    const config = RARITY_CONFIG[card.rarity];

    // Trigger effects based on rarity
    if (card.rarity === 'epic' || card.rarity === 'legendary') {
      setFlashColor(card.rarity === 'legendary' ? '#FFD700' : '#C084FC');
      setFlashTrigger(prev => prev + 1);
    }

    setParticleColors(config.particleColors);
    setParticleTrigger(prev => prev + 1);

    // Show rarity label
    setRarityLabel({ text: config.label.toUpperCase() + '!', color: config.textColor });
    setTimeout(() => setRarityLabel(null), 1200);

    onRevealCard(originalIndex);
  }, [cards, onRevealCard]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
    >
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/90" />

      {/* Particle effects */}
      <ParticleCanvas
        trigger={particleTrigger}
        preset="reveal"
        colors={particleColors}
        origin={{ x: 0.5, y: 0.45 }}
      />

      {/* Screen flash */}
      <ScreenFlash trigger={flashTrigger} color={flashColor} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative z-10 text-center mb-8"
      >
        <h3 className="text-2xl font-bold text-white mb-1">
          {allFlipped ? 'All Cards Revealed!' : 'Tap to Reveal'}
        </h3>
        <p className="text-white/50 text-sm">
          {allFlipped
            ? 'Check out your new players!'
            : `${cards.filter(c => c.isRevealed).length} / ${cards.length} revealed`}
        </p>
      </motion.div>

      {/* Rarity label popup */}
      <AnimatePresence>
        {rarityLabel && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="fixed top-1/4 left-1/2 -translate-x-1/2 z-[70]"
          >
            <span className={`text-4xl font-black tracking-wider ${rarityLabel.color} drop-shadow-lg`}>
              {rarityLabel.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card row — sorted by rarity (best last) */}
      <div className="relative z-10 flex flex-wrap justify-center gap-4 px-4">
        {sortedCards.map(({ card, originalIndex }, sortedIdx) => {
          const isLastDramatic = sortedIdx === sortedCards.length - 1 && lastCardIsDramatic;

          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, scale: 0.3, y: 80 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              transition={{
                // Last dramatic card gets a slightly longer delay for suspense
                delay: 0.3 + sortedIdx * 0.12 + (isLastDramatic ? 0.3 : 0),
                type: 'spring',
                stiffness: 180,
                damping: 14, // Lower damping = more overshoot on landing
              }}
            >
              <CardFlipContainer
                card={card}
                isFlipped={card.isRevealed}
                onClick={() => !card.isRevealed && handleReveal(originalIndex)}
                width={cardW}
                height={cardH}
                riveBuffer={riveCardRevealBuffer}
                className={!card.isRevealed && sortedIdx === nextUnrevealedSortedIdx ? 'ring-2 ring-white/30 rounded-xl ring-offset-2 ring-offset-transparent' : ''}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Skip button */}
      {!allFlipped && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          onClick={() => {
            // Reveal all remaining in sorted order
            sortedCards.forEach(({ card, originalIndex }, i) => {
              if (!card.isRevealed) {
                setTimeout(() => handleReveal(originalIndex), i * 100);
              }
            });
          }}
          className="relative z-10 mt-6 text-white/40 hover:text-white/70 text-xs transition-colors"
        >
          Reveal All
        </motion.button>
      )}
    </motion.div>
  );
}
