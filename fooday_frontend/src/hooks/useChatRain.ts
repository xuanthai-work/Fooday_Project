'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'fooday-chat-rain-fired';
const CHANGE_EVENT = 'fooday-chat-rain-change';

/** True once the full sprinkle has been shown in this browser tab session. */
function readCelebrated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Session-scoped gate for the chat emoji sprinkle.
 *
 * The first dish mention of a session gets the full sprinkle, every later one
 * only gets the mini version.
 */
export function useChatRain() {
  const celebrated = useSyncExternalStore(subscribe, readCelebrated, getServerSnapshot);

  const markCelebrated = useCallback(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* storage may be unavailable */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { celebrated, markCelebrated };
}
