'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';
import { useTranslation } from '@/i18n/LanguageContext';
import { refreshReviewStats } from './useReviewStats';
import { refreshFoods } from './useFoods';
import { serializeReviewPhotos } from '@/lib/reviewPhotos';

export interface Review {
  id: number;
  food_id: number;
  user_id: string | null;
  user_name: string;
  rating: number;
  comment: string;
  image_url: string | null;
  /** Snapshot of the reviewer's avatar when the review was posted. */
  avatar_url: string | null;
  created_at: string;
}

export type ReviewPostResult = 'ok' | 'empty' | 'cooldown' | 'failed';

const COLUMNS =
  'id, food_id, user_id, user_name, rating, comment, image_url, avatar_url, created_at';
/** Older DBs without the optional `avatar_url` column. */
const COLUMNS_WITHOUT_AVATAR =
  'id, food_id, user_id, user_name, rating, comment, image_url, created_at';
/** Older DBs without the optional `image_url` column either. */
const COLUMNS_BASE = 'id, food_id, user_id, user_name, rating, comment, created_at';

export const REVIEW_COOLDOWN_DAYS = 45;

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** When the current account may review this place again, or null if they can now. */
export function cooldownUntil(reviews: Review[], userId: string | null, extraAt?: string | null): Date | null {
  if (!userId) return null;
  const stamps = reviews
    .filter((review) => review.user_id === userId && review.id > 0)
    .map((review) => review.created_at);
  if (extraAt) stamps.push(extraAt);
  if (stamps.length === 0) return null;
  const latest = stamps.reduce((a, b) => (a > b ? a : b));
  const until = addDays(new Date(latest), REVIEW_COOLDOWN_DAYS);
  return until.getTime() > Date.now() ? until : null;
}

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
  const [limitAt, setLimitAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      type Loaded = { data: unknown; error: { message: string } | null };
      let result: Loaded = await supabase
        .from('reviews')
        .select(COLUMNS)
        .eq('food_id', foodId)
        .order('created_at', { ascending: false });
      if (result.error && /avatar_url/i.test(result.error.message)) {
        const attempt = await supabase
          .from('reviews')
          .select(COLUMNS_WITHOUT_AVATAR)
          .eq('food_id', foodId)
          .order('created_at', { ascending: false });
        result = { data: attempt.data, error: attempt.error };
      }
      if (result.error) {
        const attempt = await supabase
          .from('reviews')
          .select(COLUMNS_BASE)
          .eq('food_id', foodId)
          .order('created_at', { ascending: false });
        result = { data: attempt.data, error: attempt.error };
      }
      if (!active) return;
      if (!result.error) {
        const rows = (result.data ?? []) as Array<Partial<Review> & Record<string, unknown>>;
        setReviews(
          rows.map((row) => ({
            ...(row as Review),
            image_url: typeof row.image_url === 'string' ? row.image_url : null,
            avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
          })),
        );
      }
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

  useEffect(() => {
    const id = user?.id;
    if (!id) return;
    let active = true;
    supabase
      .from('review_limits')
      .select('reviewed_at')
      .eq('food_id', foodId)
      .eq('user_id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setLimitAt(data?.reviewed_at ?? null);
      });
    return () => {
      active = false;
    };
  }, [foodId, user?.id, reviews.length]);

  const blockedUntil = cooldownUntil(reviews, user?.id ?? null, limitAt);

  const addReview = useCallback(
    async (
      rating: number,
      comment: string,
      imageUrl?: string | string[] | null,
    ): Promise<ReviewPostResult> => {
      const text = comment.trim();
      if (!text) return 'empty';
      if (cooldownUntil(reviews, user?.id ?? null, limitAt)) return 'cooldown';

      // One photo -> plain URL, several -> JSON array in the same column.
      const photos = Array.isArray(imageUrl) ? imageUrl : imageUrl ? [imageUrl] : [];
      const serialized = serializeReviewPhotos(photos);

      const userName = user?.email ? user.email.split('@')[0] : t.reviews.guestName;
      const avatarUrl =
        (user?.user_metadata?.avatar_url as string | undefined)?.trim() || null;
      const tempId = -Date.now();
      const optimistic: Review = {
        id: tempId,
        food_id: foodId,
        user_id: user?.id ?? null,
        user_name: userName,
        rating,
        comment: text,
        image_url: serialized,
        avatar_url: avatarUrl,
        created_at: new Date().toISOString(),
      };

      // optimistic update; Realtime reconciles afterwards
      setReviews((prev) => [optimistic, ...prev]);

      let payload: Record<string, unknown> = {
        food_id: foodId,
        user_name: userName,
        rating,
        comment: text,
      };
      if (serialized) payload.image_url = serialized;
      if (avatarUrl) payload.avatar_url = avatarUrl;

      let inserted = await supabase.from('reviews').insert(payload).select(COLUMNS).single();
      if (inserted.error && avatarUrl && /avatar_url/i.test(inserted.error.message)) {
        // `avatar_url` is not migrated yet — post without the snapshot.
        const withoutAvatar = { ...payload };
        delete withoutAvatar.avatar_url;
        payload = withoutAvatar;
        inserted = await supabase
          .from('reviews')
          .insert(payload)
          .select(COLUMNS_WITHOUT_AVATAR)
          .single();
      }
      if (
        inserted.error &&
        !serialized &&
        !inserted.error.message.includes('review_cooldown') &&
        /image_url/i.test(inserted.error.message)
      ) {
        // Database has not been migrated yet; post the text review without the photo column.
        const withoutImage = { ...payload };
        delete withoutImage.image_url;
        payload = withoutImage;
        inserted = await supabase.from('reviews').insert(payload).select(COLUMNS_BASE).single();
      }

      if (inserted.error || !inserted.data) {
        setReviews((prev) => prev.filter((r) => r.id !== tempId));
        if (inserted.error?.message.includes('review_cooldown')) return 'cooldown';
        return 'failed';
      }

      const row = inserted.data as Review;
      const saved: Review = {
        ...row,
        image_url: row.image_url ?? serialized,
        avatar_url: row.avatar_url ?? avatarUrl,
      };
      setReviews((prev) => prev.map((r) => (r.id === tempId ? saved : r)));
      setLimitAt(saved.created_at);
      void refreshReviewStats();
      // The database trigger rewrites foods.rating, so pull the new catalog value.
      void refreshFoods();
      return 'ok';
    },
    [foodId, user, t, reviews, limitAt],
  );

  const deleteReview = useCallback(async (id: number) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    await supabase.from('reviews').delete().eq('id', id);
    void refreshReviewStats();
    void refreshFoods();
  }, []);

  const totalCount = reviews.length;
  const averageRating = totalCount
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalCount
    : 0;

  return { reviews, loading, addReview, deleteReview, totalCount, averageRating, blockedUntil };
}
