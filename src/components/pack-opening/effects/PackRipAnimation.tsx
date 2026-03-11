import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LightBurst } from './LightBurst';
import { PACK_DESIGNS } from '../constants';

interface PackRipAnimationProps {
  packTier: string;
  onComplete: () => void;
}

// Jagged zigzag clip path for torn edges
const LEFT_CLIP = 'polygon(0 0, 48% 0, 52% 8%, 46% 16%, 53% 24%, 47% 32%, 52% 40%, 46% 48%, 53% 56%, 47% 64%, 52% 72%, 46% 80%, 53% 88%, 48% 100%, 0 100%)';
const RIGHT_CLIP = 'polygon(52% 0, 100% 0, 100% 100%, 48% 100%, 53% 88%, 46% 80%, 52% 72%, 47% 64%, 53% 56%, 46% 48%, 52% 40%, 47% 32%, 53% 24%, 46% 16%, 52% 8%)';

/** Inline foil wrapper content (matches PackSelectionPhase design) */
function FoilPackFace({ design, tierLabel }: { design: typeof PACK_DESIGNS.PRO; tierLabel?: string }) {
  return (
    <>
      {/* Foil micro-texture */}
      <div className="absolute inset-0 opacity-[0.12]" style={{
        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%)',
        backgroundSize: '4px 4px',
      }} />

      {/* Wrapper crinkle lines */}
      <div className="absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: `
          linear-gradient(172deg, transparent 20%, rgba(255,255,255,0.8) 20.5%, transparent 21%),
          linear-gradient(168deg, transparent 55%, rgba(255,255,255,0.6) 55.5%, transparent 56%),
          linear-gradient(175deg, transparent 78%, rgba(255,255,255,0.5) 78.5%, transparent 79%)
        `,
      }} />

      {/* Top crimp seal */}
      <div className="absolute top-0 left-0 right-0 h-[10px]" style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, transparent 100%)',
      }} />
      <div className="absolute top-[3px] left-[8px] right-[8px] h-[4px] rounded-sm" style={{
        backgroundImage: `repeating-linear-gradient(90deg, ${design.foilAccent}30 0px, ${design.foilAccent}30 4px, transparent 4px, transparent 8px)`,
      }} />

      {/* Tear strip */}
      <div className="absolute top-[65px] left-0 right-0">
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${design.tearColor}50, transparent)` }} />
        <div className="h-[2px]" style={{
          backgroundImage: `repeating-linear-gradient(90deg, ${design.tearColor}40 0px, ${design.tearColor}40 3px, transparent 3px, transparent 7px)`,
        }} />
        <div className="absolute -top-[3px] right-[8px] w-[14px] h-[8px] rounded-b-sm" style={{
          background: design.tearColor,
          opacity: 0.35,
        }} />
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${design.tearColor}30, transparent)` }} />
      </div>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
        <div className="relative mb-2 mt-2">
          <img
            src="/oglogonobg.png"
            alt="ESP.FUN"
            className="w-16 h-16 object-contain relative z-10"
            style={{ filter: `drop-shadow(0 2px 10px ${design.glowColor})` }}
          />
        </div>
        <h3
          className="font-black text-[15px] tracking-wider uppercase mb-0.5"
          style={{
            color: design.tierColor,
            textShadow: `0 0 12px ${design.glowColor}, 0 1px 2px rgba(0,0,0,0.5)`,
          }}
        >
          {tierLabel || design.tierLabel} PACK
        </h3>
        <div
          className="rounded-sm px-3 py-0.5 mb-1.5"
          style={{
            background: design.tierBg,
            border: `1px solid ${design.foilAccent}40`,
          }}
        >
          <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: design.tierColor }}>
            {design.tierLabel} SERIES
          </span>
        </div>
        <p className="text-white/40 text-[9px] font-medium tracking-wider uppercase">
          4 Player Cards
        </p>
      </div>

      {/* Bottom barcode area */}
      <div className="absolute bottom-0 left-0 right-0 h-[32px] bg-black/20">
        <div className="absolute bottom-[8px] left-[14px] flex gap-[1px]">
          {[3,1,2,1,3,2,1,1,2,3,1,2,1,1,3,2,1,2,1,3].map((w, i) => (
            <div key={i} className="bg-white/15 rounded-[0.5px]" style={{ width: w, height: 12 }} />
          ))}
        </div>
        <div className="absolute bottom-[8px] right-[14px]">
          <span className="text-white/20 text-[7px] font-mono">ESP-{design.tierLabel}-2026</span>
        </div>
      </div>

      {/* Edge shadow for 3D depth */}
      <div className="absolute inset-0 rounded-md pointer-events-none" style={{
        boxShadow: 'inset 2px 0 4px rgba(255,255,255,0.08), inset -2px 0 4px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.06), inset 0 -2px 6px rgba(0,0,0,0.2)',
      }} />
    </>
  );
}

export function PackRipAnimation({ packTier, onComplete }: PackRipAnimationProps) {
  const [stage, setStage] = useState<'shake' | 'rip' | 'burst' | 'done'>('shake');
  const design = PACK_DESIGNS[packTier] || PACK_DESIGNS.PRO;

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage('rip'), 1200),
      setTimeout(() => setStage('burst'), 1500),
      setTimeout(() => setStage('done'), 2400),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (stage === 'done') onComplete();
  }, [stage, onComplete]);

  const packStyle = {
    width: 200,
    height: 300,
    background: design.foilGradient,
    boxShadow: `0 4px 30px ${design.glowColor}, 0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)`,
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: 240, height: 340 }}>
      <AnimatePresence>
        {/* Whole pack (shake phase) */}
        {stage === 'shake' && (
          <motion.div
            key="whole-pack"
            className="absolute rounded-md overflow-hidden"
            style={packStyle}
            animate={{
              x: [0, -3, 4, -6, 7, -9, 10, -7, 5, -3, 0],
              rotate: [0, -0.5, 0.8, -1.2, 1.5, -1.8, 2, -1.5, 1, -0.5, 0],
            }}
            transition={{
              duration: 1.2,
              ease: 'easeInOut',
            }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <FoilPackFace design={design} />

            {/* Light leak from center seam - intensifies during shake */}
            <motion.div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-full pointer-events-none"
              animate={{ opacity: [0, 0.2, 0.5, 0.8] }}
              transition={{ duration: 1.2 }}
            >
              <div
                className="w-full h-full blur-sm"
                style={{
                  background: `linear-gradient(to bottom, ${design.foilAccent}90 0%, ${design.foilAccent}30 30%, ${design.foilAccent}30 70%, ${design.foilAccent}90 100%)`,
                }}
              />
            </motion.div>

            {/* Shimmer sweep */}
            <div className="absolute inset-0 overflow-hidden rounded-md">
              <div className="shimmer-sweep absolute inset-0 opacity-20" />
            </div>
          </motion.div>
        )}

        {/* Ripping halves */}
        {(stage === 'rip' || stage === 'burst') && (
          <>
            {/* Left half */}
            <motion.div
              key="left-half"
              className="absolute rounded-md overflow-hidden"
              style={{
                ...packStyle,
                clipPath: LEFT_CLIP,
              }}
              initial={{ x: 0, rotate: 0 }}
              animate={{ x: -180, rotate: -18, opacity: [1, 1, 0] }}
              transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <FoilPackFace design={design} />
            </motion.div>

            {/* Right half */}
            <motion.div
              key="right-half"
              className="absolute rounded-md overflow-hidden"
              style={{
                ...packStyle,
                clipPath: RIGHT_CLIP,
              }}
              initial={{ x: 0, rotate: 0 }}
              animate={{ x: 180, rotate: 18, opacity: [1, 1, 0] }}
              transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <FoilPackFace design={design} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Light burst on rip */}
      {(stage === 'burst' || stage === 'rip') && (
        <LightBurst color={design.foilAccent + '99'} />
      )}
    </div>
  );
}
