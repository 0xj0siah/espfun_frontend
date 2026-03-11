import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CardFlipContainer } from '../cards/CardFlipContainer';
import { ParticleCanvas } from '../effects/ParticleCanvas';
import { ScreenFlash } from '../effects/ScreenFlash';
import { RARITY_CONFIG, AUTO_REVEAL_DELAY, CARD_WIDTH, CARD_HEIGHT, CARD_WIDTH_MOBILE, CARD_HEIGHT_MOBILE } from '../constants';
import type { CardRevealPhaseProps, RevealCard } from '../types';
import { useIsMobile } from '../../ui/use-mobile';

export function CardRevealPhase({ cards, currentIndex, onRevealCard, onAllRevealed }: CardRevealPhaseProps) {
  const isMobile = useIsMobile();
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [particleColors, setParticleColors] = useState<string[]>([]);
  const [flashTrigger, setFlashTrigger] = useState(0);
  const [flashColor, setFlashColor] = useState('white');
  const [rarityLabel, setRarityLabel] = useState<{ text: string; color: string } | null>(null);

  const cardW = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH;
  const cardH = isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT;

  // Find next unrevealed card
  const nextUnrevealedIndex = cards.findIndex(c => !c.isRevealed);
  const allFlipped = cards.every(c => c.isRevealed);

  // Auto-advance to summary after all revealed
  useEffect(() => {
    if (allFlipped) {
      const timer = setTimeout(onAllRevealed, 1500);
      return () => clearTimeout(timer);
    }
  }, [allFlipped, onAllRevealed]);

  // Auto-reveal timer (fallback if user doesn't click)
  useEffect(() => {
    if (allFlipped || nextUnrevealedIndex === -1) return;

    const timer = setTimeout(() => {
      handleReveal(nextUnrevealedIndex);
    }, AUTO_REVEAL_DELAY);
    return () => clearTimeout(timer);
  }, [nextUnrevealedIndex, allFlipped]);

  const handleReveal = useCallback((index: number) => {
    if (cards[index]?.isRevealed) return;

    const card = cards[index];
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

    onRevealCard(index);
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

      {/* Card row */}
      <div className="relative z-10 flex flex-wrap justify-center gap-4 px-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, scale: 0.3, y: 80 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            transition={{
              delay: 0.3 + index * 0.12,
              type: 'spring',
              stiffness: 200,
              damping: 20,
            }}
          >
            <CardFlipContainer
              card={card}
              isFlipped={card.isRevealed}
              onClick={() => !card.isRevealed && handleReveal(index)}
              width={cardW}
              height={cardH}
              className={!card.isRevealed && index === nextUnrevealedIndex ? 'ring-2 ring-white/30 rounded-xl ring-offset-2 ring-offset-transparent' : ''}
            />
          </motion.div>
        ))}
      </div>

      {/* Skip button */}
      {!allFlipped && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          onClick={() => {
            // Reveal all remaining
            cards.forEach((card, i) => {
              if (!card.isRevealed) {
                setTimeout(() => handleReveal(i), i * 100);
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
