'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';

/**
 * Favorites stored in Supabase, keyed by food_id and scoped to the signed-in
 * user (RLS). Works for anonymous "guest" sessions too. Subscribes to Realtime
 * so favorites sync live across a user's devices.
 */
export function useFavorites() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  useEffect(() => {
    let active = true;
    const id = userId;

    const load = async () => {
      if (!id) {
        if (active) setFavorites(new Set());
        return;
      }
      const { data, error } = await supabase
        .from('favorites')
        .select('food_id')
        .eq('user_id', id);
      if (active && !error) {
        setFavorites(new Set((data ?? []).map((r) => r.food_id as number)));
      }
    };

    // Defer the initial load out of the effect body (no sync setState in effect).
    const timer = setTimeout(load, 0);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (id) {
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
  }, [userId]);

  const toggleFavorite = useCallback(
    async (foodId: number) => {
      if (!userId) return;
      const isFav = favorites.has(foodId);

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
    [userId, favorites],
  );

  return { favorites, toggleFavorite, ready: userId !== null };
}
