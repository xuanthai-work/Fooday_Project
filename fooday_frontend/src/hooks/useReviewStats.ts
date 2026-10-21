'use client';

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface ReviewStat {
  average: number;
  count: number;
}

const EMPTY: Record<number, ReviewStat> = {};
let cache: Record<number, ReviewStat> = EMPTY;
let loaded = false;
let loadingNow = false;
const listeners = new Set<() => void>();
let channel: ReturnType<typeof supabase.channel> | null = null;

const emit = () => listeners.forEach((listener) => listener());

async function load(): Promise<void> {
  loadingNow = true;
  emit();
  const { data, error } = await supabase.from('reviews').select('food_id, rating');
  if (!error) {
    const next: Record<number, ReviewStat> = {};
    for (const row of data ?? []) {
      const id = row.food_id as number;
      const rating = Number(row.rating);
      const current = next[id] ?? { average: 0, count: 0 };
      const count = current.count + 1;
      next[id] = {
        count,
        average: (current.average * current.count + rating) / count,
      };
    }
    cache = next;
    loaded = true;
  }
  loadingNow = false;
  emit();
}

/** Re-read every review rating. Call after posting or deleting a review. */
export function refreshReviewStats(): Promise<void> {
  return load();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  if (!loaded && !loadingNow) load();
  if (!channel) {
    channel = supabase
      .channel('reviews:stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => {
        load();
      })
      .subscribe();
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
}

function getSnapshot(): Record<number, ReviewStat> {
  return cache;
}

function getServerSnapshot(): Record<number, ReviewStat> {
  return EMPTY;
}

/** Customer average when the place has reviews; otherwise the seeded catalog score. */
export function displayedRating(
  foodId: number,
  seed: number,
  stats: Record<number, ReviewStat>,
): number {
  const row = stats[foodId];
  if (row && row.count > 0) return row.average;
  return Number(seed) || 0;
}

export function useReviewStats() {
  const stats = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ratingOf = (foodId: number, seed = 0) => displayedRating(foodId, seed, stats);
  return { stats, ratingOf, ready: loaded };
}
