'use client';

import { useSyncExternalStore } from 'react';

/**
 * Favorites persisted to localStorage, exposed as an external store so any
 * component can read/mutate it reactively without prop-threading — and without
 * setState-in-effect. The snapshot reference is cached so useSyncExternalStore
 * stays stable between renders.
 */
const KEY = 'fooday_favorites';
const EMPTY: string[] = [];

let cache: string[] = EMPTY;
let cacheRaw: string | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (typeof window === 'undefined') return EMPTY;
  const raw = localStorage.getItem(KEY);
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    cache = raw ? (JSON.parse(raw) as string[]) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

export function toggleFavorite(name: string): void {
  const current = read();
  const next = current.includes(name)
    ? current.filter((n) => n !== name)
    : [...current, name];
  const raw = JSON.stringify(next);
  localStorage.setItem(KEY, raw);
  cache = next;
  cacheRaw = raw;
  listeners.forEach((l) => l());
}

export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
