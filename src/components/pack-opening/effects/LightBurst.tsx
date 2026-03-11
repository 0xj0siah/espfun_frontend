import { motion } from 'motion/react';

interface LightBurstProps {
  color?: string;
  delay?: number;
}

export function LightBurst({ color = 'rgba(255, 215, 0, 0.6)', delay = 0 }: LightBurstProps) {
  return (
    <motion.div
      className="absolute z-30 pointer-events-none"
      style={{
        left: '50%',
        top: '50%',
        width: '200vmax',
        height: '200vmax',
        marginLeft: '-100vmax',
        marginTop: '-100vmax',
        background: `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0.3) 20%, transparent 60%)`,
        borderRadius: '50%',
      }}
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: [0, 1.5], opacity: [1, 0] }}
      transition={{
        duration: 0.8,
        delay,
        ease: 'easeOut',
      }}
    />
  );
}
