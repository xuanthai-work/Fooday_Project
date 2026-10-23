// Smart chain detection: recognise when a pasted Google Maps place belongs to
// a restaurant / brand that is already in the catalog, so the new outlet can
// be merged into the existing `branches` list instead of fragmenting the data.

import { stripVietnameseAccents } from '@/lib/hashtags';
import { extractPlaceId, mapsLinksMatch } from '@/lib/maps';
import { getAllBranches, parseBranches } from '@/lib/geo';
import type { Food } from '@/hooks/useFoods';

/** A successful brand lookup against the current catalog. */
export interface BrandMatch {
  /** Display name of the matched restaurant (as stored in the catalog). */
  targetRestaurant: string;
  /** The catalog row that carries the shared data of that restaurant. */
  representativeFood: Food;
  /** Every dish row that belongs to the same restaurant. */
  dishes: Food[];
}

/** The draft of the branch the user is about to merge. */
export interface BranchDraftInfo {
  name: string;
  address: string;
  google_map_url: string;
  lat: number | null;
  lng: number | null;
}

/** Branch/location markers that never belong to the brand name itself. */
const BRANCH_MARKERS =
  /(?:\b|^)(?:co so|chi nhanh|cs\.?|cn\.?|quan|duong|tang|kios?|floor)\b/;

/** A dash segment that opens a branch note: ` - Cơ sở 3`, ` - Quận 7`, ... */
const DASH_BRANCH_TAIL =
  /[-–—|]\s*(?:co so|chi nhanh|cs\.?(?![a-z])|cn\.?(?![a-z])|quan\s?\S+|q\.?\s?\d|duong\s?\S*|tang\s?\d+|kios?|floor)[^-–—|]*$/i;

/**
 * Standardise a free-text restaurant name for brand comparison:
 * lowercase + Vietnamese accents removed, common branch suffixes
 * (`- Cơ sở 3`, `(Chi nhánh Bình Thạnh)`, `- Quận 7`, `- Đường ...`)
 * and common prefixes (`quán`, `tiệm`, `nhà hàng`, `cửa hàng`) stripped.
 */
export function normalizeBrandName(raw: string): string {
  let text = stripVietnameseAccents(String(raw ?? '')).toLowerCase();

  // Drop every parenthesised note (branch, district, ward, ...): "(Cơ sở 2)".
  for (let guard = 0; guard < 4; guard += 1) {
    const next = text.replace(/\([^()]*\)/g, ' ');
    if (next === text) break;
    text = next;
  }

  // Cut everything after a dash that opens a branch marker:
  // "- Cơ sở 3", "- Chi nhánh Bình Thạnh", "- CS 2", "- CN Q.7".
  for (let guard = 0; guard < 3; guard += 1) {
    const next = text.replace(DASH_BRANCH_TAIL, ' ');
    if (next === text) break;
    text = next;
  }

  // Repeatedly peel common business prefixes off the front.
  for (let guard = 0; guard < 3; guard += 1) {
    const next = text.replace(/^(?:quan|tiem|nha hang|cua hang)\s+/i, '');
    if (next === text) break;
    text = next;
  }

  return text
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Similarity score between two normalized brand names (0 = no match). */
function brandScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.length >= 4 && a.includes(b)) return 50 + b.length;
  if (a.length >= 4 && b.includes(a)) return 40 + a.length;
  return 0;
}

/**
 * Look the given (raw) restaurant name up in the catalog. The "restaurant"
 * identity of a dish is its `restaurant` field; when that is empty the dish
 * name stands in. Returns the matched brand plus every dish of that brand.
 */
export function findBrandMatch(rawName: string, foods: Food[]): BrandMatch | null {
  const target = normalizeBrandName(rawName);
  if (target.length < 2) return null;

  let bestScore = 0;
  let bestKey = '';
  for (const food of foods) {
    const raw = (food.restaurant || '').trim() || (food.name || '').trim();
    const brand = normalizeBrandName(raw);
    const score = brandScore(target, brand);
    if (score > bestScore) {
      bestScore = score;
      bestKey = brand;
    }
  }
  if (bestScore < 50) return null;

  // Group every dish that carries the same normalized brand name.
  const dishes = foods.filter((food) => {
    const raw = (food.restaurant || '').trim() || (food.name || '').trim();
    return normalizeBrandName(raw) === bestKey;
  });
  if (dishes.length === 0) return null;

  // Prefer the row that already knows the most about the outlets.
  const representativeFood = dishes.reduce((best, dish) => {
    if (parseBranches(dish.branches).length > parseBranches(best.branches).length) {
      return dish;
    }
    return best;
  }, dishes[0]);

  return {
    targetRestaurant:
      (representativeFood.restaurant || '').trim() ||
      representativeFood.name ||
      target,
    representativeFood,
    dishes,
  };
}

/** Lower-cased, unaccented, punctuation-free key for address comparison. */
function addressKey(value: string | null | undefined): string {
  return stripVietnameseAccents(String(value ?? ''))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * True when the pasted place (link / place id / address) is already one of the
 * known outlets of the restaurant — the main address or any `branches` entry.
 */
export function isBranchAlreadyExists(
  newPlaceId: string | null,
  newUrl: string | null,
  newAddress: string | null | undefined,
  existingFood: Food,
): boolean {
  const links = [
    existingFood.google_map_url,
    ...parseBranches(existingFood.branches).map((branch) => branch.google_map_url),
  ];
  for (const link of links) {
    if (!link) continue;
    if (newPlaceId && extractPlaceId(link) === newPlaceId) return true;
    if (newUrl && mapsLinksMatch(link, newUrl)) return true;
    if (
      newPlaceId &&
      link.toLowerCase().includes(newPlaceId)
    ) {
      return true;
    }
  }

  const newKey = addressKey(newAddress);
  if (newKey && newKey.length >= 8) {
    const addresses = [
      existingFood.address,
      ...parseBranches(existingFood.branches).map((branch) => branch.address),
    ];
    for (const address of addresses) {
      const key = addressKey(address);
      if (key && (key === newKey || key.includes(newKey) || newKey.includes(key))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Derive a friendly label for the new outlet. When the pasted name carries a
 * branch suffix (`- Cơ sở 2`, `(Chi nhánh Thủ Đức)`) it is kept as-is;
 * otherwise the outlet is simply numbered `Cơ sở N+1`.
 */
export function suggestBranchName(
  rawName: string,
  existingFood: Food | null,
): string {
  const raw = String(rawName ?? '').trim();

  // A branch note inside parentheses: "(Cơ sở 2)", "(Chi nhánh Thủ Đức)".
  const parenthetical = raw.match(/\(([^()]+)\)/);
  if (
    parenthetical &&
    stripVietnameseAccents(parenthetical[1]).toLowerCase().match(BRANCH_MARKERS)
  ) {
    return parenthetical[1].trim();
  }

  // A branch note after the last dash: "Phở Thìn - Cơ sở 2".
  if (raw.includes('-')) {
    const segments = raw.split(/[-–—]/).map((part) => part.trim());
    const tail = segments[segments.length - 1];
    if (
      tail &&
      stripVietnameseAccents(tail).toLowerCase().match(BRANCH_MARKERS)
    ) {
      return tail;
    }
  }

  const base = existingFood ? getAllBranches(existingFood).length : 0;
  return `Cơ sở ${base + 1}`;
}
