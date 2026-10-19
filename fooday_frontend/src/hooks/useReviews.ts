'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';
import { useTranslation } from '@/i18n/LanguageContext';

export interface Review {
  id: number;
  food_id: number;
  user_id: string | null;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

const COLUMNS = 'id, food_id, user_id, user_name, rating, comment, created_at';

/**
 * Reviews for a single dish: fetch + Realtime sync + optimistic posting.
 * Only DishDetailModal consumes this (one food at a time), so it owns its
 * `reviews:food_id=eq.<id>` channel and cleans it up on unmount.
 */
export function useReviews(foodId: number) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(COLUMNS)
        .eq('food_id', foodId)
        .order('created_at', { ascending: false });
      if (!active) return;
      if (!error) setReviews((data ?? []) as Review[]);
      setLoading(false);
    };

    // Defer the initial load out of the effect body (no sync setState in effect).
    const timer = setTimeout(load, 0);

    const channel = supabase
      .channel(`reviews:food_id=eq.${foodId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reviews', filter: `food_id=eq.${foodId}` },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      active = false;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [foodId]);

  const addReview = useCallback(
    async (rating: number, comment: string) => {
      const text = comment.trim();
      if (!text) return;

      const userName = user?.email ? user.email.split('@')[0] : t.reviews.guestName;
      const tempId = -Date.now();
      const optimistic: Review = {
        id: tempId,
        food_id: foodId,
        user_id: user?.id ?? null,
        user_name: userName,
        rating,
        comment: text,
        created_at: new Date().toISOString(),
      };

      // optimistic update; Realtime reconciles afterwards
      setReviews((prev) => [optimistic, ...prev]);

      const { data, error } = await supabase
        .from('reviews')
        .insert({ food_id: foodId, user_name: userName, rating, comment: text })
        .select(COLUMNS)
        .single();

      if (error) {
        // roll back the optimistic entry on failure
        setReviews((prev) => prev.filter((r) => r.id !== tempId));
        return;
      }

      setReviews((prev) =>
        prev.map((r) => (r.id === tempId ? ((data as Review) ?? r) : r)),
      );
    },
    [foodId, user, t],
  );

  const deleteReview = useCallback(async (id: number) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    await supabase.from('reviews').delete().eq('id', id);
  }, []);

  const totalCount = reviews.length;
  const averageRating = totalCount
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalCount
    : 0;

  return { reviews, loading, addReview, deleteReview, totalCount, averageRating };
}
