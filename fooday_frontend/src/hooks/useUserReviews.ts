'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface UserReviewRow {
  id: number;
  image_url: string | null;
}

/**
 * The reviews written by one account. Used by the profile page to compute
 * the reward points, so it follows the reviews table in realtime and the
 * points update as soon as a review is posted or removed.
 */
export function useUserReviews(userId: string | null) {
  const [reviews, setReviews] = useState<UserReviewRow[]>([]);

  useEffect(() => {
    let active = true;
    const id = userId;

    const load = async () => {
      if (!id) return;
      const { data } = await supabase
        .from('reviews')
        .select('id, image_url')
        .eq('user_id', id);
      if (!active) return;
      setReviews((data ?? []) as UserReviewRow[]);
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
