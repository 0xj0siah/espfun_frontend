import { useEffect, useState, useRef, useCallback } from 'react';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';
import { TIER_TO_RIVE_INDEX } from '../constants';

interface RiveFoilIdleProps {
  tier: string;
  riveBuffer: ArrayBuffer | null;
  onMouseMove?: (e: React.MouseEvent) => void;
}

export function RiveFoilIdle({ tier, riveBuffer }: RiveFoilIdleProps) {
  const [riveFailed, setRiveFailed] = useState(!riveBuffer);
  const containerRef = useRef<HTMLDivElement>(null);

  if (riveFailed || !riveBuffer) {
    return null; // CSS shimmer-sweep fallback stays in parent
  }

  return (
    <RiveFoilIdleInner
      tier={tier}
      riveBuffer={riveBuffer}
      containerRef={containerRef}
      onError={() => setRiveFailed(true)}
    />
  );
}

function RiveFoilIdleInner({
  tier,
  riveBuffer,
  containerRef,
  onError,
}: {
  tier: string;
  riveBuffer: ArrayBuffer;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onError: () => void;
}) {
  const { rive, RiveComponent } = useRive({
    buffer: riveBuffer,
    artboard: 'PackFoilIdle',
    stateMachines: 'FoilIdleSM',
    autoplay: true,
    shouldResizeCanvasToContainer: true,
    onLoadError: onError,
  });

  const tierInput = useStateMachineInput(rive, 'FoilIdleSM', 'tier');
  const lightAngleXInput = useStateMachineInput(rive, 'FoilIdleSM', 'lightAngleX');
  const lightAngleYInput = useStateMachineInput(rive, 'FoilIdleSM', 'lightAngleY');
  const hoverInput = useStateMachineInput(rive, 'FoilIdleSM', 'hover');

  // Set tier once
  useEffect(() => {
    if (!tierInput) return;
    tierInput.value = TIER_TO_RIVE_INDEX[tier] ?? 0;
  }, [tierInput, tier]);

  // Mouse tracking for foil light response
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current || !lightAngleXInput || !lightAngleYInput) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      lightAngleXInput.value = Math.max(0, Math.min(100, x));
      lightAngleYInput.value = Math.max(0, Math.min(100, y));
    },
    [containerRef, lightAngleXInput, lightAngleYInput]
  );

  const handleMouseEnter = useCallback(() => {
    if (hoverInput) hoverInput.value = true;
  }, [hoverInput]);

  const handleMouseLeave = useCallback(() => {
    if (hoverInput) hoverInput.value = false;
  }, [hoverInput]);

  // Attach listeners to parent container
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseEnter, handleMouseLeave]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ mixBlendMode: 'screen' }}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
