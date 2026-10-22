'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type FoodCategory = 'Foods' | 'Drinks' | 'Snacks';

/** The real dish categories (used by the Add Dish form). */
export const FOOD_CATEGORIES: FoodCategory[] = ['Foods', 'Drinks', 'Snacks'];

/** A category filter, including the "All" pseudo-category used by browse views. */
export type CategoryFilter = 'All' | FoodCategory;

/** Filter chips for browsing: "All" plus every real category. */
export const CATEGORY_FILTERS: CategoryFilter[] = ['All', ...FOOD_CATEGORIES];

/** A single outlet of a restaurant. The first one is the main branch. */
export interface Branch {
  id?: string;
  name?: string; // Ví dụ: "Cơ sở Cầu Giấy"
  address: string; // "13 Lò Đúc, Q. Hai Bà Trưng, Hà Nội"
  google_map_url?: string; // Link Google Maps
  lat?: number | null; // Vĩ độ (bóc tách từ link Google Maps)
  lng?: number | null; // Kinh độ (bóc tách từ link Google Maps)
}

/** Someone who helped build a dish (the creator lives in `created_by`). */
export interface Contributor {
  id: string;
  name: string;
  avatar_url?: string;
  updated_at?: string;
}

export interface Food {
  id: number;
  slug: string;
  name: string;
  category: FoodCategory;
  restaurant: string;
  rating: number;
  image_url: string;
  images?: string[] | null;
  tag: string | null;
  address?: string | null;
  google_map_url?: string | null;
  opening_time?: string | null;
  review_note?: string | null;
  created_by: string | null;
  /** Extra outlets of the restaurant (stored as a jsonb array). */
  branches?: Branch[] | null;
  /** Everyone who edited the dish besides its creator (stored as a jsonb array). */
  contributors?: Contributor[] | null;
}

const COLUMNS =
  'id, slug, name, category, restaurant, rating, image_url, images, tag, address, google_map_url, opening_time, review_note, created_by, branches, contributors';

/** Same list without the optional `contributors` column. */
const COLUMNS_WITHOUT_CONTRIBUTORS =
  'id, slug, name, category, restaurant, rating, image_url, images, tag, address, google_map_url, opening_time, review_note, created_by, branches';

/** Same list without the optional `branches` / `contributors` columns. */
const COLUMNS_WITHOUT_BRANCHES =
  'id, slug, name, category, restaurant, rating, image_url, images, tag, address, google_map_url, opening_time, review_note, created_by';

/** Normalise the `contributors` jsonb column into a clean array. */
export function parseContributors(value: unknown): Contributor[] {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object',
    )
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : String(item.id ?? ''),
      name: typeof item.name === 'string' ? item.name : '',
      avatar_url:
        typeof item.avatar_url === 'string' ? item.avatar_url : undefined,
      updated_at:
        typeof item.updated_at === 'string' ? item.updated_at : undefined,
    }))
    .filter((item) => Boolean(item.id));
}

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
  const primary = await supabase
    .from('foods')
    .select(COLUMNS)
    .order('id', { ascending: true });

  let data: unknown = primary.data;
  let error = primary.error;

  if (error) {
    // The `contributors` column may not be migrated yet — retry without it.
    console.warn(
      '[useFoods] could not read the "contributors" column, retrying without it:',
      error.message,
    );
    const fallback = await supabase
      .from('foods')
      .select(COLUMNS_WITHOUT_CONTRIBUTORS)
      .order('id', { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    // The `branches` column may not be migrated yet either — keep the catalog
    // alive instead of showing an empty feed.
    console.warn(
      '[useFoods] could not read the "branches" column, retrying without it:',
      error.message,
    );
    const fallback = await supabase
      .from('foods')
      .select(COLUMNS_WITHOUT_BRANCHES)
      .order('id', { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (!error) {
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    cache = rows.map((row) => ({
      ...row,
      contributors: parseContributors(row.contributors),
    })) as unknown as Food[];
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
