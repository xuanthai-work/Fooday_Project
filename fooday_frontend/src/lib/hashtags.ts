// Social-style hashtag helpers with lowercase unaccented standardization

/** Trending hashtag presets offered as one-tap chips. */
export const TRENDING_HASHTAGS = [
  '#trending',
  '#danghot',
  '#viewdep',
  '#andem',
  '#viahe',
  '#codieuhoa',
  '#giahocsinh',
  '#henho',
  '#buffet',
  '#songao',
] as const;

/**
 * Removes Vietnamese diacritics/accents from a string.
 * `đ/Đ` are handled explicitly because they do not decompose under NFD.
 */
export function stripVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
}

/**
 * Normalizes free-text into a single `#hashtag`.
 * Lowercased, unaccented, spaces/special characters removed, exactly one `#`.
 * Returns an empty string when nothing meaningful is left.
 */
export function normalizeSingleHashtag(raw: string): string {
  if (!raw) return '';
  const cleaned = stripVietnameseAccents(raw.toLowerCase())
    .replace(/^#+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .trim();
  return cleaned ? `#${cleaned}` : '';
}

/**
 * Splits a stored `foods.tag` value into a list of normalized, unique hashtags.
 */
export function parseHashtags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const tokens = raw.trim().split(/[\s,]+/);
  const tags: string[] = [];
  for (const token of tokens) {
    const normalized = normalizeSingleHashtag(token);
    if (normalized && !tags.includes(normalized)) {
      tags.push(normalized);
    }
  }
  return tags;
}

/**
 * Serializes a list of hashtags into the space-separated `foods.tag` format.
 */
export function serializeHashtags(tags: string[]): string {
  const unique = Array.from(
    new Set(tags.map((t) => normalizeSingleHashtag(t)).filter(Boolean)),
  );
  return unique.join(' ');
}
