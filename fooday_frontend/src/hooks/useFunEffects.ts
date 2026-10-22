'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'fooday-fun-effects';
const CHANGE_EVENT = 'fooday-fun-effects-change';

let cache: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (cache !== null) return cache;
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  cache = raw === null ? true : raw === '1';
  return cache;
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): boolean {
  return read();
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * Whether celebratory effects (emoji rain) are enabled.
 * Persisted in localStorage and shared across the app.
 */
export function useFunEffects() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setEnabled = useCallback((value: boolean) => {
    cache = value;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
    emit();
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!read());
  }, [setEnabled]);

  return { enabled, setEnabled, toggle };
}
