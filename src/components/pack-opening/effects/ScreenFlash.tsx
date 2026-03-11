import { motion } from 'motion/react';
import { SCREEN_FLASH_DURATION } from '../constants';

interface ScreenFlashProps {
  color?: string;
  trigger: number; // increment to fire
}

export function ScreenFlash({ color = 'white', trigger }: ScreenFlashProps) {
  if (trigger <= 0) return null;

  return (
    <motion.div
      key={trigger}
      className="fixed inset-0 z-[55] pointer-events-none"
      style={{ backgroundColor: color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.4, 0] }}
      transition={{ duration: SCREEN_FLASH_DURATION / 1000, ease: 'easeOut' }}
    />
  );
}
