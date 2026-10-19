'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { translations, type Language, type Translation } from './translations';

interface LanguageContextValue {
  /** Active language code. */
  lang: Language;
  /** Switch language and persist the choice to localStorage. */
  setLang: (lang: Language) => void;
  /** Translation dictionary for the active language. */
  t: Translation;
}

const STORAGE_KEY = 'fooday-lang';
const LANG_EVENT = 'fooday-lang-change';

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'vi',
  setLang: () => {},
  t: translations.vi,
});

function subscribe(callback: () => void): () => void {
  window.addEventListener(LANG_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(LANG_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getSnapshot(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {
    /* storage may be unavailable */
  }
  return 'vi';
}

function getServerSnapshot(): Language {
  // Server (and first hydration) always renders Vietnamese, keeping markup stable.
  return 'vi';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable */
    }
    window.dispatchEvent(new Event(LANG_EVENT));
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t: translations[lang] }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Access the active language and its translation dictionary. */
export const useTranslation = () => useContext(LanguageContext);
