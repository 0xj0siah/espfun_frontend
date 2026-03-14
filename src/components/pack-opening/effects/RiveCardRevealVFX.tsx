import { useEffect, useState, useCallback } from 'react';
import { useRive, useStateMachineInput, EventType } from '@rive-app/react-canvas';
import { RARITY_TO_RIVE_INDEX } from '../constants';
import type { RarityTier } from '../types';

interface RiveCardRevealVFXProps {
  rarity: RarityTier;
  isPlaying: boolean;
  onComplete?: () => void;
  riveBuffer: ArrayBuffer | null;
  width: number;
  height: number;
}

export function RiveCardRevealVFX({
  rarity,
  isPlaying,
  onComplete,
  riveBuffer,
  width,
  height,
}: RiveCardRevealVFXProps) {
  const [riveFailed, setRiveFailed] = useState(!riveBuffer);

  // Don't render anything for common cards or if no .riv file
  if (rarity === 'common' || riveFailed || !riveBuffer) {
    return null;
  }

  return (
    <RiveCardRevealVFXInner
      rarity={rarity}
      isPlaying={isPlaying}
      onComplete={onComplete}
      riveBuffer={riveBuffer}
      width={width}
      height={height}
      onError={() => setRiveFailed(true)}
    />
  );
}

/** Inner component — only mounts when we know Rive buffer is available */
function RiveCardRevealVFXInner({
  rarity,
  isPlaying,
  onComplete,
  riveBuffer,
  width,
  height,
  onError,
}: RiveCardRevealVFXProps & { onError: () => void }) {
  const { rive, RiveComponent } = useRive({
    buffer: riveBuffer!,
    artboard: 'CardRevealVFX',
    stateMachines: 'CardRevealSM',
    autoplay: true,
    shouldResizeCanvasToContainer: true,
    onLoadError: onError,
  });

  const rarityInput = useStateMachineInput(rive, 'CardRevealSM', 'rarity');
  const playInput = useStateMachineInput(rive, 'CardRevealSM', 'play');

  // Set rarity input
  useEffect(() => {
    if (!rive || !rarityInput) return;
    rarityInput.value = RARITY_TO_RIVE_INDEX[rarity] ?? 0;
  }, [rive, rarityInput, rarity]);

  // Fire play trigger when isPlaying becomes true
  useEffect(() => {
    if (!isPlaying || !playInput) return;
    playInput.fire();
  }, [isPlaying, playInput]);

  // Listen for revealComplete event
  const handleRiveEvent = useCallback(
    (event: any) => {
      if (event?.data?.name === 'revealComplete') {
        onComplete?.();
      }
    },
    [onComplete]
  );

  useEffect(() => {
    if (!rive) return;
    rive.on(EventType.RiveEvent, handleRiveEvent);
    return () => {
      rive.off(EventType.RiveEvent, handleRiveEvent);
    };
  }, [rive, handleRiveEvent]);

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20"
      style={{ width, height }}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
