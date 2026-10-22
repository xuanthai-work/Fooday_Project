'use client';

import { useSyncExternalStore } from 'react';
import type { Branch, Food } from '@/hooks/useFoods';

export type { Branch };

/** A geographic coordinate pair. */
export interface Coords {
  lat: number;
  lng: number;
}

/** Mean Earth radius in kilometres. */
const EARTH_RADIUS_KM = 6371;

/**
 * Coordinate shapes used by Google Maps links:
 *  - ...!3d<lat>!4d<lng>     (full place link)
 *  - ...!4d<lng>!3d<lat>     (same, reversed order)
 *  - @<lat>,<lng>            (map viewport)
 *  - ?ll=<lat>,<lng>         (place link)
 */
const COORD_PATTERNS: Array<{ re: RegExp; latFirst: boolean }> = [
  { re: /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, latFirst: true },
  { re: /!4d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/, latFirst: false },
  { re: /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, latFirst: true },
  { re: /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, latFirst: true },
];

/** Pull the latitude/longitude out of a Google Maps link. */
export function extractCoordsFromUrl(url?: string | null): Coords | null {
  if (!url) return null;
  const value = url.trim();
  if (!value) return null;

  for (const { re, latFirst } of COORD_PATTERNS) {
    const match = value.match(re);
    if (!match) continue;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) continue;
    const lat = latFirst ? first : second;
    const lng = latFirst ? second : first;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    return { lat, lng };
  }
  return null;
}

/** Great-circle distance between two points, in kilometres (Haversine). */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_KM * c;
}

/** Human friendly distance: `850m` under a kilometre, `1.2 km` above it. */
export function formatDistance(km: number, lang: 'vi' | 'en' = 'vi'): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const meters = Math.round(km * 1000);
    const locale = lang === 'en' ? 'en-US' : 'vi-VN';
    return `${new Intl.NumberFormat(locale).format(meters)}m`;
  }
  return `${km.toFixed(1)} km`;
}

/** Normalise the `branches` jsonb column into a plain array. */
export function parseBranches(value: unknown): Branch[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Branch => Boolean(item) && typeof item === 'object',
    );
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is Branch => Boolean(item) && typeof item === 'object',
        );
      }
    } catch {
      /* not a JSON payload — treat as "no branches" */
    }
  }
  return [];
}

/** True when a branch carries any usable piece of information. */
export function hasBranchContent(branch: Branch): boolean {
  return Boolean(branch.address || branch.google_map_url || branch.name);
}

/**
 * Every outlet of a restaurant: the main branch (built from the dish fields)
 * followed by the extra branches stored in `food.branches`.
 */
export function getAllBranches(
  food: Food,
  mainBranchName = 'Cơ sở chính',
): Branch[] {
  const main: Branch = {
    address: food.address || '',
    google_map_url: food.google_map_url || '',
  };

  const branches: Branch[] = [];
  if (hasBranchContent(main)) {
    branches.push({ ...main, name: mainBranchName });
  }
  for (const extra of parseBranches(food.branches)) {
    if (!hasBranchContent(extra)) continue;
    branches.push({ ...extra, address: extra.address || '' });
  }
  return branches;
}

/* -------------------------------------------------------------------------- */
/* Coordinates resolved from Google Maps links                                 */
/* -------------------------------------------------------------------------- */

/** Session-storage prefix for the resolved link coordinates. */
const URL_COORDS_PREFIX = 'fooday:url-coords:';

/** In-memory cache of the coordinates resolved from a Maps link. */
const urlCoordsCache = new Map<string, Coords>();

/** Read the cached coordinates of a Maps link (memory first, then storage). */
function readCachedUrlCoords(url: string): Coords | null {
  const inMemory = urlCoordsCache.get(url);
  if (inMemory) return inMemory;

  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(URL_COORDS_PREFIX + url);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Coords>;
    if (typeof parsed?.lat !== 'number' || typeof parsed?.lng !== 'number') {
      return null;
    }
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return null;
    const coords = { lat: parsed.lat, lng: parsed.lng };
    urlCoordsCache.set(url, coords);
    return coords;
  } catch {
    /* storage may be unavailable */
    return null;
  }
}

/** Remember the coordinates of a Maps link for the rest of the session. */
function cacheUrlCoords(url: string, coords: Coords): void {
  urlCoordsCache.set(url, coords);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      URL_COORDS_PREFIX + url,
      JSON.stringify(coords),
    );
  } catch {
    /* storage may be unavailable */
  }
}

/** Coordinates of a branch, when its Google Maps link carries them. */
export function getBranchCoords(branch: Branch): Coords | null {
  // Coordinates stored with the branch always win.
  const { lat, lng } = branch;
  if (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return { lat, lng };
  }

  const url = branch.google_map_url?.trim();
  if (!url) return null;

  // A link resolved earlier in this session.
  const cached = readCachedUrlCoords(url);
  if (cached) return cached;

  // A full Google Maps link carries its coordinates in the URL itself.
  const extracted = extractCoordsFromUrl(url);
  if (extracted) {
    cacheUrlCoords(url, extracted);
    return extracted;
  }
  return null;
}

/**
 * Resolve the coordinates of the branches whose Google Maps link hides them
 * (the shortened `maps.app.goo.gl/...` and `goo.gl/...` links).
 *
 * The backend expands the shortened link and the coordinates are then read
 * from the expanded URL. Every resolved link is cached for the session.
 *
 * @returns `true` when at least one new pair of coordinates was resolved.
 */
export async function resolveBranchCoords(branches: Branch[]): Promise<boolean> {
  const targets = branches.filter((branch) => {
    const url = branch.google_map_url?.trim();
    return Boolean(url) && !getBranchCoords(branch);
  });
  if (targets.length === 0) return false;

  let resolvedAny = false;
  await Promise.all(
    targets.map(async (branch) => {
      const url = branch.google_map_url?.trim();
      if (!url) return;
      try {
        const response = await fetch(
          `/api/parse-map-link?url=${encodeURIComponent(url)}`,
        );
        if (!response.ok) return;
        const data = (await response.json()) as { resolved_url?: string | null };
        const coords = extractCoordsFromUrl(data?.resolved_url);
        if (!coords) return;
        cacheUrlCoords(url, coords);
        resolvedAny = true;
      } catch {
        /* the link could not be expanded — the branch simply has no distance */
      }
    }),
  );
  return resolvedAny;
}

/** Distance from the user to a branch, or `null` when it cannot be computed. */
export function distanceToBranch(
  branch: Branch,
  coords: Coords | null,
): number | null {
  if (!coords) return null;
  const target = getBranchCoords(branch);
  if (!target) return null;
  return calculateDistanceKm(coords.lat, coords.lng, target.lat, target.lng);
}

/** The branch closest to the given position, with its distance. */
export function findNearestBranch(
  branches: Branch[],
  coords: Coords | null,
): { branch: Branch; index: number; distanceKm: number } | null {
  if (!coords || branches.length === 0) return null;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < branches.length; i += 1) {
    const distanceKm = distanceToBranch(branches[i], coords);
    if (distanceKm === null) continue;
    if (distanceKm < bestDistance) {
      bestDistance = distanceKm;
      bestIndex = i;
    }
  }
  if (bestIndex < 0) return null;
  return { branch: branches[bestIndex], index: bestIndex, distanceKm: bestDistance };
}

/* -------------------------------------------------------------------------- */
/* User location                                                               */
/* -------------------------------------------------------------------------- */

export interface UserLocationState {
  coords: Coords | null;
  loading: boolean;
  error: string | null;
}

const LOCATION_STORAGE_KEY = 'fooday:user-location';
const IDLE_LOCATION: UserLocationState = { coords: null, loading: false, error: null };

let locationState: UserLocationState = IDLE_LOCATION;
let locationStarted = false;
const locationListeners = new Set<() => void>();

const emitLocation = () => locationListeners.forEach((listener) => listener());

function readCachedCoords(): Coords | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Coords>;
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch {
    /* storage may be unavailable */
  }
  return null;
}

function cacheCoords(coords: Coords): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(coords));
  } catch {
    /* storage may be unavailable */
  }
}

/**
 * Ask the browser for the position once. A denied or unavailable permission is
 * not an error the app has to survive — it simply falls back to "no location".
 */
function requestLocation(): void {
  if (locationStarted) return;
  locationStarted = true;

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    locationState = { coords: null, loading: false, error: 'unsupported' };
    emitLocation();
    return;
  }

  const cached = readCachedCoords();
  if (cached) {
    locationState = { coords: cached, loading: false, error: null };
    emitLocation();
    return;
  }

  locationState = { coords: null, loading: true, error: null };
  emitLocation();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      cacheCoords(coords);
      locationState = { coords, loading: false, error: null };
      emitLocation();
    },
    (error) => {
      locationState = {
        coords: null,
        loading: false,
        error: error?.message || 'denied',
      };
      emitLocation();
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}

function subscribeLocation(callback: () => void): () => void {
  locationListeners.add(callback);
  requestLocation();
  return () => {
    locationListeners.delete(callback);
  };
}

function getLocationSnapshot(): UserLocationState {
  return locationState;
}

function getServerLocationSnapshot(): UserLocationState {
  return IDLE_LOCATION;
}

/**
 * The user's GPS position, shared by every consumer through a tiny external
 * store so the browser only asks for the permission once per session.
 */
export function useUserLocation(): UserLocationState {
  return useSyncExternalStore(
    subscribeLocation,
    getLocationSnapshot,
    getServerLocationSnapshot,
  );
}
