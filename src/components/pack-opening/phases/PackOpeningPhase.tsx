import { useCallback, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { RivePackOpen } from '../effects/RivePackOpen';
import { ParticleCanvas } from '../effects/ParticleCanvas';
import { PACK_DESIGNS } from '../constants';
import type { PackOpeningPhaseProps } from '../types';

export function PackOpeningPhase({ pack, onComplete, riveBuffer }: PackOpeningPhaseProps) {
  const design = PACK_DESIGNS[pack.id] || PACK_DESIGNS.PRO;
  const containerRef = useRef<HTMLDivElement>(null);
  const [shaking, setShaking] = useState(false);
  const [zooming, setZooming] = useState(false);

  // Screen shake effect — brief viewport jitter on rip
  const handleRipStart = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 250);
  }, []);

  // Bass-drop zoom — brief 1.02x scale punch on burst
  const handleBurst = useCallback(() => {
    setZooming(true);
    setTimeout(() => setZooming(false), 350);
  }, []);

  const handleRipComplete = useCallback(() => {
    setTimeout(onComplete, 300);
  }, [onComplete]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        // Screen shake: rapid CSS jitter
        animation: shaking ? 'screen-shake 80ms linear 3' : undefined,
        // Bass-drop zoom
        transform: zooming ? 'scale(1.02)' : 'scale(1)',
        transition: zooming ? 'transform 0.08s ease-out' : 'transform 0.3s cubic-bezier(0.22, 0.68, 0.36, 1)',
      }}
    >
      {/* Dark backdrop */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.92 }}
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

      {/* Pack animation — Rive with fallback to enhanced PackRipAnimation */}
      <div className="relative z-10">
        <RivePackOpen
          packTier={pack.id}
          onComplete={handleRipComplete}
          onRipStart={handleRipStart}
          onBurst={handleBurst}
          riveBuffer={riveBuffer ?? null}
        />
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
