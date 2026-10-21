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
