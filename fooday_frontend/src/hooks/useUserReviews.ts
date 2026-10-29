'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface UserReviewRow {
  id: number;
  food_id: number;
  rating: number;
  comment: string;
  image_url: string | null;
  created_at: string;
}

const COLUMNS = 'id, food_id, rating, comment, image_url, created_at';
/** Same list for databases where `image_url` has not been migrated yet. */
const COLUMNS_BASE = 'id, food_id, rating, comment, created_at';

/**
 * The reviews written by one account. Used by the profile page to compute
 * the reward points and to list the review history, so it follows the reviews
 * table in realtime and refreshes as soon as a review is posted or removed.
 */
export function useUserReviews(userId: string | null) {
  const [reviews, setReviews] = useState<UserReviewRow[]>([]);

  useEffect(() => {
    let active = true;
    const id = userId;

    const load = async () => {
      if (!id) return;
      const full = await supabase
        .from('reviews')
        .select(COLUMNS)
        .eq('user_id', id)
        .order('created_at', { ascending: false });
      const result = full.error
        ? await supabase
            .from('reviews')
            .select(COLUMNS_BASE)
            .eq('user_id', id)
            .order('created_at', { ascending: false })
        : full;
      if (!active || result.error) return;
      const rows = (result.data ?? []) as Array<Partial<UserReviewRow> & Record<string, unknown>>;
      setReviews(
        rows.map((row) => ({
          ...(row as UserReviewRow),
          image_url: typeof row.image_url === 'string' ? row.image_url : null,
        })),
      );
    };

    // Defer the initial load out of the effect body (no sync setState in effect).
    const timer = setTimeout(load, 0);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (id) {
      channel = supabase
        .channel(`reviews:user_id=eq.${id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'reviews', filter: `user_id=eq.${id}` },
          () => {
            void load();
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

  // Without an account there is nothing to show — reset on sign out.
  if (!userId) return [];

  return reviews;
}
