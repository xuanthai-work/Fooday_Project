'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FoodCategory } from '@/hooks/useFoods';
import { buildBurst, type RainIntensity, type RainParticle } from '@/lib/emojiRain';

export interface RainBurst {
  id: number;
  intensity: RainIntensity;
  particles: RainParticle[];
}

/** How long a burst stays mounted before it is dropped from the DOM. */
const TTL: Record<RainIntensity, number> = {
  chat: 2600,
  mini: 1600,
  full: 6000,
};

export function useEmojiRain() {
  const [bursts, setBursts] = useState<RainBurst[]>([]);
  const seqRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current) clearTimeout(timer);
      timersRef.current = [];
    },
    [],
  );

  /** Fire a burst of emoji for the given dish categories. */
  const trigger = useCallback(
    (categories: FoodCategory[], intensity: RainIntensity = 'chat') => {
      seqRef.current += 1;
      const id = seqRef.current;
      const particles = buildBurst(categories, intensity);
      // Keep at most the three most recent bursts alive.
      setBursts((prev) => [...prev.slice(-2), { id, intensity, particles }]);

      const timer = setTimeout(() => {
        setBursts((prev) => prev.filter((burst) => burst.id !== id));
        timersRef.current = timersRef.current.filter((item) => item !== timer);
      }, TTL[intensity]);
      timersRef.current.push(timer);
    },
    [],
  );

  return { bursts, trigger };
}
