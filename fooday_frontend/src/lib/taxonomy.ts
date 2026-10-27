'use client';

// Two-level dish taxonomy for the Home feed.
//
// Level 1 answers "what kind of meal is this?" (đồ khô / đồ nước / lẩu nướng /
// buffet / đồ uống / ăn vặt) and level 2 refines it inside the same branch.
// Rules are intentionally word-based instead of "anything that contains…":
// `Bánh mì` must not land in the noodle branch just because it contains "mì",
// and `Trạm y tế` in a restaurant name must never become "trà".
// Every dish belongs to at most one branch (first rule wins) so the chips never
// overlap, and matching runs on the dish name first — the restaurant name is
// only a fallback for coarse rows such as `Buffet` or `Đồ Hàn`.

import type { Food, FoodCategory } from '@/hooks/useFoods';

export type DishGroupId = 'all' | 'kho' | 'nuoc' | 'lau' | 'buffet' | 'uong' | 'anVat';

export type DishSubId =
  | 'com'
  | 'bunTron'
  | 'banh'
  | 'ga'
  | 'ngoai'
  | 'pho'
  | 'bunNuoc'
  | 'miChao'
  | 'nuong'
  | 'lauNoi'
  | 'buffetNuong'
  | 'buffetChay'
  | 'caPhe'
  | 'traSua'
  | 'sinhTo'
  | 'nuocNgot'
  | 'biaRuou'
  | 'xien'
  | 'banhNgot'
  | 'kem'
  | 'hat'
  | 'che';

interface Rule {
  /** Normalized, unaccented words. Matched on whole words, never mid-word. */
  words: string[];
  /** Words that veto the rule (e.g. `banh` rules out the `mì` of "bánh mì"). */
  exclude?: string[];
}

export interface DishSubRule extends Rule {
  id: DishSubId;
}

export interface DishGroupRule extends Rule {
  id: DishGroupId;
  icon: string;
  subs?: DishSubRule[];
}

/** Display order of the level-1 chips (also the "Tất cả" reset). */
export const DISH_GROUPS: DishGroupRule[] = [
  { id: 'all', icon: '🌟', words: [] },
  {
    id: 'kho',
    icon: '🍚',
    words: ['com', 'com tam', 'xoi', 'bun', 'bun cha', 'bun dau', 'banh', 'banh mi', 'ga', 'hamburger', 'burger', 'burgers', 'taco', 'tacos', 'pizza', 'pizzas', 'sushi', 'pasta', 'steak', 'do han', 'do thai', 'do au', 'do nhat', 'mon han', 'mon thai', 'mon au', 'mon nhat'],
    subs: [
      { id: 'com', words: ['com', 'xoi'] },
      { id: 'bunTron', words: ['bun'] },
      { id: 'banh', words: ['banh'] },
      { id: 'ga', words: ['ga'] },
      {
        id: 'ngoai',
        words: ['hamburger', 'burger', 'burgers', 'taco', 'tacos', 'pizza', 'pizzas', 'sushi', 'pasta', 'steak', 'do han', 'do thai', 'do au', 'do nhat', 'mon han', 'mon thai', 'mon au', 'mon nhat'],
      },
    ],
  },
  {
    id: 'nuoc',
    icon: '🍜',
    words: ['pho', 'bun bo', 'bun rieu', 'bun suon', 'bun thang', 'bun ca', 'bun ngan', 'bun moc', 'bun oc', 'hu tieu', 'mi', 'chao', 'mien', 'banh canh', 'mi quang', 'sup', 'canh'],
    exclude: ['banh'],
    subs: [
      { id: 'pho', words: ['pho'] },
      { id: 'bunNuoc', words: ['bun'] },
      { id: 'miChao', words: ['mi', 'chao', 'hu tieu', 'mien', 'banh canh'], exclude: ['banh'] },
    ],
  },
  {
    id: 'lau',
    icon: '🔥',
    words: ['lau', 'nuong', 'bbq', 'hotpot', 'grill'],
    exclude: ['bun', 'banh', 'pho', 'mi', 'com', 'chao'],
    subs: [
      { id: 'nuong', words: ['nuong', 'bbq', 'grill'] },
      { id: 'lauNoi', words: ['lau', 'hotpot'] },
    ],
  },
  {
    id: 'buffet',
    icon: '🍽️',
    words: ['buffet'],
    subs: [
      { id: 'buffetNuong', words: ['nuong', 'bbq', 'grill'] },
      { id: 'buffetChay', words: ['chay', 'vegan', 'vegetarian'] },
    ],
  },
  {
    id: 'uong',
    icon: '🥤',
    // Drinks are usually added while the place is tagged "Ăn chính", so they
    // are recognized by name too — but only with unambiguous drink phrases and
    // a veto on staple words, so "bánh mì" never becomes a drink.
    words: ['ca phe', 'cafe', 'coffee', 'latte', 'matcha', 'bac xiu', 'espresso', 'cappuccino', 'americano', 'tra sua', 'tra', 'milk tea', 'sinh to', 'nuoc ep', 'smoothie', 'soda', 'nuoc ngot', 'bia', 'ruou', 'cocktail', 'beer', 'wine'],
    exclude: ['com', 'bun', 'pho', 'mi', 'chao', 'xoi', 'banh', 'lau', 'nuong', 'xien'],
    subs: [
      { id: 'caPhe', words: ['ca phe', 'cafe', 'coffee', 'latte', 'matcha', 'espresso', 'cappuccino', 'americano', 'bac xiu'] },
      { id: 'traSua', words: ['tra sua', 'tra', 'milk tea', 'tra dao', 'tra vai', 'tra sen', 'tra thai', 'tra chanh'] },
      { id: 'sinhTo', words: ['sinh to', 'nuoc ep', 'smoothie', 'nuoc dua', 'ep'] },
      { id: 'nuocNgot', words: ['soda', 'nuoc ngot', 'pepsi', 'coca', 'sting', 'revive', 'nuoc suoi', 'nuoc tang luc', 'trai cay'] },
      { id: 'biaRuou', words: ['bia', 'ruou', 'cocktail', 'beer', 'wine', 'soju', 'whisky'] },
    ],
  },
  {
    id: 'anVat',
    icon: '🍢',
    words: ['xien', 'che', 'kem', 'banh ngot', 'cookie', 'donut', 'snack', 'oc'],
    exclude: ['com', 'bun', 'pho', 'mi', 'chao', 'xoi', 'lau', 'nuong'],
    subs: [
      { id: 'che', words: ['che'] },
      { id: 'banhNgot', words: ['banh ngot', 'cookie', 'donut', 'brownie', 'tiramisu', 'cake', 'bong lan'] },
      { id: 'kem', words: ['kem', 'sua chua', 'pudding', 'yogurt'] },
      { id: 'xien', words: ['xien', 'oc'] },
      { id: 'hat', words: ['hat', 'trai cay', 'do kho'] },
    ],
  },
];

/**
 * Order used when assigning a dish to a branch: the most specific rule wins.
 * Drinks and snacks are matched by name only after the real meal families, so
 * a missing `Drinks` category never steals "bánh mì" or "bún bò".
 */
const CLASSIFY_ORDER: DishGroupId[] = ['buffet', 'lau', 'nuoc', 'uong', 'anVat', 'kho'];

const GROUPS_BY_ID = new Map(DISH_GROUPS.map((group) => [group.id, group]));

export function groupById(id: DishGroupId): DishGroupRule {
  return GROUPS_BY_ID.get(id) ?? DISH_GROUPS[0];
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasWord = (text: string, word: string) =>
  new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(word)}(?:$|[^a-z0-9])`).test(text);

const hasAny = (text: string, words: readonly string[]) =>
  words.some((word) => hasWord(text, normalize(word)));

/** What the dish *is* — the menu list is part of the dish, the shop is not. */
function dishText(food: Food): string {
  return normalize([food.name, (food.dishes ?? []).join(' ')].filter(Boolean).join(' '));
}

/** Dish + shop + hashtags, used only when the dish name alone says nothing. */
function fullText(food: Food): string {
  return normalize([dishText(food), food.restaurant ?? '', food.tag ?? ''].join(' '));
}

function matchesIn(text: string, rule: Rule): boolean {
  if (rule.words.length === 0) return false;
  if (rule.exclude && hasAny(text, rule.exclude)) return false;
  return hasAny(text, rule.words);
}

/** First rule that matches wins, keeping every dish in exactly one branch. */
function pickRule<T extends { id: string }>(text: string, rules: readonly (T & Rule)[]): T['id'] | null {
  for (const rule of rules) {
    if (matchesIn(text, rule)) return rule.id;
  }
  return null;
}

const CLASSIFY_RULES = CLASSIFY_ORDER.map(groupById);

/** Same rule as `foodHasCategory`, kept local so this module stays pure. */
function hasCategory(food: Food, category: FoodCategory): boolean {
  return food.category === category || (food.categories ?? []).includes(category);
}

/** The one branch a dish belongs to, or `null` when nothing matches. */
export function groupOf(food: Food): DishGroupId | null {
  if (hasCategory(food, 'Foods')) {
    // The dish name wins; the shop name only steps in when the name says
    // nothing (e.g. a place literally named "Buffet").
    return (
      pickRule<DishGroupRule>(dishText(food), CLASSIFY_RULES) ??
      pickRule<DishGroupRule>(fullText(food), CLASSIFY_RULES)
    );
  }
  if (hasCategory(food, 'Drinks')) return 'uong';
  if (hasCategory(food, 'Snacks')) return 'anVat';
  return null;
}

/** The level-2 chip of a dish inside its branch, or `null` when it has none. */
export function subGroupOf(food: Food, group: DishGroupId): DishSubId | null {
  const subs = groupById(group).subs;
  if (!subs || subs.length === 0) return null;
  return (
    pickRule<DishSubRule>(dishText(food), subs) ??
    pickRule<DishSubRule>(fullText(food), subs)
  );
}

export function matchesGroup(food: Food, group: DishGroupId): boolean {
  return group === 'all' || groupOf(food) === group;
}

export function matchesSubGroup(
  food: Food,
  group: DishGroupId,
  sub: DishSubId | null,
): boolean {
  if (!sub) return true;
  return subGroupOf(food, group) === sub;
}
