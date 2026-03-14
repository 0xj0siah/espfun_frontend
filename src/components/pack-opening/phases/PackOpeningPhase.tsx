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
  const [ripStarted, setRipStarted] = useState(false);
  const [burstFired, setBurstFired] = useState(false);

  // Screen shake effect — brief viewport jitter on rip
  const handleRipStart = useCallback(() => {
    setShaking(true);
    setRipStarted(true);
    setTimeout(() => setShaking(false), 250);
  }, []);

  // Bass-drop zoom — brief 1.02x scale punch on burst
  const handleBurst = useCallback(() => {
    setZooming(true);
    setBurstFired(true);
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
        animation: shaking ? 'screen-shake 80ms linear 3' : undefined,
        transform: zooming ? 'scale(1.02)' : 'scale(1)',
        transition: zooming ? 'transform 0.08s ease-out' : 'transform 0.3s cubic-bezier(0.22, 0.68, 0.36, 1)',
      }}
    >
      {/* Dark backdrop */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.94 }}
        transition={{ duration: 0.5 }}
      />

      {/* Ambient radial glow — intensifies during rip */}
      <motion.div
        className="absolute inset-0"
        animate={{
          opacity: burstFired ? 0.5 : ripStarted ? 0.35 : 0.15,
        }}
        transition={{ duration: 0.3 }}
        style={{
          background: `radial-gradient(circle at 50% 50%, ${design.foilAccent}50 0%, ${design.foilAccent}15 30%, transparent 60%)`,
        }}
      />

      {/* Radial light rays (visible after rip starts) */}
      {ripStarted && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: burstFired ? 0.4 : 0.15 }}
          transition={{ duration: 0.3 }}
          style={{
            background: `conic-gradient(from 0deg at 50% 50%,
              transparent 0deg, ${design.foilAccent}20 10deg, transparent 20deg,
              transparent 45deg, ${design.foilAccent}15 55deg, transparent 65deg,
              transparent 90deg, ${design.foilAccent}20 100deg, transparent 110deg,
              transparent 135deg, ${design.foilAccent}15 145deg, transparent 155deg,
              transparent 180deg, ${design.foilAccent}20 190deg, transparent 200deg,
              transparent 225deg, ${design.foilAccent}15 235deg, transparent 245deg,
              transparent 270deg, ${design.foilAccent}20 280deg, transparent 290deg,
              transparent 315deg, ${design.foilAccent}15 325deg, transparent 335deg
            )`,
          }}
        />
      )}

      {/* Burst flash overlay */}
      {burstFired && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            background: `radial-gradient(circle at 50% 50%, ${design.foilAccent}80 0%, transparent 50%)`,
          }}
        />
      )}

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
