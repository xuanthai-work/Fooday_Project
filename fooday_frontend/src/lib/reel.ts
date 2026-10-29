// Roulette helpers for the Random page.
//
// The reel is a long row of cards that scrolls under a fixed ticker. Picking
// each card at random means the same type often shows up twice in a row, which
// reads as "the app repeated itself". Instead the reel is dealt like cards:
// every lap walks through the whole pool once, so the cards visible at any time
// are different — except when the pool only has one type.

/** How many cards the scrolling reel contains. */
export const REEL_SIZE = 45;

const same = (a: unknown, b: unknown) => Object.is(a, b);

type Random = () => number;

/** Fisher–Yates shuffle on a copy (the input is never mutated). */
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Deal `size` cards from `pool` in shuffled laps: each lap contains every item
 * exactly once, and a lap never starts with the item the previous lap ended on.
 */
export function buildReel<T>(
  pool: readonly T[],
  size = REEL_SIZE,
  random: Random = Math.random,
): T[] {
  if (pool.length === 0 || size <= 0) return [];

  const out: T[] = [];
  while (out.length < size) {
    const lap = shuffle(pool, random);
    const last = out[out.length - 1];
    if (out.length > 0 && lap.length > 1 && same(lap[0], last)) {
      // Move a different item to the front so the two laps do not collide.
      const swapAt = lap.findIndex((item, index) => index > 0 && !same(item, lap[0]));
      if (swapAt > 0) [lap[0], lap[swapAt]] = [lap[swapAt], lap[0]];
    }
    for (const item of lap) {
      if (out.length >= size) break;
      out.push(item);
    }
  }
  return out;
}

/**
 * Build the reel for a spin. The winning type is pinned under the ticker and,
 * whenever the pool has more than two types, left out of the surrounding laps
 * so both neighbouring cards always show a different type. With only two types
 * they simply alternate — no card ever repeats next to itself either way.
 */
export function buildSpinReel<T>(
  pool: readonly T[],
  winner: T,
  winnerIndex: number,
  size = REEL_SIZE,
  random: Random = Math.random,
): T[] {
  if (pool.length === 0) return [];
  const others = pool.filter((item) => !same(item, winner));
  if (others.length === 0) return Array.from({ length: size }, () => winner);

  const at = Math.max(0, Math.min(Math.round(winnerIndex), size - 1));
  if (others.length === 1) {
    // Two types only: alternate them so the winner still has different neighbours.
    const other = others[0];
    return Array.from({ length: size }, (_, index) =>
      (index - at) % 2 === 0 ? winner : other,
    );
  }
  const left = buildReel(others, at, random);
  const right = buildReel(others, size - at - 1, random);
  return [...left, winner, ...right];
}
