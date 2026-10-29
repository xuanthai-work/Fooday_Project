// Contract test for the "Phổ biến" (popular) ordering.
// Run with: npm run test:popularity
//
// A single 5★ review must never outrank a well-reviewed place, and dishes
// without reviews should sit near the catalog average instead of the extremes.

import assert from 'node:assert/strict';
import {
  popularityScore,
  POPULAR_PRIOR,
  POPULAR_WEIGHT,
} from '../src/lib/popularity.ts';

let checks = 0;
function check(label, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
}

check('a dish with no reviews is pulled towards the prior rating', () => {
  assert.ok(popularityScore(5, 0) < 5);
  assert.ok(popularityScore(5, 0) > POPULAR_PRIOR);
  assert.ok(popularityScore(3, 0) > 3);
  assert.ok(popularityScore(3, 0) < POPULAR_PRIOR);
});

check('many good reviews beat a single perfect review', () => {
  const trusted = popularityScore(4.8, 100);
  const lucky = popularityScore(5, 1);
  assert.ok(trusted > lucky, `${trusted} should be > ${lucky}`);
});

check('a big review count lifts an honest 4.5 above an unproven 5.0', () => {
  assert.ok(popularityScore(4.5, 40) > popularityScore(5, 0));
});

check('equal ratings: more reviews always score higher', () => {
  assert.ok(popularityScore(4.6, 50) > popularityScore(4.6, 10));
});

check('a single 5★ still beats a single 1★', () => {
  assert.ok(popularityScore(5, 1) > popularityScore(1, 1));
});

check('scores stay inside the 1–5 range', () => {
  for (const [average, count] of [
    [5, 0],
    [1, 0],
    [5, 1000],
    [1, 1000],
    [4.75, 12],
  ]) {
    const score = popularityScore(average, count);
    assert.ok(score >= 1 && score <= 5, `${average}/${count} → ${score}`);
  }
});

check('weighted average matches the documented formula', () => {
  const average = 4.6;
  const count = 20;
  const expected = (average * count + POPULAR_PRIOR * POPULAR_WEIGHT) / (count + POPULAR_WEIGHT);
  assert.ok(Math.abs(popularityScore(average, count) - expected) < 1e-12);
});

check('invalid input never lands outside the rating scale', () => {
  const noRating = popularityScore(Number.NaN, 10);
  assert.equal(noRating, POPULAR_PRIOR);
  const badCount = popularityScore(4.9, -3);
  assert.ok(badCount > POPULAR_PRIOR && badCount < 4.9, `got ${badCount}`);
});

console.log(`\nall ${checks} popularity checks passed`);
