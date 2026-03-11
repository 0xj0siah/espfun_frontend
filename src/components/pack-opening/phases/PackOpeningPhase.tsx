import { useCallback } from 'react';
import { motion } from 'motion/react';
import { PackRipAnimation } from '../effects/PackRipAnimation';
import { ParticleCanvas } from '../effects/ParticleCanvas';
import { PACK_DESIGNS } from '../constants';
import type { PackOpeningPhaseProps } from '../types';

export function PackOpeningPhase({ pack, onComplete }: PackOpeningPhaseProps) {
  const design = PACK_DESIGNS[pack.id] || PACK_DESIGNS.PRO;

  const handleRipComplete = useCallback(() => {
    // Small extra delay after rip for dramatic pause
    setTimeout(onComplete, 400);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Dark backdrop */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ duration: 0.5 }}
      />

      {/* Ambient glow */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${design.foilAccent}40 0%, transparent 60%)`,
        }}
      />

      {/* Particle effects during opening */}
      <ParticleCanvas
        trigger={1}
        preset="burst"
        colors={[design.foilAccent, '#ffffff', design.foilAccent + '80']}
        origin={{ x: 0.5, y: 0.5 }}
      />

      {/* Pack rip animation */}
      <div className="relative z-10">
        <PackRipAnimation packTier={pack.id} onComplete={handleRipComplete} />
      </div>

      {/* "Opening Pack" text */}
      <motion.p
        className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium tracking-wider"
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        Opening Pack...
      </motion.p>
    </motion.div>
  );
}
