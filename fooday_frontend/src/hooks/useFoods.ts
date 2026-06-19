'use client';

import { useMemo, useSyncExternalStore } from 'react';
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

// Shared store so a newly added dish appears app-wide (Home + Profile) without reload.
const EMPTY: Food[] = [];
let cache: Food[] = EMPTY;
let loaded = false;
let loadingNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load(): Promise<void> {
  loadingNow = true;
  emit();
  const { data, error } = await supabase
    .from('foods')
    .select(COLUMNS)
    .order('id', { ascending: true });
  if (!error) {
    cache = (data ?? []) as unknown as Food[];
    loaded = true;
  }
  loadingNow = false;
  emit();
}

/** Re-fetch the catalog and notify all consumers (call after adding a dish). */
export function refreshFoods(): Promise<void> {
  return load();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  if (!loaded && !loadingNow) load();
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): Food[] {
  return cache;
}

function getServerSnapshot(): Food[] {
  return EMPTY;
}

export function useFoods() {
  const foods = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const byId = useMemo(() => {
    const map: Record<number, Food> = {};
    for (const f of foods) map[f.id] = f;
    return map;
  }, [foods]);
  return { foods, byId, loading: !loaded, refresh: refreshFoods };
}
