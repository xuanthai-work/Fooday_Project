'use client';

import { foodHasCategory, type Food } from '@/hooks/useFoods';

/** The eating "mood" / occasion used by the Home feed and the Random roulette. */
export type MoodTaskCategory =
  | 'All'
  | 'OfficeLunch'
  | 'Gathering'
  | 'Healthy'
  | 'WorkCafe'
  | 'AfternoonTea'
  | 'Romantic';

export interface MoodTaskOption {
  id: MoodTaskCategory;
  labelKey:
    | 'all'
    | 'officeLunch'
    | 'gathering'
    | 'healthy'
    | 'workCafe'
    | 'afternoonTea'
    | 'romantic';
  icon: string;
  keywords: string[];
}

export const MOOD_TASKS: MoodTaskOption[] = [
  { id: 'All', labelKey: 'all', icon: '🌟', keywords: [] },
  {
    id: 'OfficeLunch',
    labelKey: 'officeLunch',
    icon: '💼',
    keywords: ['cơm', 'bún', 'phở', 'mì', 'hủ tiếu', 'bánh mì', 'xôi', 'trưa', 'lunch', 'cơm tấm'],
  },
  {
    id: 'Gathering',
    labelKey: 'gathering',
    icon: '🍻',
    keywords: ['lẩu', 'nướng', 'bbq', 'buffet', 'nhậu', 'tụ tập', 'bia', 'hải sản', 'gà', 'đồ hàn', 'pizza', 'ốc'],
  },
  {
    id: 'Healthy',
    labelKey: 'healthy',
    icon: '🥗',
    keywords: ['chay', 'vegan', 'salad', 'healthy', 'clean', 'thanh đạm', 'rau'],
  },
  {
    id: 'WorkCafe',
    labelKey: 'workCafe',
    icon: '☕',
    keywords: ['cà phê', 'cafe', 'coffee', 'làm việc', 'yên tĩnh', 'trà', 'tea', 'trà sữa', 'sinh tố', 'nước ép', 'bánh ngọt', 'wifi', 'coworking', 'study'],
  },
  {
    id: 'AfternoonTea',
    labelKey: 'afternoonTea',
    icon: '🧋',
    keywords: ['trà sữa', 'ăn vặt', 'chè', 'snack', 'bánh', 'ốc', 'xiên', 'trà chiều'],
  },
  {
    id: 'Romantic',
    labelKey: 'romantic',
    icon: '🍷',
    keywords: ['hẹn hò', 'ấm cúng', 'view đẹp', 'lãng mạn', 'steak', 'bò bít tết', 'pizza', 'sushi', 'rượu', 'romantic', 'đồ hàn', 'đồ thái', 'tacos', 'nướng', 'hải sản'],
  },
];

const normalize = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

/** True when a dish belongs to the given mood/occasion (name, tag, menu, note). */
export function itemMatchesMood(
  item: Food,
  mood: MoodTaskOption | MoodTaskCategory,
): boolean {
  const option =
    typeof mood === 'string'
      ? (MOOD_TASKS.find((task) => task.id === mood) ?? MOOD_TASKS[0])
      : mood;
  if (option.id === 'All') return true;
  if (option.id === 'AfternoonTea' && foodHasCategory(item, 'Snacks')) return true;
  const fields = [
    item.name,
    item.restaurant,
    item.tag,
    item.review_note,
    (item.dishes ?? []).join(' · '),
  ];
  return option.keywords.some((keyword) => {
    const k = normalize(keyword);
    return fields.some((field) => field != null && normalize(field).includes(k));
  });
}
