import type { Food, FoodCategory } from '@/hooks/useFoods';

/**
 * Words that are too generic to identify a dish on their own
 * ("with", "and", "special", ...).
 */
const STOPWORDS = new Set([
  'va',
  'voi',
  'cua',
  'cho',
  'nha',
  'quyen',
  'hot',
  'ngon',
  'dac',
  'biet',
  'combo',
  'set',
  'phan',
  'the',
  'and',
  'with',
  'for',
  'special',
  'style',
  'house',
  'king',
]);

/**
 * Common food words so a customer can trigger the effect with plain words
 * like "pho" or "burger" even when the dish is not in the catalog.
 * Keywords are normalized: lowercase, no diacritics.
 */
export const FOOD_KEYWORDS: Record<FoodCategory, string[]> = {
  Foods: [
    'pho',
    'bun',
    'mi',
    'com',
    'chao',
    'ga',
    'bo',
    'heo',
    'tom',
    'ca',
    'cua',
    'muc',
    'oc',
    'goi',
    'nem',
    'cha',
    'sup',
    'gao',
    'seafood',
    'lau',
    'hotpot',
    'bbq',
    'nuong',
    'chien',
    'xao',
    'hap',
    'burger',
    'hamburger',
    'cheeseburger',
    'pizza',
    'hotdog',
    'sandwich',
    'taco',
    'pasta',
    'spaghetti',
    'sushi',
    'gyoza',
    'ramen',
    'udon',
    'bibimbap',
    'steak',
    'ga nuong',
    'ga ran',
    'ga chien',
    'ga pho',
    'pho bo',
    'pho ga',
    'bun bo',
    'bun rieu',
    'bun cha',
    'mi quan',
    'banh mi',
    'banh cuon',
    'banh xeo',
    'banh can',
    'banh uot',
    'com tam',
    'com gai',
    'com rang',
  ],
  Drinks: [
    'ca phe',
    'cafe',
    'coffee',
    'tra',
    'tea',
    'tra tac',
    'tra sen',
    'tra hoa qua',
    'sinh to',
    'smoothie',
    'juice',
    'nuoc',
    'nuoc loc',
    'nuoc mia',
    'soda',
    'bia',
    'beer',
    'ruou',
    'cocktail',
    'mojito',
    'milkshake',
    'sua',
    'sua chua',
    'yogurt',
    'ca phe sua da',
  ],
  Snacks: [
    'banh',
    'banh ngot',
    'banh tr',
    'banh tet',
    'banh chu',
    'kem',
    'don',
    'popcorn',
    'khoai',
    'khoai tay',
    'cookie',
    'chocolate',
    'keo',
    'mut',
    'hat',
    'xoai',
    'snack',
    'chips',
    'xuc xich',
    'nem chua',
    'rau cau',
    'pho tai',
  ],
};

/** Lowercase, strip Vietnamese diacritics and punctuation, collapse spaces. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface DishMention {
  name: string;
  category: FoodCategory;
}

/** Whole-word match for a single keyword, phrase match for multi-word ones. */
function matchesKeyword(text: string, words: Set<string>, keyword: string): boolean {
  if (keyword.includes(' ')) return text.includes(keyword);
  return words.has(keyword);
}

/**
 * Find dish mentions in a free-text message.
 *
 * A catalog dish matches when the message contains its full name or any
 * meaningful token of it ("phở" matches "Phở Bò"). On top of that, a built-in
 * food vocabulary catches plain words such as "burger" or "cà phê" that are
 * not tied to a catalog entry.
 */
export function findDishMentions(text: string, foods: Food[]): DishMention[] {
  const haystack = normalizeText(text);
  if (!haystack) return [];

  const words = new Set(haystack.split(' '));
  const mentions: DishMention[] = [];
  const seen = new Set<string>();

  // 1) Catalog dishes.
  for (const food of foods) {
    const needle = normalizeText(food.name);
    if (!needle) continue;

    let matched = haystack.includes(needle);
    if (!matched) {
      const tokens = needle.split(' ').filter((token) => token.length >= 3 && !STOPWORDS.has(token));
      matched = tokens.some((token) => words.has(token));
    }

    if (matched && !seen.has(food.name)) {
      seen.add(food.name);
      mentions.push({ name: food.name, category: food.category });
    }
  }

  // 2) Generic food vocabulary.
  for (const category of Object.keys(FOOD_KEYWORDS) as FoodCategory[]) {
    for (const keyword of FOOD_KEYWORDS[category]) {
      if (!matchesKeyword(haystack, words, keyword)) continue;
      if (seen.has(keyword)) continue;
      seen.add(keyword);
      mentions.push({ name: keyword, category });
    }
  }

  return mentions;
}

/**
 * Pick the category that best explains the mentions, so the emoji set stays
 * coherent ("cà phê" should not mix in noodle emojis).
 */
export function pickEmojiCategories(mentions: DishMention[]): FoodCategory[] {
  if (mentions.length === 0) return [];

  const scores = new Map<FoodCategory, { count: number; longest: number }>();
  for (const mention of mentions) {
    const current = scores.get(mention.category) ?? { count: 0, longest: 0 };
    current.count += 1;
    current.longest = Math.max(current.longest, mention.name.length);
    scores.set(mention.category, current);
  }

  let best: FoodCategory | null = null;
  let bestScore = { count: 0, longest: 0 };
  for (const [category, score] of scores) {
    if (
      score.count > bestScore.count ||
      (score.count === bestScore.count && score.longest > bestScore.longest)
    ) {
      best = category;
      bestScore = score;
    }
  }

  return best ? [best] : [];
}
