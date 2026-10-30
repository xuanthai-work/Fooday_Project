// Opening hours helpers for the add/edit dish forms.
//
// The clock picker uses a single 12-hour hand: its angle sets the hour *and*
// the minutes (halfway between 2 and 3 reads 2:30). Opening times use AM and
// closing times use PM. Values are still stored as `HH:mm` (24h) so overnight
// ranges such as `22:00 – 02:00` keep working.

export interface OpeningHours {
  open: string;
  close: string;
}

export type Meridiem = 'AM' | 'PM';

/** Pad/limit a partial time into a valid `HH:mm`; '' when nothing was typed. */
export function normalizeTime(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const padded = (digits.length <= 2 ? digits.padStart(2, '0') : digits.padStart(4, '0')).slice(-4);
  const hour = Math.min(23, Number(padded.slice(0, 2)) || 0);
  const minute = Math.min(59, Number(padded.slice(2, 4)) || 0);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Force a 24h time onto the AM or the PM half of the clock. */
export function withMeridiem(time: string, meridiem: Meridiem): string {
  const hour = Number(time.slice(0, 2)) || 0;
  const minute = time.slice(3, 5) || '00';
  const hour12 = hour % 12;
  const next = meridiem === 'PM' ? (hour12 === 0 ? 12 : hour12 + 12) : hour12;
  return `${String(next).padStart(2, '0')}:${minute}`;
}

/** One side of a legacy value (`8h30`, `08:00`, `22`, `10:30 PM`) → `HH:mm`. */
function timeFromToken(token: string): string {
  const meridiem = /\bpm\b/i.test(token) ? 'PM' : /\bam\b/i.test(token) ? 'AM' : null;
  const digits = token.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const time = normalizeTime(digits);
  if (!meridiem) return time;
  return withMeridiem(time, meridiem);
}

/**
 * Read a stored `opening_time` string. Supports `08:00 – 22:00`, `8h-22h`,
 * `8:00-22:00`, `8h30 - 22h`, `8:00 AM - 10:30 PM`, and a single time.
 * Unknown text yields two empty fields so the caller can keep the original
 * value untouched.
 */
export function parseOpeningHours(value?: string | null): OpeningHours {
  const text = (value ?? '').trim();
  if (!text) return { open: '', close: '' };

  const parts = text
    .split(/\s*(?:--|[-–—~→]|đến|to)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const times = parts.map(timeFromToken).filter(Boolean);
  if (times.length >= 2) return { open: times[0], close: times[1] };
  if (times.length === 1) return { open: times[0], close: '' };
  return { open: '', close: '' };
}

/** `{08:00, 22:00}` → `08:00 – 22:00`; a lone value stays alone; none → null. */
export function formatOpeningHours(hours: OpeningHours): string | null {
  const open = normalizeTime(hours.open);
  const close = normalizeTime(hours.close);
  if (open && close) return `${open} – ${close}`;
  return open || close || null;
}

/** AM for hours below noon, PM otherwise. */
export function meridiemOf(time: string): Meridiem {
  const hour = Number((time || '00:00').slice(0, 2));
  return hour >= 12 ? 'PM' : 'AM';
}

/**
 * Angle of a single 12-hour hand (0° = 12, clockwise) → 24h `HH:mm`.
 * The minutes come from the hand position, snapped to 5-minute steps:
 * 75° between 2 and 3 → 02:30 (AM) or 14:30 (PM).
 */
export function angleToClockTime(angle: number, meridiem: Meridiem): string {
  const normalized = ((angle % 360) + 360) % 360;
  const hourFloat = normalized / 30;
  let hour12 = Math.floor(hourFloat);
  let minute = Math.round(((hourFloat - hour12) * 60) / 5) * 5;
  if (minute >= 60) {
    minute = 0;
    hour12 = (hour12 + 1) % 12;
  }
  const hour24 =
    meridiem === 'PM' ? (hour12 === 0 ? 12 : hour12 + 12) : hour12 === 0 ? 0 : hour12;
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Inverse of `angleToClockTime`: a 24h time → hand angle in degrees. */
export function clockTimeToAngle(time: string): number {
  const hour = Number((time || '00:00').slice(0, 2)) % 12;
  const minute = Number((time || '00:00').slice(3, 5)) || 0;
  return (hour + minute / 60) * 30;
}

/** `14:30` → `2:30 chiều`; `00:05` → `12:05 đêm`; `11:00` → `11:00 trưa`. */
export function formatTimeVietnamese(time: string): string {
  const hour = Number(time.slice(0, 2)) || 0;
  const minute = time.slice(3, 5) || '00';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  let period: string;
  if (hour === 0) period = 'đêm';
  else if (hour < 11) period = 'sáng';
  else if (hour < 13) period = 'trưa';
  else if (hour < 18) period = 'chiều';
  else if (hour < 22) period = 'tối';
  else period = 'đêm';
  return `${hour12}:${minute} ${period}`;
}
