// Opening hours helpers for the add/edit dish forms.
//
// Contributors type four digits on a numeric keypad (`0010`) and the field
// formats itself to `00:10` — no ":" needed on a phone. Overnight ranges such
// as `22:00 – 02:00` are allowed: a closing time is never forced after the
// opening one.

export interface OpeningHours {
  open: string;
  close: string;
}

/** Digits typed so far → the value shown in the input, e.g. `00:1`. */
export function formatTimeDigits(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Pad/limit a partial time into a valid `HH:mm`; '' when nothing was typed. */
export function normalizeTime(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const padded = (digits.length <= 2 ? digits.padStart(2, '0') : digits.padStart(4, '0')).slice(-4);
  const hour = Math.min(23, Number(padded.slice(0, 2)) || 0);
  const minute = Math.min(59, Number(padded.slice(2, 4)) || 0);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** One side of a legacy value (`8h30`, `08:00`, `22`) → `HH:mm`. */
function timeFromToken(token: string): string {
  const digits = token.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return normalizeTime(digits);
}

/**
 * Read a stored `opening_time` string. Supports `08:00 – 22:00`, `8h-22h`,
 * `8:00-22:00`, `8h30 - 22h`, and a single time. Unknown text yields two empty
 * fields so the caller can keep the original value untouched.
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
