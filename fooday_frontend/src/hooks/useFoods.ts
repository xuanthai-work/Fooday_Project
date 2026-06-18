'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type FoodCategory = 'Foods' | 'Drinks' | 'Snacks';

export interface Food {
  id: number;
  slug: string;
  name: string;
  category: FoodCategory;
  restaurant: string;
  rating: number;
  image_url: string;
  tag: string | null;
}

const COLUMNS = 'id, slug, name, category, restaurant, rating, image_url, tag';

// Module-level cache so switching tabs doesn't refetch the catalog.
let cache: Food[] | null = null;
let inflight: Promise<Food[]> | null = null;

function loadFoods(): Promise<Food[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = (async () => {
      const { data, error } = await supabase
        .from('foods')
        .select(COLUMNS)
        .order('id', { ascending: true });
      if (error) throw error;
      cache = (data ?? []) as unknown as Food[];
      return cache;
    })();
  }
  return inflight;
}

export function useFoods() {
  const [foods, setFoods] = useState<Food[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return; // already seeded from cache via initial state
    let active = true;
    loadFoods()
      .then((data) => {
        if (active) {
          setFoods(data);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setError(e instanceof Error ? e.message : 'Failed to load dishes.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const byId = useMemo(() => {
    const map: Record<number, Food> = {};
    for (const f of foods) map[f.id] = f;
    return map;
  }, [foods]);

  return { foods, byId, loading, error };
}
