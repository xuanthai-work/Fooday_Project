'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';
import AuthPromptModal from '@/components/AuthPromptModal';

interface FavoritesContextValue {
  /** Set of favorited food ids for the current user. */
  favorites: Set<number>;
  /** Optimistically add/remove a favorite and persist it to Supabase. */
  toggleFavorite: (foodId: number) => Promise<void>;
  /** True once the initial favorites load has settled for the active session. */
  ready: boolean;
  /** True while the "sign in to save favorites" prompt is open. */
  showAuthPrompt: boolean;
  /** Open or close the sign-in prompt. */
  setShowAuthPrompt: (open: boolean) => void;
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favorites: new Set(),
  toggleFavorite: async () => {},
  ready: false,
  showAuthPrompt: false,
  setShowAuthPrompt: () => {},
});

/**
 * Favorites stored in Supabase (keyed by food_id, scoped to the user via RLS).
 * Owns the single Realtime subscription for the whole app so any number of
 * consumers — HomeView, RandomView, ProfileView, ChatView, DishDetailModal —
 * share one channel instead of each creating (and fighting over) the same
 * `favorites:<user_id>` topic.
 */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  // A guest session (anonymous user, or an account without an email) cannot
  // own favorites — it is asked to sign in instead.
  const isGuest = !user || Boolean(user.is_anonymous) || !user.email;

  // Latest favorites for toggleFavorite without re-creating the callback.
  const favoritesRef = useRef(favorites);
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  useEffect(() => {
    let active = true;
    const id = userId;

    const load = async () => {
      if (!active) return;
      if (!id || isGuest) {
        // Guests have no favorites of their own — nothing to load.
        setFavorites(new Set());
        setReady(true);
        return;
      }
      const { data, error } = await supabase
        .from('favorites')
        .select('food_id')
        .eq('user_id', id);
      if (!active) return;
      if (!error) {
        setFavorites(new Set((data ?? []).map((r) => r.food_id as number)));
      }
      setReady(true);
    };

    // Defer the initial load out of the effect body (no sync setState in effect).
    const timer = setTimeout(load, 0);

    // Exactly one Realtime channel per user session, owned here.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (id && !isGuest) {
      channel = supabase
        .channel(`favorites:${id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${id}` },
          () => {
            load();
          },
        )
        .subscribe();
    }

    return () => {
      active = false;
      clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, isGuest]);

  const toggleFavorite = useCallback(
    async (foodId: number) => {
      if (!userId || isGuest) {
        // Guests never touch the favorites table — they get asked to sign in.
        setShowAuthPrompt(true);
        return;
      }
      const isFav = favoritesRef.current.has(foodId);

      // optimistic update; Realtime reconciles afterwards
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(foodId);
        else next.add(foodId);
        return next;
      });

      if (isFav) {
        await supabase.from('favorites').delete().eq('user_id', userId).eq('food_id', foodId);
      } else {
        // user_id defaults to auth.uid() server-side
        await supabase.from('favorites').insert({ food_id: foodId });
      }
    },
    [userId, isGuest],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({ favorites, toggleFavorite, ready, showAuthPrompt, setShowAuthPrompt }),
    [favorites, toggleFavorite, ready, showAuthPrompt],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
    </FavoritesContext.Provider>
  );
}

/** Access the shared favorites store (must be under FavoritesProvider). */
export const useFavorites = () => useContext(FavoritesContext);
