import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CardFlipContainer } from '../cards/CardFlipContainer';
import { ParticleCanvas } from '../effects/ParticleCanvas';
import { RARITY_CONFIG, CARD_WIDTH, CARD_HEIGHT, CARD_WIDTH_MOBILE, CARD_HEIGHT_MOBILE } from '../constants';
import { Button } from '../../ui/button';
import { useIsMobile } from '../../ui/use-mobile';
import { Package, ArrowLeft } from 'lucide-react';
import type { CollectionSummaryPhaseProps, RarityTier } from '../types';
import { formatEther } from 'viem';

function formatShares(weiValue: number): string {
  try {
    const wei = BigInt(weiValue);
    return parseFloat(formatEther(wei)).toFixed(4);
  } catch {
    return '0.0000';
  }
}

export function CollectionSummaryPhase({ cards, onOpenAnother, onClose }: CollectionSummaryPhaseProps) {
  const isMobile = useIsMobile();
  const [rainTrigger, setRainTrigger] = useState(0);
  const cardW = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH;
  const cardH = isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT;

  // Start confetti rain
  useEffect(() => {
    setRainTrigger(1);
  }, []);

  // Rarity breakdown
  const rarityCounts = cards.reduce((acc, card) => {
    acc[card.rarity] = (acc[card.rarity] || 0) + 1;
    return acc;
  }, {} as Record<RarityTier, number>);

  // Best card
  const rarityOrder: RarityTier[] = ['legendary', 'epic', 'rare', 'common'];
  const bestRarity = rarityOrder.find(r => rarityCounts[r]) || 'common';
  const bestConfig = RARITY_CONFIG[bestRarity];

  // Total shares
  const totalShares = cards.reduce((sum, c) => sum + c.shares, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto py-8"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-black/90" />

      {/* Confetti rain */}
      <ParticleCanvas
        trigger={rainTrigger}
        preset="rain"
        colors={bestConfig.particleColors}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center space-y-6 max-w-4xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className="text-center"
        >
          <h2 className="text-3xl font-black mb-2 bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
            Pack Opened!
          </h2>
          <p className="text-white/50 text-sm">Here are your new players</p>
        </motion.div>

        {/* Rarity breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {rarityOrder.filter(r => rarityCounts[r]).map(rarity => {
            const config = RARITY_CONFIG[rarity];
            return (
              <div
                key={rarity}
                className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1"
              >
                <span className={`text-xs font-bold ${config.textColor}`}>
                  {rarityCounts[rarity]}x {config.label}
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
            <span className="text-xs font-bold text-green-400">
              {formatShares(totalShares)} Total Shares
            </span>
          </div>
        </motion.div>

        {/* Cards row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-4"
        >
          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
            >
              <CardFlipContainer
                card={card}
                isFlipped={true}
                onClick={() => {}}
                width={cardW}
                height={cardH}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex items-center gap-4"
        >
          <Button
            onClick={onClose}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Close
          </Button>
          <Button
            onClick={onOpenAnother}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
          >
            <Package className="w-4 h-4 mr-2" />
            Open Another Pack
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
