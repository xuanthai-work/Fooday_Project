// Contract test for the shared price helpers.
// Run with: npm run test:price
//
// The add/edit forms store a range representative, the detail sheet reads real
// amounts paid, and the roulette needs a fallback estimate — all three must
// agree on the same numbers.

import assert from 'node:assert/strict';
import {
  PRICE_RANGES,
  PRICE_SLIDER_MIN,
  describePrice,
  estimateDishPrice,
  formatSliderPrice,
  formatVnd,
  formatVndFull,
  isRangeRepresentative,
  priceRangeOf,
  priceRangeValue,
  priceToSlider,
  sliderToPrice,
} from '../src/lib/price.ts';

let checks = 0;
function check(label, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
}

check('every range maps to a value and back to itself', () => {
  for (const range of PRICE_RANGES) {
    assert.equal(priceRangeValue(range.id), range.value);
    assert.equal(priceRangeOf(range.value), range.id, `round trip failed for ${range.id}`);
  }
});

check('unknown or missing prices return null', () => {
  assert.equal(priceRangeValue(null), null);
  assert.equal(priceRangeOf(null), null);
  assert.equal(priceRangeOf(0), null);
  assert.equal(priceRangeOf(-5000), null);
  assert.equal(priceRangeOf(Number.NaN), null);
});

check('range boundaries are half-open', () => {
  assert.equal(priceRangeOf(29999), 'under30');
  assert.equal(priceRangeOf(30000), 'from30to50');
  assert.equal(priceRangeOf(49999), 'from30to50');
  assert.equal(priceRangeOf(50000), 'from50to100');
  assert.equal(priceRangeOf(99999), 'from50to100');
  assert.equal(priceRangeOf(100000), 'from100to200');
  assert.equal(priceRangeOf(200000), 'over200');
  assert.equal(priceRangeOf(9_000_000), 'over200');
});

check('compact and full price labels read well', () => {
  assert.equal(formatVnd(45000), '45k');
  assert.equal(formatVnd(250000), '250k');
  assert.equal(formatVnd(1500000), '1,5tr');
  assert.equal(formatVnd(2000000), '2tr');
  assert.equal(formatVnd(0), '');
  assert.equal(formatVndFull(45000), '45.000đ');
});

check('the fallback estimate recognises common dishes', () => {
  assert.equal(estimateDishPrice({ name: 'Phở bò' }), 65000);
  assert.equal(estimateDishPrice({ name: 'Trà sữa trân châu' }), 40000);
  assert.equal(estimateDishPrice({ name: 'Buffet nướng' }), 249000);
  assert.equal(estimateDishPrice({ name: 'Món lạ' }), 70000);
  assert.equal(estimateDishPrice({ name: 'Cơm tấm', review_note: 'khoảng 40k' }), 40000);
});

check('the price slider maps VND both ways on 10k notches', () => {
  assert.equal(priceToSlider(null), PRICE_SLIDER_MIN);
  assert.equal(priceToSlider(0), PRICE_SLIDER_MIN);
  assert.equal(priceToSlider(45000), 50);
  assert.equal(priceToSlider(44000), 40);
  assert.equal(priceToSlider(1_000_000), 1000);
  assert.equal(priceToSlider(5_000_000), 1000);
  assert.equal(sliderToPrice(50), 50000);
  assert.equal(sliderToPrice(10), 10000);
  assert.equal(sliderToPrice(9999), 1_000_000);
  assert.equal(formatSliderPrice(45000), '45k');
  assert.equal(formatSliderPrice(1_000_000), '1m+');
});

check('a range is shown as a range, an exact amount as a number', () => {
  const labels = {
    under30: '<30k',
    from30to50: '30–50k',
    from50to100: '50–100k',
    from100to200: '100–200k',
    over200: '200k+',
  };
  assert.equal(describePrice(40000, labels), '30–50k');
  assert.equal(describePrice(75000, labels), '50–100k');
  assert.equal(describePrice(45000, labels), '45.000đ');
  assert.equal(describePrice(0, labels), '');
  assert.ok(isRangeRepresentative(250000));
  assert.ok(!isRangeRepresentative(260000));
});

console.log(`\nall ${checks} price checks passed`);
