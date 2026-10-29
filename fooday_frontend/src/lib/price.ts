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

/** Slider bounds in thousands of VND. */
export const PRICE_SLIDER_MIN = 10;
export const PRICE_SLIDER_MAX = 1000;
/** Every notch is 10k, so the slider reads as price ranges, not single đồng. */
export const PRICE_SLIDER_STEP = 10;

const clampSlider = (value: number) =>
  Math.min(PRICE_SLIDER_MAX, Math.max(PRICE_SLIDER_MIN, value));

const snapToStep = (value: number) =>
  clampSlider(Math.round(value / PRICE_SLIDER_STEP) * PRICE_SLIDER_STEP);

/** VND → slider position (10, 20, … 1000). Empty prices sit on the first notch. */
export function priceToSlider(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return PRICE_SLIDER_MIN;
  }
  return snapToStep(Math.round(value / 1000));
}

/** Slider position → VND, always on a 10k notch. */
export function sliderToPrice(position: number): number {
  return clampSlider(Math.round(position / PRICE_SLIDER_STEP) * PRICE_SLIDER_STEP) * 1000;
}

/** `45k` while below one million, `1m+` at the top of the slider. */
export function formatSliderPrice(value: number): string {
  return value >= 1_000_000 ? '1m+' : formatVnd(value);
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
 * Rough price for places that still have no price set. Only a fallback: the UI
 * always labels it as an estimate.
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
