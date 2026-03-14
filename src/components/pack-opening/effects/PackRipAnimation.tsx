import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PACK_DESIGNS } from '../constants';

interface PackRipAnimationProps {
  packTier: string;
  onComplete: () => void;
}

// Organic torn-edge clip paths — irregular, paper-like tear
const TOP_HALF_CLIP = 'polygon(0 0, 100% 0, 100% 48%, 96% 50%, 92% 47%, 87% 51%, 82% 48%, 76% 52%, 71% 49%, 65% 51%, 59% 48%, 53% 52%, 47% 49%, 42% 51%, 36% 48%, 30% 52%, 24% 49%, 18% 51%, 12% 48%, 7% 51%, 3% 49%, 0 50%)';
const BOTTOM_HALF_CLIP = 'polygon(0 50%, 3% 49%, 7% 51%, 12% 48%, 18% 51%, 24% 49%, 30% 52%, 36% 48%, 42% 51%, 47% 49%, 53% 52%, 59% 48%, 65% 51%, 71% 49%, 76% 52%, 82% 48%, 87% 51%, 92% 47%, 96% 50%, 100% 48%, 100% 100%, 0 100%)';

/** Foil debris that scatter on tear */
function useDebris(count: number, accentColor: string) {
  return useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 1.2;
      const distance = 80 + Math.random() * 220;
      const size = 4 + Math.random() * 12;
      const isLong = Math.random() > 0.5;
      return {
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance - 40,
        rotate: Math.random() * 1080 - 540,
        width: isLong ? size * 2.5 : size,
        height: isLong ? size * 0.4 : size * 0.6,
        color: accentColor,
        delay: Math.random() * 0.12,
        opacity: 0.5 + Math.random() * 0.5,
      };
    });
  }, [count, accentColor]);
}

/** The pack wrapper face */
function FoilPackFace({ design }: { design: typeof PACK_DESIGNS.PRO }) {
  return (
    <>
      {/* Metallic foil base texture */}
      <div className="absolute inset-0 opacity-[0.08]" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.15) 1px, rgba(255,255,255,0.15) 2px),
          repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.1) 1px, rgba(255,255,255,0.1) 2px)
        `,
        backgroundSize: '3px 3px',
      }} />

      {/* Holographic rainbow strip across center */}
      <div className="absolute left-0 right-0 h-[6px]" style={{
        top: '42%',
        background: 'linear-gradient(90deg, #ff000030, #ff800030, #ffff0030, #00ff0030, #0080ff30, #8000ff30, #ff000030)',
        backgroundSize: '200% 100%',
        animation: 'holo-shift 3s linear infinite',
        mixBlendMode: 'screen',
      }} />

      {/* Top crimp/heat seal */}
      <div className="absolute top-0 left-0 right-0 h-[14px]" style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
      }} />
      <div className="absolute top-[4px] left-[10px] right-[10px] h-[5px] rounded-sm" style={{
        backgroundImage: `repeating-linear-gradient(90deg, ${design.foilAccent}25 0px, ${design.foilAccent}25 3px, transparent 3px, transparent 6px)`,
      }} />

      {/* Wrapper crinkle lines */}
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: `
          linear-gradient(${165 + Math.random() * 20}deg, transparent 18%, rgba(255,255,255,0.9) 18.5%, transparent 19%),
          linear-gradient(${170 + Math.random() * 15}deg, transparent 52%, rgba(255,255,255,0.7) 52.5%, transparent 53%),
          linear-gradient(${160 + Math.random() * 25}deg, transparent 73%, rgba(255,255,255,0.6) 73.5%, transparent 74%),
          linear-gradient(${175 + Math.random() * 10}deg, transparent 35%, rgba(255,255,255,0.5) 35.5%, transparent 36%)
        `,
      }} />

      {/* Tear notch (the little v-cut where you start tearing) */}
      <div className="absolute right-0 top-[48%] w-[8px] h-[12px]" style={{
        background: `linear-gradient(to left, ${design.foilAccent}60, transparent)`,
        clipPath: 'polygon(100% 0, 0 50%, 100% 100%)',
      }} />

      {/* Pack content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
        <div className="relative mb-3">
          <img
            src="/oglogonobg.png"
            alt="ESP.FUN"
            className="w-[72px] h-[72px] object-contain relative z-10"
            style={{ filter: `drop-shadow(0 0 16px ${design.glowColor}) drop-shadow(0 2px 4px rgba(0,0,0,0.5))` }}
          />
        </div>
        <h3 className="font-black text-[17px] tracking-[0.15em] uppercase mb-1" style={{
          color: design.tierColor,
          textShadow: `0 0 20px ${design.glowColor}, 0 0 40px ${design.glowColor}, 0 2px 4px rgba(0,0,0,0.6)`,
        }}>
          {design.tierLabel}
        </h3>
        <div className="rounded-sm px-4 py-0.5 mb-2" style={{
          background: design.tierBg,
          border: `1px solid ${design.foilAccent}30`,
          backdropFilter: 'blur(4px)',
        }}>
          <span className="text-[8px] font-black tracking-[0.25em] uppercase" style={{ color: design.tierColor }}>
            PLAYER SERIES
          </span>
        </div>
        <p className="text-white/30 text-[8px] font-semibold tracking-[0.3em] uppercase">
          4 PLAYER CARDS
        </p>
      </div>

      {/* Bottom barcode / serial area */}
      <div className="absolute bottom-0 left-0 right-0 h-[36px]" style={{
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 100%)',
      }}>
        <div className="absolute bottom-[10px] left-[16px] flex gap-[1px]">
          {[3,1,2,1,3,2,1,1,2,3,1,2,1,1,3,2,1,2,1,3,1,2,3,1].map((w, i) => (
            <div key={i} className="bg-white/12 rounded-[0.5px]" style={{ width: w, height: 14 }} />
          ))}
        </div>
        <div className="absolute bottom-[10px] right-[16px]">
          <span className="text-white/15 text-[6px] font-mono tracking-wider">ESP-{design.tierLabel}-S1</span>
        </div>
      </div>

      {/* 3D edge insets */}
      <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
        boxShadow: `
          inset 1px 0 3px rgba(255,255,255,0.1),
          inset -1px 0 3px rgba(0,0,0,0.2),
          inset 0 1px 3px rgba(255,255,255,0.08),
          inset 0 -1px 4px rgba(0,0,0,0.25)
        `,
      }} />
    </>
  );
}

/** Cards that fly out of the torn pack */
function FlyingCards({ design, count }: { design: typeof PACK_DESIGNS.PRO; count: number }) {
  const cards = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const spread = (i - (count - 1) / 2) * 55;
      return {
        id: i,
        targetX: spread,
        targetY: -180 - Math.abs(spread) * 0.3,
        rotation: (i - (count - 1) / 2) * 8,
        delay: 0.05 + i * 0.08,
      };
    });
  }, [count]);

  return (
    <>
      {cards.map((card) => (
        <motion.div
          key={card.id}
          className="absolute rounded-md overflow-hidden"
          style={{
            width: 52,
            height: 72,
            background: 'linear-gradient(150deg, #0c1220 0%, #111b2e 50%, #0a1628 100%)',
            border: '2px solid #1e3a5f',
            boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 8px ${design.foilAccent}30`,
            left: '50%',
            top: '50%',
            marginLeft: -26,
            marginTop: -36,
          }}
          initial={{ x: 0, y: 20, scale: 0.3, opacity: 0, rotateZ: 0, rotateX: 60 }}
          animate={{
            x: card.targetX,
            y: card.targetY,
            scale: 1,
            opacity: [0, 1, 1, 0.8],
            rotateZ: card.rotation,
            rotateX: [60, 20, -5, 0],
          }}
          transition={{
            duration: 0.7,
            delay: card.delay,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {/* Mini card back design */}
          <div className="absolute inset-[3px] rounded-sm overflow-hidden" style={{
            background: 'radial-gradient(ellipse at 50% 30%, #1a2a40 0%, #0c1220 100%)',
          }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full" style={{
                background: `radial-gradient(circle, ${design.foilAccent}40 0%, transparent 70%)`,
                border: `1px solid ${design.foilAccent}30`,
              }} />
            </div>
          </div>
        </motion.div>
      ))}
    </>
  );
}

export function PackRipAnimation({ packTier, onComplete }: PackRipAnimationProps) {
  const [stage, setStage] = useState<'idle' | 'shake' | 'freeze' | 'tear' | 'reveal' | 'done'>('idle');
  const design = PACK_DESIGNS[packTier] || PACK_DESIGNS.PRO;
  const debris = useDebris(12, design.foilAccent);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage('shake'), 100),
      setTimeout(() => setStage('freeze'), 1400),
      setTimeout(() => setStage('tear'), 1650),
      setTimeout(() => setStage('reveal'), 2000),
      setTimeout(() => setStage('done'), 3200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (stage === 'done') onComplete();
  }, [stage, onComplete]);

  const packW = 220;
  const packH = 320;

  const packStyle = {
    width: packW,
    height: packH,
    background: design.foilGradient,
    borderRadius: 8,
    boxShadow: `
      0 8px 40px ${design.glowColor},
      0 2px 8px rgba(0,0,0,0.5),
      0 0 0 1px rgba(255,255,255,0.05)
    `,
  };

  // Exponential shake — slow rumble building to violent
  const shakeX = [0, -1, 1, -2, 2, -3, 4, -5, 6, -8, 10, -12, 14, -11, 8, -5, 3, -1, 0];
  const shakeY = [0, 0, -1, 1, -1, 2, -2, 3, -3, 2, -4, 3, -2, 1, -1, 0, 0, 0, 0];
  const shakeR = [0, -0.2, 0.3, -0.5, 0.7, -1, 1.3, -1.7, 2.1, -2.5, 2.8, -2.2, 1.6, -1, 0.5, -0.2, 0, 0, 0];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 300, height: 420 }}>
      {/* Ambient energy glow during shake */}
      {(stage === 'shake' || stage === 'freeze') && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${design.foilAccent}20 0%, ${design.foilAccent}08 40%, transparent 70%)`,
          }}
          animate={{ scale: [0.8, 1.3], opacity: [0.3, 1] }}
          transition={{ duration: 1.5, ease: 'easeIn' }}
        />
      )}

      <AnimatePresence mode="sync">
        {/* === INTACT PACK: SHAKE PHASE === */}
        {(stage === 'idle' || stage === 'shake') && (
          <motion.div
            key="pack-intact"
            className="absolute overflow-hidden"
            style={packStyle}
            animate={stage === 'shake' ? { x: shakeX, y: shakeY, rotate: shakeR } : {}}
            transition={{ duration: 1.3, ease: 'easeIn' }}
            exit={{ opacity: 0, transition: { duration: 0.05 } }}
          >
            <FoilPackFace design={design} />

            {/* Center seam light — energy building up */}
            <motion.div
              className="absolute left-0 right-0 pointer-events-none"
              style={{ top: '47%', height: 6, overflow: 'visible' }}
              animate={{ opacity: [0, 0, 0.1, 0.3, 0.6, 1] }}
              transition={{ duration: 1.3, ease: 'easeIn' }}
            >
              <div className="absolute inset-0" style={{
                background: `linear-gradient(90deg, transparent 5%, ${design.foilAccent} 30%, white 50%, ${design.foilAccent} 70%, transparent 95%)`,
                filter: 'blur(3px)',
              }} />
              {/* Wider glow halo */}
              <motion.div
                className="absolute -inset-x-4 -inset-y-6"
                animate={{ opacity: [0, 0, 0.2, 0.5] }}
                transition={{ duration: 1.3 }}
                style={{
                  background: `radial-gradient(ellipse at 50% 50%, ${design.foilAccent}60 0%, transparent 70%)`,
                  filter: 'blur(8px)',
                }}
              />
            </motion.div>

            {/* Sparks from seam */}
            {stage === 'shake' && (
              <div className="absolute left-0 right-0" style={{ top: '47%' }}>
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: 2 + Math.random() * 3,
                      height: 2 + Math.random() * 3,
                      background: i % 2 ? 'white' : design.foilAccent,
                      left: `${20 + Math.random() * 60}%`,
                      boxShadow: `0 0 4px ${design.foilAccent}`,
                    }}
                    animate={{
                      y: [0, -(15 + Math.random() * 30)],
                      x: [(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 40],
                      opacity: [0, 1, 0],
                      scale: [0.5, 1.5, 0],
                    }}
                    transition={{
                      duration: 0.4 + Math.random() * 0.3,
                      delay: 0.9 + i * 0.06,
                      repeat: 2,
                      ease: 'easeOut',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Shimmer */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              <div className="shimmer-sweep absolute inset-0 opacity-15" />
            </div>
          </motion.div>
        )}

        {/* === FREEZE FRAME — peak tension === */}
        {stage === 'freeze' && (
          <motion.div
            key="pack-freeze"
            className="absolute overflow-hidden"
            style={{
              ...packStyle,
              filter: `brightness(1.2)`,
            }}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.03, 1.02] }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            exit={{ opacity: 0, transition: { duration: 0.03 } }}
          >
            <FoilPackFace design={design} />

            {/* Bright tear line at peak */}
            <div className="absolute left-0 right-0 pointer-events-none" style={{ top: '46%', height: 16 }}>
              <div className="absolute inset-0" style={{
                background: `linear-gradient(90deg, transparent 2%, ${design.foilAccent} 20%, white 50%, ${design.foilAccent} 80%, transparent 98%)`,
                filter: 'blur(4px)',
                opacity: 0.95,
              }} />
            </div>

            {/* Intense outer glow */}
            <div className="absolute -inset-8 pointer-events-none" style={{
              background: `radial-gradient(ellipse at 50% 48%, ${design.foilAccent}50 0%, transparent 60%)`,
              filter: 'blur(12px)',
            }} />
          </motion.div>
        )}

        {/* === TEAR PHASE — pack rips open, halves fold away === */}
        {(stage === 'tear' || stage === 'reveal') && (
          <>
            {/* Top half — folds up and back */}
            <motion.div
              key="top-half"
              className="absolute overflow-hidden"
              style={{
                ...packStyle,
                clipPath: TOP_HALF_CLIP,
                transformOrigin: 'center top',
              }}
              initial={{ y: 0, rotateX: 0, scale: 1 }}
              animate={{
                y: -60,
                rotateX: -65,
                scale: 0.85,
                opacity: [1, 1, 0.5, 0],
              }}
              transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
            >
              <FoilPackFace design={design} />
            </motion.div>

            {/* Bottom half — folds down and back */}
            <motion.div
              key="bottom-half"
              className="absolute overflow-hidden"
              style={{
                ...packStyle,
                clipPath: BOTTOM_HALF_CLIP,
                transformOrigin: 'center bottom',
              }}
              initial={{ y: 0, rotateX: 0, scale: 1 }}
              animate={{
                y: 70,
                rotateX: 55,
                scale: 0.85,
                opacity: [1, 1, 0.5, 0],
              }}
              transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
            >
              <FoilPackFace design={design} />
            </motion.div>

            {/* Tear line energy flash */}
            <motion.div
              key="tear-flash"
              className="absolute pointer-events-none"
              style={{
                width: packW + 60,
                height: 4,
                top: '50%',
                left: '50%',
                marginLeft: -(packW + 60) / 2,
                marginTop: -2,
                background: `linear-gradient(90deg, transparent, ${design.foilAccent}, white, ${design.foilAccent}, transparent)`,
                filter: 'blur(2px)',
              }}
              initial={{ scaleX: 0, opacity: 1 }}
              animate={{ scaleX: [0, 1.2], opacity: [1, 0] }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />

            {/* Foil debris scattering */}
            {debris.map((d) => (
              <motion.div
                key={`debris-${d.id}`}
                className="absolute"
                style={{
                  width: d.width,
                  height: d.height,
                  background: `linear-gradient(135deg, ${d.color}cc, ${d.color}40)`,
                  borderRadius: 1,
                  boxShadow: `0 0 3px ${d.color}40`,
                  left: '50%',
                  top: '50%',
                  marginLeft: -d.width / 2,
                  marginTop: -d.height / 2,
                }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: d.opacity }}
                animate={{
                  x: d.x,
                  y: d.y,
                  rotate: d.rotate,
                  opacity: [d.opacity, d.opacity * 0.6, 0],
                }}
                transition={{
                  duration: 0.8,
                  delay: d.delay,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
              />
            ))}

            {/* === CARDS FLYING OUT of the pack === */}
            <FlyingCards design={design} count={4} />

            {/* Central energy burst */}
            <motion.div
              key="energy-burst"
              className="absolute pointer-events-none"
              style={{
                width: 500,
                height: 500,
                left: '50%',
                top: '50%',
                marginLeft: -250,
                marginTop: -250,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${design.foilAccent}60 0%, ${design.foilAccent}20 25%, transparent 55%)`,
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: [0, 1.6], opacity: [1, 0] }}
              transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
            />

            {/* Light rays from tear point */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={`ray-${i}`}
                className="absolute pointer-events-none"
                style={{
                  width: 2,
                  height: 120,
                  left: '50%',
                  top: '50%',
                  marginLeft: -1,
                  marginTop: -60,
                  background: `linear-gradient(to bottom, transparent, ${design.foilAccent}80, transparent)`,
                  transformOrigin: 'center center',
                  transform: `rotate(${i * 45}deg)`,
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 1.5, 0], opacity: [0, 0.8, 0] }}
                transition={{ duration: 0.6, delay: 0.05 + i * 0.02, ease: 'easeOut' }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
