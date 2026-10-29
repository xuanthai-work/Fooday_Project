// Popularity score for the Home feed's "Phổ biến" order.
//
// A plain rating average lets a place with a single 5★ review outrank a place
// with hundreds of 4.8★ reviews. The score below is a Bayesian (weighted)
// average: the fewer reviews a dish has, the closer its score is pulled to the
// catalog-wide prior, so both the rating *and* the number of reviews matter.

/** Typical rating used until a dish has enough reviews of its own. */
export const POPULAR_PRIOR = 4.2;

/** How many "virtual" reviews at the prior rating every dish starts with. */
export const POPULAR_WEIGHT = 5;

/**
 * Weighted rating: high scores need many good reviews, not just one.
 *
 * A dish without customer reviews still counts as one review at its catalog
 * rating, so the seeded score is damped instead of being ignored — and never
 * promoted above a place with real, plentiful reviews.
 */
export function popularityScore(
  average: number,
  count: number,
  prior = POPULAR_PRIOR,
  weight = POPULAR_WEIGHT,
): number {
  const hasRating = Number.isFinite(average) && average > 0;
  const rating = hasRating ? average : prior;
  const realReviews = Number.isFinite(count) && count > 0 ? count : 0;
  const reviews = realReviews > 0 ? realReviews : hasRating ? 1 : 0;
  return (rating * reviews + prior * weight) / (reviews + weight);
}
