// Review photos live in the single `reviews.image_url` text column, so one
// review can carry several pictures:
//   - 1 photo  -> plain URL string
//   - 2+ photos -> JSON array string: ["url1", "url2", ...]
// This module is the single place that knows how to read and write that
// format, so the composer, the gallery and the reward-points formula all
// agree on the same encoding.

/** How many photos a single review may carry. */
export const MAX_REVIEW_PHOTOS = 5;

/** Points granted for a review, before the photo bonus. */
export const REVIEW_POINTS_BASE = 5;

/** Read the photos of a review out of `reviews.image_url`. */
export function parseReviewPhotos(imageUrl: string | null | undefined): string[] {
  const raw = (imageUrl ?? '').trim();
  if (!raw) return [];

  if (raw.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === 'string' && item.trim() !== '',
        );
      }
    } catch {
      // Malformed JSON — fall through and treat the raw value as a plain URL.
    }
  }

  if (raw.includes(',')) {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [raw];
}

/** Serialize the photos of a review for the `image_url` column. */
export function serializeReviewPhotos(photos: string[]): string | null {
  const cleaned = photos.map((photo) => photo.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  if (cleaned.length === 1) return cleaned[0];
  return JSON.stringify(cleaned);
}

/**
 * Reward points a single review is worth.
 *   0 photos -> 5
 *   1 photo  -> 5 + 3 = 8
 *   2 photos -> 5 + 5 = 10
 *   N photos -> 5 + 5 + (N - 2)
 */
export function calculateReviewPoints(imageUrl: string | null | undefined): number {
  const count = parseReviewPhotos(imageUrl).length;
  const photoBonus = count === 0 ? 0 : count === 1 ? 3 : 5 + (count - 2);
  return REVIEW_POINTS_BASE + photoBonus;
}
