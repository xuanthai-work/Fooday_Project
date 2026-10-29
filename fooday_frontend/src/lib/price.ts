// Price helpers shared by the add/edit forms, the detail sheet and the roulette.
//
// Contributors pick a *range* (five chips) instead of typing a number: it is
// faster, less subjective and still feeds the existing `foods.price` filter
// through a representative value. Real prices, when they exist, come from the
// optional "what did you pay?" field of a review.

export type PriceRangeId =
  | 'under30'
  | 'from30to50'
  | 'from50to100'
  | 'from100to200'
  | 'over200';

export interface PriceRange {
  id: PriceRangeId;
  /** Representative value stored in `foods.price` (VND). */
  value: number;
  /** Inclusive lower bound. */
  min: number;
  /** Exclusive upper bound; null = no limit. */
  max: number | null;
}

export const PRICE_RANGES: PriceRange[] = [
  { id: 'under30', value: 25000, min: 0, max: 30000 },
  { id: 'from30to50', value: 40000, min: 30000, max: 50000 },
  { id: 'from50to100', value: 75000, min: 50000, max: 100000 },
  { id: 'from100to200', value: 150000, min: 100000, max: 200000 },
  { id: 'over200', value: 250000, min: 200000, max: null },
];

const RANGE_BY_ID = new Map(PRICE_RANGES.map((range) => [range.id, range]));

/** Value to store for a chosen range, or null when nothing was chosen. */
export function priceRangeValue(id: PriceRangeId | null | undefined): number | null {
  if (!id) return null;
  return RANGE_BY_ID.get(id)?.value ?? null;
}

/** The range a stored price belongs to (used to preselect the chips when editing). */
export function priceRangeOf(value: number | null | undefined): PriceRangeId | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  for (const range of PRICE_RANGES) {
    if (value < range.min) continue;
    if (range.max === null || value < range.max) return range.id;
  }
  return null;
}

export interface PriceSummary {
  min: number;
  max: number;
  median: number;
  count: number;
}

/** Min / max / median of the amounts people actually paid. */
export function summarizePrices(values: readonly number[]): PriceSummary | null {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0);
  if (clean.length === 0) return null;
  const sorted = [...clean].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[middle]
      : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  return { min: sorted[0], max: sorted[sorted.length - 1], median, count: sorted.length };
}

/** `45000` → `45k`, `1500000` → `1,5tr` — compact enough for cards and chips. */
export function formatVnd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const text = Number.isInteger(millions) ? String(millions) : millions.toFixed(1).replace('.', ',');
    return `${text}tr`;
  }
  return `${Math.round(value / 1000)}k`;
}

/** `45000` → `45.000đ` — the full amount shown on a review. */
export function formatVndFull(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

/** Digits typed in a price field → grouped text (`45000` → `45.000`). */
export function formatPriceInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 8);
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
}

/** Read a price field back into VND, or null when empty/invalid. */
export function parsePriceInput(value: string | null | undefined): number | null {
  const digits = (value ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/**
 * Read a typed price where amounts under 1000 are shorthand for thousands:
 * `45` → 45.000, `450` → 450.000, `45000` → 45.000.
 */
export function parsePriceAmount(value: string | null | undefined): number | null {
  const amount = parsePriceInput(value);
  if (amount === null) return null;
  return amount < 1000 ? amount * 1000 : amount;
}

/** `45` → `45.000` — used when the field loses focus. */
export function expandPriceShorthand(raw: string): string {
  const amount = parsePriceAmount(raw);
  return amount === null ? '' : formatPriceInput(String(amount));
}

/** Suffix shown inside the field: `k` for a shorthand, `đ` for a full amount. */
export function priceUnitOf(raw: string | null | undefined): '' | 'k' | 'đ' {
  const amount = parsePriceInput(raw);
  if (amount === null) return '';
  return amount < 1000 ? 'k' : 'đ';
}

/** True when the stored value is exactly one of the five range representatives. */
export function isRangeRepresentative(value: number | null | undefined): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return PRICE_RANGES.some((range) => range.value === value);
}

/**
 * `30–50k` for a value that came from a range chip, `45.000đ` for an exact
 * amount typed by the contributor, and '' when there is no price yet.
 */
export function describePrice(
  value: number | null | undefined,
  labels: Record<PriceRangeId, string>,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '';
  if (isRangeRepresentative(value)) {
    const range = priceRangeOf(value);
    if (range) return labels[range];
  }
  return formatVndFull(value);
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

export interface PriceSource {
  name: string;
  restaurant?: string;
  review_note?: string | null;
  tag?: string | null;
}

/**
 * Rough price for places that still have no range/paid price. Only a fallback:
 * the UI always labels it as an estimate.
 */
export function estimateDishPrice(food: PriceSource): number {
  const text = normalize(
    `${food.name} ${food.restaurant ?? ''} ${food.review_note ?? ''} ${food.tag ?? ''}`,
  );
  const noted = text.match(/(\d{2,3})\s*(k|nghin|ngan|\/ng)\b/);
  if (noted) {
    const amount = Number(noted[1]) * 1000;
    if (amount >= 15000 && amount <= 900000) return amount;
  }
  if (/buffet|lau|nuong|bbq|hai san|king bbq|dookki|shogun|manyo|k-pub|k pub/.test(text)) return 249000;
  if (/kfc|lotteria|mcdonald|burger|popeyes|jollibee|pizza|bon chon|don chicken/.test(text)) return 89000;
  if (/banh mi|xien|che |xoi|banh duc|tra sua|cafe|ca phe|coffee|snack/.test(text)) return 40000;
  if (/pho|bun |com |chao|mi |my |hu tieu|banh cuon/.test(text)) return 65000;
  return 70000;
}
