import { useState, useEffect, useRef } from 'react';
import {
  RIVE_PACK_OPEN_PATH,
  RIVE_CARD_REVEAL_PATH,
  RIVE_FOIL_IDLE_PATH,
} from './constants';

interface RiveAssets {
  packOpenBuffer: ArrayBuffer | null;
  cardRevealBuffer: ArrayBuffer | null;
  foilIdleBuffer: ArrayBuffer | null;
  isLoaded: boolean;
  errors: Record<string, boolean>;
}

async function fetchRiveBuffer(path: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

export function useRiveAssets(): RiveAssets {
  const [assets, setAssets] = useState<RiveAssets>({
    packOpenBuffer: null,
    cardRevealBuffer: null,
    foilIdleBuffer: null,
    isLoaded: false,
    errors: {},
  });
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    Promise.all([
      fetchRiveBuffer(RIVE_PACK_OPEN_PATH),
      fetchRiveBuffer(RIVE_CARD_REVEAL_PATH),
      fetchRiveBuffer(RIVE_FOIL_IDLE_PATH),
    ]).then(([packOpen, cardReveal, foilIdle]) => {
      setAssets({
        packOpenBuffer: packOpen,
        cardRevealBuffer: cardReveal,
        foilIdleBuffer: foilIdle,
        isLoaded: true,
        errors: {
          packOpen: !packOpen,
          cardReveal: !cardReveal,
          foilIdle: !foilIdle,
        },
      });
    });
  }, []);

  return assets;
}
