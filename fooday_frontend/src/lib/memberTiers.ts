// Membership tiers, Shopee style with a local meme twist.
//
// The profile already awards reward points for activity (favorites, added
// dishes and reviews), so the tier is derived from that number instead of
// storing an extra column in the database. Bump the thresholds here if the
// point economy changes.

export type MemberTierId =
  | 'da-boc-xuong'
  | 'kho-det'
  | 'bim-50kg'
  | 'sau-mui'
  | 'chupy'
  | 'mup-rup'
  | 'trong-ba'
  | 'dop-vuong';

export interface MemberTier {
  id: MemberTierId;
  /** Minimum points needed to reach this tier. */
  min: number;
  /** Top tiers get an animated glow around the badge and medal. */
  aura?: boolean;
}

/**
 * Ordered from the lowest tier to the highest.
 * Adding a dish alone is worth 25 points, so the gaps are deliberately wide:
 * the higher tiers should take real activity, not a couple of uploads.
 */
export const MEMBER_TIERS: MemberTier[] = [
  { id: 'da-boc-xuong', min: 0 },
  { id: 'kho-det', min: 500 },
  { id: 'bim-50kg', min: 1500 },
  { id: 'sau-mui', min: 3000 },
  { id: 'chupy', min: 6000 },
  { id: 'mup-rup', min: 10000, aura: true },
  { id: 'trong-ba', min: 18000, aura: true },
  { id: 'dop-vuong', min: 30000, aura: true },
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
