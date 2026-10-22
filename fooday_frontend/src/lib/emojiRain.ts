import type { FoodCategory } from '@/hooks/useFoods';

/** Emoji pools per dish category so the rain matches what was mentioned. */
export const EMOJI_BY_CATEGORY: Record<FoodCategory, string[]> = {
  Foods: ['🍜', '🍲', '🍛', '🍝', '🍗', '🍤', '🥘', '🍚', '🍱', '🍖'],
  Drinks: ['🥤', '☕', '🧋', '🧃', '🍹', '🍺', '🥛', '🍵', '🧉'],
  Snacks: ['🍟', '🍕', '🍿', '🥨', '🍪', '🍩', '🥟', '🥨', '🍫', '🧁'],
};

/** A few celebration emojis shared by every category. */
const SHARED_EMOJI = ['🎉', '😋', '🤩', '✨', '🥳', '🍽️'];

export type RainIntensity = 'chat' | 'mini' | 'full';

export interface RainParticle {
  id: string;
  char: string;
  /** Horizontal start position in percent of the layer width. */
  x: number;
  /** Horizontal drift in px while falling. */
  drift: number;
  /** Rotation in degrees. */
  rot: number;
  /** Fall duration in seconds. */
  dur: number;
  /** Delay before the fall starts, in seconds. */
  delay: number;
  /** Font size in px. */
  size: number;
  /** Peak opacity. */
  opacity: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

/**
 * Build one burst of falling emoji.
 *
 * `chat` is a short, soft sprinkle near the top of the chat area;
 * `mini` is the subtle version used after the first sprinkle of a session;
 * `full` is a dense celebration that fills the screen.
 */
export function buildBurst(
  categories: FoodCategory[],
  intensity: RainIntensity,
): RainParticle[] {
  const pool: string[] = [];
  for (const category of categories.length ? categories : (['Foods'] as FoodCategory[])) {
    pool.push(...EMOJI_BY_CATEGORY[category]);
  }
  pool.push(...SHARED_EMOJI);

  const count =
    intensity === 'full' ? randInt(28, 32) : intensity === 'mini' ? randInt(3, 4) : randInt(8, 12);
  const particles: RainParticle[] = [];

  for (let i = 0; i < count; i += 1) {
    particles.push({
      id: `p${i}-${Math.random().toString(36).slice(2, 8)}`,
      char: pool[randInt(0, pool.length - 1)],
      x: rand(2, 96),
      drift: rand(-28, 28),
      rot: rand(-40, 40),
      dur:
        intensity === 'full' ? rand(2.6, 4.2) : intensity === 'mini' ? rand(0.9, 1.2) : rand(1.2, 1.8),
      delay: intensity === 'full' ? rand(0, 1.2) : intensity === 'mini' ? rand(0, 0.15) : rand(0, 0.35),
      size: intensity === 'full' ? rand(18, 30) : intensity === 'mini' ? rand(12, 14) : rand(14, 22),
      opacity:
        intensity === 'full' ? rand(0.75, 1) : intensity === 'mini' ? rand(0.4, 0.6) : rand(0.55, 0.9),
    });
  }

  return particles;
}
