// Contract test for the Random roulette reel.
// Run with: npm run test:reel
//
// The reel used to be random sampling with replacement, so two identical cards
// could sit next to each other (the "Mì & Cháo, Mì & Cháo" report). These
// checks make sure that can no longer happen, and that the winning card really
// lands under the ticker with a different type on both sides.

import assert from 'node:assert/strict';
import { buildReel, buildSpinReel, shuffle, REEL_SIZE } from '../src/lib/reel.ts';

/** Deterministic PRNG so a failure is always reproducible. */
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hasAdjacentDuplicate = (list) =>
  list.some((item, index) => index > 0 && Object.is(item, list[index - 1]));

let checks = 0;
function check(label, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
}

check('empty pool deals an empty reel', () => {
  assert.deepEqual(buildReel([], REEL_SIZE, mulberry32(1)), []);
  assert.deepEqual(buildSpinReel([], 'com', 32), []);
});

check('shuffle keeps every item and does not mutate the input', () => {
  const input = [1, 2, 3, 4, 5];
  const copy = input.slice();
  const out = shuffle(input, mulberry32(2));
  assert.deepEqual(input, copy);
  assert.deepEqual(out.slice().sort(), input.slice().sort());
});

check('reel length and pool membership hold for 1–20 types', () => {
  for (let size = 1; size <= 20; size += 1) {
    const pool = Array.from({ length: size }, (_, index) => `type-${index}`);
    const random = mulberry32(100 + size);
    for (let run = 0; run < 100; run += 1) {
      const reel = buildReel(pool, REEL_SIZE, random);
      assert.equal(reel.length, REEL_SIZE, `size ${size}: wrong reel length`);
      assert.ok(
        reel.every((item) => pool.includes(item)),
        `size ${size}: unknown card in the reel`,
      );
    }
  }
});

check('no two identical cards sit next to each other (2–20 types)', () => {
  for (let size = 2; size <= 20; size += 1) {
    const pool = Array.from({ length: size }, (_, index) => `type-${index}`);
    const random = mulberry32(500 + size);
    for (let run = 0; run < 200; run += 1) {
      const reel = buildReel(pool, REEL_SIZE, random);
      assert.ok(
        !hasAdjacentDuplicate(reel),
        `size ${size}: found ${reel.filter((item, index) => index > 0 && Object.is(item, reel[index - 1])).length} duplicated card pair(s)`,
      );
    }
  }
});

check('a one-type pool may repeat (nothing else to deal)', () => {
  const reel = buildReel(['com'], REEL_SIZE, mulberry32(7));
  assert.equal(reel.length, REEL_SIZE);
  assert.ok(reel.every((item) => item === 'com'));
});

check('the winner lands under the ticker with different neighbours', () => {
  for (let size = 1; size <= 20; size += 1) {
    const pool = Array.from({ length: size }, (_, index) => `type-${index}`);
    const random = mulberry32(900 + size);
    for (let run = 0; run < 100; run += 1) {
      const winner = pool[Math.floor(random() * pool.length)];
      const winnerIndex = 32 + Math.floor(random() * 7);
      const reel = buildSpinReel(pool, winner, winnerIndex, REEL_SIZE, random);
      assert.equal(reel.length, REEL_SIZE, `size ${size}: wrong reel length`);
      assert.ok(Object.is(reel[winnerIndex], winner), `size ${size}: winner not under the ticker`);
      if (size > 1) {
        assert.ok(!Object.is(reel[winnerIndex - 1], winner), `size ${size}: repeated card before the winner`);
        assert.ok(!Object.is(reel[winnerIndex + 1], winner), `size ${size}: repeated card after the winner`);
      }
    }
  }
});

check('a spin reel never repeats a card for pools of 2+ types', () => {
  for (let size = 2; size <= 20; size += 1) {
    const pool = Array.from({ length: size }, (_, index) => `type-${index}`);
    const random = mulberry32(1300 + size);
    for (let run = 0; run < 200; run += 1) {
      const winner = pool[Math.floor(random() * pool.length)];
      const reel = buildSpinReel(pool, winner, 32, REEL_SIZE, random);
      assert.ok(!hasAdjacentDuplicate(reel), `size ${size}: duplicated cards in the spin reel`);
    }
  }
});

check('an out-of-range winner index is clamped', () => {
  const pool = ['a', 'b', 'c'];
  const low = buildSpinReel(pool, 'b', -5, 10, mulberry32(3));
  const high = buildSpinReel(pool, 'b', 99, 10, mulberry32(4));
  assert.ok(Object.is(low[0], 'b'));
  assert.ok(Object.is(high[high.length - 1], 'b'));
});

console.log(`\nall ${checks} reel checks passed`);
