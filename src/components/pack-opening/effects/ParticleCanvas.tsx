import { useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';

type Preset = 'burst' | 'rain' | 'reveal';

interface ParticleCanvasProps {
  trigger: number; // increment to fire
  preset: Preset;
  colors?: string[];
  origin?: { x: number; y: number };
}

export function ParticleCanvas({ trigger, preset, colors, origin }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<confetti.CreateTypes | null>(null);
  const rainIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      confettiRef.current = confetti.create(canvasRef.current, {
        resize: true,
        useWorker: true,
      });
    }
    return () => {
      confettiRef.current?.reset();
      if (rainIntervalRef.current) clearInterval(rainIntervalRef.current);
    };
  }, []);

  const fireBurst = useCallback(() => {
    confettiRef.current?.({
      particleCount: 80,
      spread: 70,
      origin: origin || { x: 0.5, y: 0.5 },
      colors: colors || ['#FFD700', '#FFA500', '#FF4500'],
      startVelocity: 30,
      gravity: 0.8,
      ticks: 100,
      shapes: ['circle', 'square'],
      scalar: 1,
    });
  }, [colors, origin]);

  const fireReveal = useCallback(() => {
    // Multiple bursts for dramatic effect
    const o = origin || { x: 0.5, y: 0.5 };
    const c = colors || ['#FFD700', '#FFA500', '#FF4500'];

    confettiRef.current?.({
      particleCount: 40,
      spread: 60,
      origin: o,
      colors: c,
      startVelocity: 25,
      gravity: 0.6,
      ticks: 80,
      shapes: ['circle'],
      scalar: 0.8,
    });

    setTimeout(() => {
      confettiRef.current?.({
        particleCount: 25,
        spread: 90,
        origin: o,
        colors: c,
        startVelocity: 15,
        gravity: 0.5,
        ticks: 120,
        shapes: ['square'],
        scalar: 0.6,
      });
    }, 150);
  }, [colors, origin]);

  const startRain = useCallback(() => {
    if (rainIntervalRef.current) clearInterval(rainIntervalRef.current);
    const c = colors || ['#FFD700', '#FFA500', '#FF4500', '#FBBF24'];

    rainIntervalRef.current = setInterval(() => {
      confettiRef.current?.({
        particleCount: 3,
        spread: 160,
        origin: { x: Math.random(), y: -0.1 },
        colors: c,
        startVelocity: 5,
        gravity: 0.4,
        ticks: 300,
        shapes: ['circle', 'square'],
        scalar: 0.7,
        drift: (Math.random() - 0.5) * 0.5,
      });
    }, 200);
  }, [colors]);

  useEffect(() => {
    if (trigger <= 0) return;

    switch (preset) {
      case 'burst':
        fireBurst();
        break;
      case 'reveal':
        fireReveal();
        break;
      case 'rain':
        startRain();
        break;
    }

    return () => {
      if (preset === 'rain' && rainIntervalRef.current) {
        clearInterval(rainIntervalRef.current);
        rainIntervalRef.current = null;
      }
    };
  }, [trigger, preset, fireBurst, fireReveal, startRain]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[60] pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
