// Helpers for working with Google Maps links pasted by users.

/**
 * Accepted Google Maps link shapes:
 *  - https://maps.app.goo.gl/xxxx        (short share link)
 *  - https://www.google.com/maps/...    (full place / coordinates link)
 *  - https://goo.gl/maps/xxxx           (legacy short link)
 */
const MAPS_LINK_PATTERN =
  /(maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps)/i;

/** True when the value looks like a usable Google Maps link. */
export const isGoogleMapsUrl = (value: string): boolean => {
  const v = (value || '').trim();
  if (!v) return false;
  if (!/^https?:\/\//i.test(v)) return false;
  return MAPS_LINK_PATTERN.test(v);
};

/**
 * Extract the unique Google Maps identifier of a place from a URL.
 *
 * Google stores it either as a hex feature id (`!1s0x...:0x...`) or as a
 * `cid` query parameter. Returns a lowercase value so two links of the same
 * place always compare equal.
 */
export const extractPlaceId = (value?: string | null): string | null => {
  if (!value) return null;
  const hex = value.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (hex) return hex[1].toLowerCase();
  const cid = value.match(/[?&]cid=([0-9a-fA-F]+|\d+)/);
  if (cid) return cid[1].toLowerCase();
  const feature = value.match(/(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  return feature ? feature[1].toLowerCase() : null;
};

/** Host + path of a Maps link, ignoring protocol, query and trailing slash. */
export const normalizeMapsLink = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const path = url.pathname.replace(/\/+$/, '');
    return `${host}${path}`;
  } catch {
    const trimmed = value.trim().replace(/^https?:\/\/(www\.)?/i, '');
    return trimmed ? trimmed.replace(/\/+$/, '').toLowerCase() : null;
  }
};

/** True when both links point at the same place (by place id or by path). */
export const mapsLinksMatch = (a?: string | null, b?: string | null): boolean => {
  const placeA = extractPlaceId(a);
  const placeB = extractPlaceId(b);
  if (placeA && placeB) return placeA === placeB;

  const linkA = normalizeMapsLink(a);
  const linkB = normalizeMapsLink(b);
  return Boolean(linkA && linkB && linkA === linkB);
};
