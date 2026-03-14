import { useEffect, useCallback, useState } from 'react';
import { useRive, useStateMachineInput, EventType } from '@rive-app/react-canvas';
import { PackRipAnimation } from './PackRipAnimation';
import { TIER_TO_RIVE_INDEX } from '../constants';

interface RivePackOpenProps {
  packTier: string;
  onComplete: () => void;
  onRipStart?: () => void;
  onBurst?: () => void;
  riveBuffer: ArrayBuffer | null;
}

export function RivePackOpen({
  packTier,
  onComplete,
  onRipStart,
  onBurst,
  riveBuffer,
}: RivePackOpenProps) {
  const [riveFailed, setRiveFailed] = useState(!riveBuffer);

  // Pass null to useRive when no buffer — skips initialization entirely
  const { rive, RiveComponent } = useRive(
    riveBuffer
      ? {
          buffer: riveBuffer,
          artboard: 'PackOpen',
          stateMachines: 'PackOpenSM',
          autoplay: true,
          shouldResizeCanvasToContainer: true,
          onLoadError: () => setRiveFailed(true),
        }
      : null
  );

  const tierInput = useStateMachineInput(rive, 'PackOpenSM', 'tier');
  const startInput = useStateMachineInput(rive, 'PackOpenSM', 'start');

  // Set tier and fire start trigger once Rive is ready
  useEffect(() => {
    if (!rive || !tierInput || !startInput) return;
    tierInput.value = TIER_TO_RIVE_INDEX[packTier] ?? 0;
    startInput.fire();
  }, [rive, tierInput, startInput, packTier]);

  // Listen for Rive events
  const handleRiveEvent = useCallback(
    (event: any) => {
      const eventName = event?.data?.name;
      if (eventName === 'ripStart') {
        onRipStart?.();
      } else if (eventName === 'burstComplete') {
        onBurst?.();
        onComplete();
      }
    },
    [onComplete, onRipStart, onBurst]
  );

  useEffect(() => {
    if (!rive) return;
    rive.on(EventType.RiveEvent, handleRiveEvent);
    return () => {
      rive.off(EventType.RiveEvent, handleRiveEvent);
    };
  }, [rive, handleRiveEvent]);

  // Fallback to enhanced PackRipAnimation if Rive isn't available
  if (riveFailed || !riveBuffer) {
    return <PackRipAnimation packTier={packTier} onComplete={onComplete} />;
  }

  return (
    <div className="relative" style={{ width: 240, height: 340 }}>
      <RiveComponent
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
