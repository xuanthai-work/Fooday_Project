// Contract test for the opening-hours formatter.
// Run with: npm run test:hours

import assert from 'node:assert/strict';
import {
  formatOpeningHours,
  formatTimeDigits,
  normalizeTime,
  parseOpeningHours,
} from '../src/lib/openingHours.ts';

let checks = 0;
function check(label, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
}

check('four digits become HH:mm while typing', () => {
  assert.equal(formatTimeDigits('0'), '0');
  assert.equal(formatTimeDigits('00'), '00');
  assert.equal(formatTimeDigits('001'), '00:1');
  assert.equal(formatTimeDigits('0010'), '00:10');
  assert.equal(formatTimeDigits('08:00'), '08:00');
  assert.equal(formatTimeDigits('abc'), '');
  assert.equal(formatTimeDigits('123456'), '12:34');
});

check('a partial time is padded to a full HH:mm', () => {
  assert.equal(normalizeTime('0010'), '00:10');
  assert.equal(normalizeTime('830'), '08:30');
  assert.equal(normalizeTime('22'), '22:00');
  assert.equal(normalizeTime('9'), '09:00');
  assert.equal(normalizeTime(''), '');
});

check('invalid hours and minutes are clamped, never rejected', () => {
  assert.equal(normalizeTime('2599'), '23:59');
  assert.equal(normalizeTime('0099'), '00:59');
});

check('legacy opening strings are readable', () => {
  assert.deepEqual(parseOpeningHours('08:00 – 22:00'), { open: '08:00', close: '22:00' });
  assert.deepEqual(parseOpeningHours('8h-22h'), { open: '08:00', close: '22:00' });
  assert.deepEqual(parseOpeningHours('8:00-22:30'), { open: '08:00', close: '22:30' });
  assert.deepEqual(parseOpeningHours('00:00'), { open: '00:00', close: '' });
  assert.deepEqual(parseOpeningHours(''), { open: '', close: '' });
  assert.deepEqual(parseOpeningHours(null), { open: '', close: '' });
  assert.deepEqual(parseOpeningHours('mở cả ngày'), { open: '', close: '' });
});

check('overnight ranges are kept as typed', () => {
  assert.equal(formatOpeningHours({ open: '22:00', close: '02:00' }), '22:00 – 02:00');
  assert.deepEqual(parseOpeningHours('22:00 – 02:00'), { open: '22:00', close: '02:00' });
});

check('a lone value and an empty range are handled', () => {
  assert.equal(formatOpeningHours({ open: '08:00', close: '' }), '08:00');
  assert.equal(formatOpeningHours({ open: '', close: '22:00' }), '22:00');
  assert.equal(formatOpeningHours({ open: '', close: '' }), null);
});

check('formatting then parsing round-trips', () => {
  const hours = { open: '08:00', close: '22:30' };
  const text = formatOpeningHours(hours);
  assert.ok(text);
  assert.deepEqual(parseOpeningHours(text), hours);
});

console.log(`\nall ${checks} opening-hours checks passed`);
