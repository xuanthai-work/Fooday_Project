// Contract test for the opening-hours helpers.
// Run with: npm run test:hours

import assert from 'node:assert/strict';
import {
  angleToClockTime,
  clockTimeToAngle,
  formatOpeningHours,
  formatTimeVietnamese,
  meridiemOf,
  normalizeTime,
  parseOpeningHours,
  withMeridiem,
} from '../src/lib/openingHours.ts';

let checks = 0;
function check(label, fn) {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
}

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

check('the clock hand angle sets hour and minutes', () => {
  assert.equal(angleToClockTime(0, 'AM'), '00:00');
  assert.equal(angleToClockTime(75, 'AM'), '02:30');
  assert.equal(angleToClockTime(75, 'PM'), '14:30');
  assert.equal(angleToClockTime(180, 'AM'), '06:00');
  assert.equal(angleToClockTime(180, 'PM'), '18:00');
  assert.equal(angleToClockTime(345, 'AM'), '11:30');
  assert.equal(angleToClockTime(360, 'AM'), '00:00');
  assert.equal(angleToClockTime(-75, 'PM'), '21:30');
});

check('a time converts back to the hand angle', () => {
  assert.equal(clockTimeToAngle('02:30'), 75);
  assert.equal(clockTimeToAngle('14:30'), 75);
  assert.equal(clockTimeToAngle('00:00'), 0);
  assert.equal(clockTimeToAngle('12:00'), 0);
  assert.equal(clockTimeToAngle('06:00'), 180);
});

check('minutes snap to five-minute steps', () => {
  assert.equal(angleToClockTime(30 * (2 + 29 / 60), 'AM'), '02:30');
  assert.equal(angleToClockTime(30 * (2 + 58 / 60), 'AM'), '03:00');
});

check('Vietnamese time labels cover the special cases', () => {
  assert.equal(formatTimeVietnamese('00:05'), '12:05 đêm');
  assert.equal(formatTimeVietnamese('08:00'), '8:00 sáng');
  assert.equal(formatTimeVietnamese('08:30'), '8:30 sáng');
  assert.equal(formatTimeVietnamese('11:00'), '11:00 trưa');
  assert.equal(formatTimeVietnamese('12:00'), '12:00 trưa');
  assert.equal(formatTimeVietnamese('14:30'), '2:30 chiều');
  assert.equal(formatTimeVietnamese('17:59'), '5:59 chiều');
  assert.equal(formatTimeVietnamese('18:00'), '6:00 tối');
  assert.equal(formatTimeVietnamese('21:59'), '9:59 tối');
  assert.equal(formatTimeVietnamese('22:00'), '10:00 đêm');
  assert.equal(formatTimeVietnamese('23:59'), '11:59 đêm');
  assert.equal(meridiemOf('11:59'), 'AM');
  assert.equal(meridiemOf('12:00'), 'PM');
});

check('a time can move to the chosen half of the day', () => {
  assert.equal(withMeridiem('08:00', 'PM'), '20:00');
  assert.equal(withMeridiem('22:00', 'AM'), '10:00');
  assert.equal(withMeridiem('00:00', 'PM'), '12:00');
  assert.equal(withMeridiem('12:00', 'AM'), '00:00');
});

check('legacy opening strings are readable', () => {
  assert.deepEqual(parseOpeningHours('08:00 – 22:00'), { open: '08:00', close: '22:00' });
  assert.deepEqual(parseOpeningHours('8h-22h'), { open: '08:00', close: '22:00' });
  assert.deepEqual(parseOpeningHours('8:00-22:30'), { open: '08:00', close: '22:30' });
  assert.deepEqual(parseOpeningHours('8:00 AM - 10:30 PM'), { open: '08:00', close: '22:30' });
  assert.deepEqual(parseOpeningHours('00:00'), { open: '00:00', close: '' });
  assert.deepEqual(parseOpeningHours(''), { open: '', close: '' });
  assert.deepEqual(parseOpeningHours(null), { open: '', close: '' });
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

console.log(`\nall ${checks} opening-hours checks passed`);
