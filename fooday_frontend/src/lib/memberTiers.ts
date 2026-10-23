// Membership tiers, Shopee style.
//
// The profile already awards reward points for activity (favorites, added
// dishes and reviews), so the tier is derived from that number instead of
// storing an extra column in the database. Bump the thresholds here if the
// point economy changes.

export type MemberTierId = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface MemberTier {
  id: MemberTierId;
  /** Minimum points needed to reach this tier. */
  min: number;
}

/** Ordered from the lowest tier to the highest. */
export const MEMBER_TIERS: MemberTier[] = [
  { id: 'bronze', min: 0 },
  { id: 'silver', min: 100 },
  { id: 'gold', min: 300 },
  { id: 'diamond', min: 700 },
];

/** Tier that owns the given amount of points (never null). */
export function tierForPoints(points: number): MemberTier {
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0;
  let current = MEMBER_TIERS[0];
  for (const tier of MEMBER_TIERS) {
    if (safe >= tier.min) current = tier;
  }
  return current;
}

/** Next tier up, or null when the member already reached the top tier. */
export function nextTierOf(tier: MemberTier): MemberTier | null {
  const index = MEMBER_TIERS.findIndex((item) => item.id === tier.id);
  return index >= 0 ? MEMBER_TIERS[index + 1] ?? null : null;
}

/** Progress inside the current tier, from 0 to 1. */
export function tierProgress(points: number): number {
  const tier = tierForPoints(points);
  const next = nextTierOf(tier);
  if (!next) return 1;
  const span = next.min - tier.min;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (points - tier.min) / span));
}
