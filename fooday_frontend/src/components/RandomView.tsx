'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ChevronRight,
  Crosshair,
  Dices,
  Loader2,
  RotateCw,
  Star,
} from 'lucide-react';
import { useFoods, foodHasCategory, FoodCategory, Food } from '@/hooks/useFoods';
import { useReviewStats } from '@/hooks/useReviewStats';
import { useEmojiRain } from '@/hooks/useEmojiRain';
import { useFunEffects } from '@/hooks/useFunEffects';
import { useTranslation } from '@/i18n/LanguageContext';
import { groupOf, subGroupOf, type DishSubId } from '@/lib/taxonomy';
import { buildReel, buildSpinReel } from '@/lib/reel';
import {
  PRICE_SLIDER_MAX,
  PRICE_SLIDER_STEP,
  estimateDishPrice,
  formatSliderPrice,
  priceToSlider,
  sliderToPrice,
} from '@/lib/price';
import {
  findNearestBranch,
  formatDistance,
  getAllBranches,
  resolveBranchCoords,
  useUserLocation,
} from '@/lib/geo';
import DishDetailModal from './DishDetailModal';
import EmojiRain from './EmojiRain';

interface RandomViewProps {
  onNavigateToChat: (initialMsg?: string) => void;
}

type Rarity = 'blue' | 'purple' | 'pink' | 'gold';

const SPIN_MS = 5200;

function rarityOf(rating: number): Rarity {
  if (rating >= 4.6) return 'gold';
  if (rating >= 4.3) return 'pink';
  if (rating >= 4.0) return 'purple';
  return 'blue';
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

/** Compact price label: `40k`. */
function formatPrice(price: number): string {
  if (price >= 1000) {
    const k = price / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(0)}k`;
  }
  return `${price}`;
}

/** The real catalog price when known, otherwise the text-based estimate. */
function priceOf(food: Food): { value: number; estimated: boolean } {
  const value = food.price;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return { value, estimated: false };
  }
  return { value: estimateDishPrice(food), estimated: true };
}

/** `~40k` = estimated (the place has no price yet), `40k` = real price. */
function formatFoodPrice(food: Food): string {
  const { value, estimated } = priceOf(food);
  return `${estimated ? '~' : ''}${formatPrice(value)}`;
}

/** The three chips the roulette spins inside: đồ ăn / đồ uống / ăn vặt. */
type RandomKind = FoodCategory;

const RANDOM_KINDS: { id: RandomKind; icon: string }[] = [
  { id: 'Foods', icon: '🍚' },
  { id: 'Drinks', icon: '🥤' },
  { id: 'Snacks', icon: '🍿' },
];

/** Key used for dishes the taxonomy cannot name yet. */
const OTHER_TYPE = 'other';

/**
 * One dish *type* ("Cơm", "Phở", "Trà sữa"…) and every restaurant serving it.
 * The roulette spins on the type — never on a single restaurant's dish — so the
 * result is "what to eat" and the places are listed afterwards, closest first.
 */
interface DishGroup {
  key: string;
  name: string;
  image_url: string;
  categories: FoodCategory[];
  /** One row per restaurant that serves this type of dish. */
  places: Food[];
  /** Best rating among the places serving it. */
  rating: number;
  minPrice: number;
  maxPrice: number;
  /** True when no place of the group has a real price yet. */
  estimated: boolean;
}

/**
 * The chip + dish type of a catalog row. Rows the taxonomy cannot name still
 * belong to the category their contributor picked, so nothing vanishes from
 * the reel.
 */
function typeOf(food: Food): { kind: RandomKind; key: string } {
  const group = groupOf(food);
  if (group === 'uong') return { kind: 'Drinks', key: subGroupOf(food, group) ?? OTHER_TYPE };
  if (group === 'anVat') return { kind: 'Snacks', key: subGroupOf(food, group) ?? OTHER_TYPE };
  if (group) return { kind: 'Foods', key: subGroupOf(food, group) ?? OTHER_TYPE };
  if (foodHasCategory(food, 'Drinks')) return { kind: 'Drinks', key: OTHER_TYPE };
  if (foodHasCategory(food, 'Snacks')) return { kind: 'Snacks', key: OTHER_TYPE };
  return { kind: 'Foods', key: OTHER_TYPE };
}

/** Prices of a group: real prices when any exist, estimates as a fallback. */
function priceValues(places: Food[]): { values: number[]; estimated: boolean } {
  const real = places
    .map((place) => place.price)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  if (real.length > 0) return { values: real, estimated: false };
  return { values: places.map((place) => priceOf(place).value), estimated: true };
}

/** Keep one row per restaurant — the best matching dish of that restaurant. */
function bestPlacePerRestaurant(places: Food[]): Food[] {
  const byRestaurant = new Map<string, Food>();
  for (const place of places) {
    const key = normalize(place.restaurant).trim() || `id:${place.id}`;
    const current = byRestaurant.get(key);
    if (!current) {
      byRestaurant.set(key, place);
      continue;
    }
    const hasRealPrice = typeof place.price === 'number' && place.price > 0;
    const currentHasRealPrice = typeof current.price === 'number' && current.price > 0;
    if (hasRealPrice !== currentHasRealPrice ? hasRealPrice : place.rating > current.rating) {
      byRestaurant.set(key, place);
    }
  }
  return Array.from(byRestaurant.values());
}

function buildDishGroups(
  items: Food[],
  kind: RandomKind,
  labelOf: (key: string) => string,
): DishGroup[] {
  const byType = new Map<string, Food[]>();
  for (const item of items) {
    const type = typeOf(item);
    if (type.kind !== kind) continue;
    const list = byType.get(type.key);
    if (list) list.push(item);
    else byType.set(type.key, [item]);
  }

  const groups: DishGroup[] = [];
  for (const [key, matches] of byType) {
    const places = bestPlacePerRestaurant(matches);
    if (places.length === 0) continue;
    const { values, estimated } = priceValues(places);
    const best = places.reduce(
      (acc, place) => (place.rating > acc.rating ? place : acc),
      places[0],
    );
    groups.push({
      key,
      name: labelOf(key),
      image_url: best.image_url,
      categories: [kind],
      places,
      rating: Math.max(...places.map((place) => place.rating)),
      minPrice: Math.min(...values),
      maxPrice: Math.max(...values),
      estimated,
    });
  }

  // Types with the most choices first, best rated as the tie-breaker.
  return groups.sort((a, b) => b.places.length - a.places.length || b.rating - a.rating);
}

/** `40k` for a single price, `15k – 25k` for a range, `~` when estimated. */
function formatGroupPrice(group: DishGroup): string {
  const min = formatPrice(group.minPrice);
  const max = formatPrice(group.maxPrice);
  const range = min === max ? min : `${min} – ${max}`;
  return `${group.estimated ? '~' : ''}${range}`;
}

export default function RandomView({ onNavigateToChat }: RandomViewProps) {
  const { t, lang } = useTranslation();
  const { foods } = useFoods();
  const { ratingOf } = useReviewStats();
  const { bursts, trigger: triggerRain } = useEmojiRain();
  const { enabled: funEnabled } = useFunEffects();
  const { coords } = useUserLocation();
  const [kind, setKind] = useState<RandomKind>('Foods');
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [reel, setReel] = useState<DishGroup[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<DishGroup | null>(null);
  const [selectedDish, setSelectedDish] = useState<Food | null>(null);
  const [offset, setOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [placesExpanded, setPlacesExpanded] = useState(false);
  // Bumped whenever a shortened Maps link is expanded into real coordinates,
  // so the distance computation runs again with the fresh data.
  const [coordsRevision, setCoordsRevision] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  // Every dish type of the selected chip (đồ ăn / đồ uống / ăn vặt) with the
  // restaurants serving it — the roulette picks the type, not a single place.
  const pool = useMemo(() => {
    const otherLabel = t.random.otherTypes[kind];
    const labelOf = (key: string) =>
      key === OTHER_TYPE
        ? otherLabel
        : (t.home.subgroups[key as DishSubId] ?? otherLabel);
    return buildDishGroups(foods, kind, labelOf);
  }, [foods, kind, t]);

  const initialReel = useMemo(() => buildReel(pool), [pool]);
  const track = reel.length > 0 ? reel : initialReel;

  useEffect(
    () => () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      if (audioRef.current) void audioRef.current.close();
    },
    [],
  );

  const playTicks = () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const startAt = ctx.currentTime + 0.05;
      let at = 0;
      let interval = 0.055;
      for (let i = 0; i < 48 && at < SPIN_MS / 1000 - 0.4; i += 1) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 820 + Math.random() * 320;
        gain.gain.setValueAtTime(0.0001, startAt + at);
        gain.gain.exponentialRampToValueAtTime(0.04, startAt + at + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + at + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt + at);
        osc.stop(startAt + at + 0.06);
        at += interval;
        interval *= 1.13;
      }
    } catch {
      /* Web Audio is unavailable — spin silently. */
    }
  };

  const spinCase = () => {
    if (spinning || pool.length === 0) return;
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);

    const winner = pool[Math.floor(Math.random() * pool.length)];
    const winnerIndex = 32 + Math.floor(Math.random() * 7);
    const nextReel = buildSpinReel(pool, winner, winnerIndex);

    setResult(null);
    setSelectedDish(null);
    setPlacesExpanded(false);
    setReel(nextReel);
    setOffset(0);
    setIsTransitioning(false);
    setSpinning(true);
    playTicks();

    startTimerRef.current = setTimeout(() => {
      const containerW = containerRef.current?.clientWidth || 360;
      const isMobile = window.innerWidth < 640;
      const cardW = isMobile ? 140 : 170;
      const gap = 12;
      const step = cardW + gap;
      const randomShift = (Math.random() - 0.5) * (cardW * 0.6);
      const targetX = winnerIndex * step + cardW / 2 - containerW / 2 + randomShift;
      setIsTransitioning(true);
      setOffset(-targetX);
    }, 50);

    endTimerRef.current = setTimeout(() => {
      setSpinning(false);
      setResult(winner);
      // Celebrate the winning pick with a Messenger-style emoji rain.
      if (funEnabled) triggerRain(winner.categories, 'full');
    }, 50 + SPIN_MS);
  };

  const resetSpin = () => {
    setResult(null);
    setSelectedDish(null);
    setPlacesExpanded(false);
    setReel([]);
    setOffset(0);
    setIsTransitioning(false);
  };

  const selectKind = (next: RandomKind) => {
    if (spinning) return;
    setKind(next);
    resetSpin();
  };

  // The price only filters the restaurants of the dish already revealed, so
  // moving the slider never re-spins.
  const selectMaxPrice = (value: number | null) => {
    if (spinning) return;
    setMaxPrice(value);
    setPlacesExpanded(false);
  };

  const winnerBranches = useMemo(
    () =>
      result
        ? result.places.flatMap((place) => getAllBranches(place, t.branches.mainBranch))
        : [],
    [result, t.branches.mainBranch],
  );

  // The shortened Google Maps links hide their coordinates: expand them in the
  // background so the closest place can be picked automatically.
  useEffect(() => {
    if (!coords || winnerBranches.length === 0) return;
    let cancelled = false;
    void resolveBranchCoords(winnerBranches).then((resolved) => {
      if (!cancelled && resolved) setCoordsRevision((revision) => revision + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [winnerBranches, coords]);

  // Nearest first when the GPS position is known, best rated otherwise.
  const rankedPlaces = useMemo(() => {
    if (!result) return [];
    void coordsRevision;
    return result.places
      .filter((place) => maxPrice === null || priceOf(place).value <= maxPrice)
      .map((place) => {
        const nearest = findNearestBranch(
          getAllBranches(place, t.branches.mainBranch),
          coords,
        );
        return {
          food: place,
          distanceKm: nearest?.distanceKm ?? null,
          rating: ratingOf(place.id, place.rating),
        };
      })
      .sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) {
          return a.distanceKm - b.distanceKm;
        }
        if (a.distanceKm !== null) return -1;
        if (b.distanceKm !== null) return 1;
        return b.rating - a.rating;
      });
  }, [result, maxPrice, coords, coordsRevision, t.branches.mainBranch, ratingOf]);

  const nearestPlace = rankedPlaces[0] ?? null;
  // The closest place is promoted into the winner card, so the list below
  // only carries the remaining restaurants.
  const otherPlaces = rankedPlaces.slice(1);
  const visiblePlaces = placesExpanded ? otherPlaces : otherPlaces.slice(0, 3);
  const winnerRating = useMemo(
    () =>
      result
        ? Math.max(...result.places.map((place) => ratingOf(place.id, place.rating)))
        : 0,
    [result, ratingOf],
  );

  return (
    <div className="random animate-fade-in">
      <header className="rnd-head">
        <span className="eyebrow">
          <Dices size={13} /> {t.random.eyebrow}
        </span>
        <h1 className="rnd-title">{t.random.title}</h1>
      </header>

      <div className="rnd-chips" role="tablist" aria-label={t.random.categoryLabel}>
        {RANDOM_KINDS.map((option) => (
          <button
            key={option.id}
            className={`chip mood-chip ${kind === option.id ? 'active' : ''}`}
            onClick={() => selectKind(option.id)}
            disabled={spinning}
            aria-pressed={kind === option.id}
          >
            <span className="mood-icon">{option.icon}</span>
            {t.random.kinds[option.id]}
          </button>
        ))}
      </div>

      <div className="roulette-box" ref={containerRef} aria-live="polite">
        {track.length > 0 ? (
          <div
            className="roulette-track"
            style={{
              transform: `translate3d(${offset}px, 0, 0)`,
              transition: isTransitioning
                ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.15, 1)`
                : 'none',
            }}
          >
            {track.map((group, i) => (
              <div key={`${group.key}-${i}`} className={`roulette-card r-${rarityOf(group.rating)}`}>
                <div className="rc-media">
                  <Image
                    src={group.image_url}
                    alt={group.name}
                    fill
                    sizes="170px"
                    loading="eager"
                    className="rc-img"
                    style={{ objectFit: 'cover' }}
                  />
                  <span className="rc-cat">{t.random.kinds[kind]}</span>
                  <span className="rc-price" title={group.estimated ? t.random.priceEstimated : undefined}>
                    {formatGroupPrice(group)}
                  </span>
                </div>
                <div className="rc-body">
                  <p className="rc-name">{group.name}</p>
                  <span className="rc-place">{t.random.placesCount(group.places.length)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="roulette-empty">
            <p>{t.random.empty}</p>
            {kind !== 'Foods' && (
              <button className="mini-act" onClick={() => selectKind('Foods')}>
                {t.random.showAllFoods}
              </button>
            )}
          </div>
        )}
        <div className="roulette-fade fade-left" />
        <div className="roulette-fade fade-right" />
        <div className="center-ticker" />
      </div>

      {result && (
        <div className="winner-block">
          <p className="winner-congrats">{t.random.congrats}</p>
          <div className="winner-card">
            <div className="winner-top">
              <div className="winner-media">
                <Image
                  src={result.image_url}
                  alt={result.name}
                  fill
                  sizes="120px"
                  className="winner-img"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="winner-info">
                <h2 className="winner-name">{result.name}</h2>
                <p className="winner-place">{t.random.placesCount(result.places.length)}</p>
                <span className="winner-rating">
                  <Star size={14} fill="var(--star)" color="var(--star)" />
                  {winnerRating.toFixed(1)}
                </span>
                <span
                  className="winner-price"
                  title={result.estimated ? t.random.priceEstimated : undefined}
                >
                  {formatGroupPrice(result)}
                </span>
              </div>
            </div>

            {nearestPlace && (
              <button
                type="button"
                className="winner-nearest"
                onClick={() => setSelectedDish(nearestPlace.food)}
              >
                <span className="winner-nearest-thumb">
                  <Image
                    src={nearestPlace.food.image_url}
                    alt={nearestPlace.food.restaurant}
                    fill
                    sizes="48px"
                    style={{ objectFit: 'cover' }}
                  />
                </span>
                <span className="winner-nearest-body">
                  <span className="winner-nearest-name">{nearestPlace.food.restaurant}</span>
                  <span className="winner-nearest-meta">
                    <Star size={12} fill="var(--star)" color="var(--star)" />
                    {nearestPlace.rating.toFixed(1)}
                    {nearestPlace.distanceKm !== null && (
                      <span>· {formatDistance(nearestPlace.distanceKm, lang)}</span>
                    )}
                    <span className="winner-nearest-price">
                      {formatFoodPrice(nearestPlace.food)}
                    </span>
                  </span>
                </span>
                <ChevronRight size={16} className="winner-nearest-chev" />
              </button>
            )}
          </div>

          <div className="price-block result-price">
            <div className="price-slider-head">
              <span className="price-label">{t.random.priceLabel}</span>
              <span className="price-slider-value">
                {maxPrice === null
                  ? t.random.priceAll
                  : `≤ ${formatSliderPrice(maxPrice)}`}
              </span>
            </div>
            <input
              type="range"
              className="price-slider"
              min={0}
              max={PRICE_SLIDER_MAX}
              step={PRICE_SLIDER_STEP}
              value={maxPrice === null ? 0 : priceToSlider(maxPrice)}
              onChange={(e) => {
                const raw = Number(e.target.value);
                selectMaxPrice(raw <= 0 ? null : sliderToPrice(raw));
              }}
              aria-label={t.random.priceLabel}
              aria-valuetext={
                maxPrice === null ? t.random.priceAll : formatSliderPrice(maxPrice)
              }
            />
            <div className="price-slider-scale" aria-hidden="true">
              <span>{t.random.priceAll}</span>
              <span>50k</span>
              <span>100k</span>
              <span>200k</span>
              <span>1m+</span>
            </div>
          </div>

          {(rankedPlaces.length === 0 || otherPlaces.length > 0) && (
          <div className="place-list">
            <div className="place-list-head">
              <span>{t.random.nearestTitle}</span>
              {!coords && (
                <span className="place-hint">
                  <Crosshair size={12} /> {t.random.enableLocation}
                </span>
              )}
            </div>

            {rankedPlaces.length === 0 ? (
              <div className="places-empty">
                <p>{t.random.noPriceMatch}</p>
                <div className="places-empty-actions">
                  <button className="mini-act" onClick={() => selectMaxPrice(null)}>
                    {t.random.showAllPrices}
                  </button>
                  <button className="mini-act" onClick={spinCase}>
                    {t.random.changeDish}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <ul className="places">
                  {visiblePlaces.map(({ food: place, distanceKm, rating }) => (
                    <li key={place.id}>
                      <button className="place-row" onClick={() => setSelectedDish(place)}>
                        <span className="place-thumb">
                          <Image
                            src={place.image_url}
                            alt={place.restaurant}
                            fill
                            sizes="56px"
                            className="place-img"
                            style={{ objectFit: 'cover' }}
                          />
                        </span>
                        <span className="place-main">
                          <span className="place-name">{place.restaurant}</span>
                          {normalize(place.name) !== normalize(result.name) && (
                            <span className="place-dish">{place.name}</span>
                          )}
                          <span className="place-meta">
                            <Star size={12} fill="var(--star)" color="var(--star)" />
                            {rating.toFixed(1)}
                            {distanceKm !== null && (
                              <span className="place-distance">
                                · {formatDistance(distanceKm, lang)}
                              </span>
                            )}
                            <span className="place-price">{formatFoodPrice(place)}</span>
                          </span>
                        </span>
                        <ChevronRight size={16} className="place-chev" />
                      </button>
                    </li>
                  ))}
                </ul>
                {otherPlaces.length > 3 && (
                  <button
                    className="more-places"
                    onClick={() => setPlacesExpanded((value) => !value)}
                  >
                    {placesExpanded
                      ? t.random.showLessPlaces
                      : t.random.morePlaces(otherPlaces.length - 3)}
                  </button>
                )}
              </>
            )}
          </div>
          )}
        </div>
      )}

      <button
        className={`spin-btn ${spinning ? 'is-spinning' : ''}`}
        onClick={spinCase}
        disabled={spinning || pool.length === 0}
      >
        {spinning ? (
          <>
            <Loader2 size={18} className="spin-ico" /> {t.random.spinningCase}
          </>
        ) : result ? (
          <>
            <RotateCw size={18} /> {t.random.spinAgain}
          </>
        ) : (
          <>
            <Dices size={18} /> {t.random.spinCase}
          </>
        )}
      </button>

      {selectedDish && (
        <DishDetailModal
          dish={selectedDish}
          onClose={() => setSelectedDish(null)}
          onNavigateToChat={onNavigateToChat}
        />
      )}

      <EmojiRain bursts={bursts} />

      <style jsx>{`
        .random {
          padding: clamp(20px, 6vw, 32px) clamp(16px, 5vw, 20px) 40px;
          max-width: 640px;
          margin-inline: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .rnd-head {
          text-align: center;
          margin-bottom: 18px;
        }
        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--primary-strong);
        }
        .rnd-title {
          font-size: clamp(24px, 7.5vw, 30px);
          font-weight: 800;
          color: var(--text);
          line-height: 1.1;
          margin-top: 2px;
        }
        .rnd-chips {
          position: relative;
          z-index: 2;
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 22px;
          background: var(--bg);
        }
        .rnd-chips .chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 8px 13px;
          font-size: 13px;
        }
        .mood-icon {
          font-size: 0.9375rem;
          line-height: 1;
        }
        .price-block {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 100%;
          background: var(--bg);
        }
        .result-price {
          margin: 16px 0 0;
        }
        .result-price .price-label {
          text-align: left;
        }
        .price-label {
          display: block;
          margin-bottom: 0;
          text-align: center;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .price-slider-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .price-slider-value {
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--primary-strong);
          font-variant-numeric: tabular-nums;
        }
        /* Volume-style budget slider: light orange left, deep orange right. */
        .price-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 8px;
          margin: 4px 0 2px;
          border-radius: 999px;
          background: transparent;
          outline: none;
          cursor: pointer;
        }
        .price-slider::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            #ffc79e 0%,
            #ff9a5c 32%,
            #ff6b35 62%,
            #c2410c 84%,
            #8f2d05 100%
          );
        }
        .price-slider::-moz-range-track {
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            #ffc79e 0%,
            #ff9a5c 32%,
            #ff6b35 62%,
            #c2410c 84%,
            #8f2d05 100%
          );
        }
        .price-slider::-moz-range-progress {
          height: 8px;
          border-radius: 999px;
          background: transparent;
        }
        .price-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 3px solid var(--primary);
          background: #fff;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
          cursor: grab;
        }
        .price-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
        }
        .price-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 3px solid var(--primary);
          background: #fff;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
          cursor: grab;
        }
        .price-slider:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 4px;
        }
        .price-slider-scale {
          display: flex;
          justify-content: space-between;
          font-size: 10.5px;
          font-weight: 600;
          color: var(--text-faint);
        }
        .chip {
          padding: 9px 18px;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: transform var(--dur-fast) var(--ease),
            background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
        }
        .chip:hover:not(:disabled):not(.active) {
          transform: translateY(-2px);
          border-color: var(--primary);
          color: var(--primary-strong);
        }
        .chip.active {
          background: var(--grad-primary);
          color: var(--primary-contrast);
          border-color: transparent;
          box-shadow: var(--shadow-primary);
        }
        .chip:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .roulette-box {
          position: relative;
          width: 100%;
          overflow: hidden;
          isolation: isolate;
          padding-block: 18px;
          border-radius: var(--r-lg);
          border: 1px solid rgba(234, 179, 8, 0.35);
          background: linear-gradient(180deg, #241c16 0%, #15110e 55%, #0c0907 100%);
          box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.65),
            inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 14px 34px rgba(0, 0, 0, 0.28);
        }
        .roulette-box::before {
          content: '';
          position: absolute;
          inset: 5px;
          border-radius: calc(var(--r-lg) - 5px);
          border: 1px solid rgba(234, 179, 8, 0.16);
          pointer-events: none;
          z-index: 5;
        }
        .roulette-track {
          display: flex;
          gap: 12px;
          width: max-content;
          will-change: transform;
        }
        .roulette-card {
          flex: 0 0 auto;
          width: 170px;
          border-radius: 14px;
          overflow: hidden;
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
        }
        .rc-media {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          background: var(--surface-2);
        }
        .rc-img {
          object-fit: cover;
        }
        .rc-cat {
          position: absolute;
          top: 7px;
          left: 7px;
          padding: 3px 8px;
          border-radius: var(--r-full);
          background: rgba(12, 9, 7, 0.72);
          color: #f8fafc;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.02em;
          backdrop-filter: blur(4px);
        }
        .rc-price {
          position: absolute;
          top: 7px;
          right: 7px;
          max-width: calc(100% - 14px);
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          padding: 3px 8px;
          border-radius: var(--r-full);
          background: var(--grad-primary);
          color: var(--primary-contrast);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.02em;
          box-shadow: var(--shadow-primary);
        }
        .rc-body {
          padding: 8px 10px 10px;
        }
        .rc-name {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rc-place {
          display: block;
          margin-top: 2px;
          font-size: 11px;
          color: var(--text-soft);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .r-blue {
          border-color: rgba(59, 130, 246, 0.65);
          box-shadow: inset 0 0 18px rgba(59, 130, 246, 0.16);
        }
        .r-purple {
          border-color: rgba(168, 85, 247, 0.7);
          box-shadow: inset 0 0 18px rgba(168, 85, 247, 0.18);
        }
        .r-pink {
          border-color: rgba(236, 72, 153, 0.7);
          box-shadow: inset 0 0 18px rgba(236, 72, 153, 0.2);
        }
        .r-gold {
          border-color: rgba(234, 179, 8, 0.85);
          box-shadow: inset 0 0 18px rgba(234, 179, 8, 0.22);
        }
        .roulette-fade {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 72px;
          pointer-events: none;
          z-index: 3;
        }
        .fade-left {
          left: 0;
          background: linear-gradient(to right, #15110e 12%, rgba(21, 17, 14, 0));
        }
        .fade-right {
          right: 0;
          background: linear-gradient(to left, #15110e 12%, rgba(21, 17, 14, 0));
        }
        .center-ticker {
          position: absolute;
          top: 10px;
          bottom: 10px;
          left: 50%;
          width: 2px;
          margin-left: -1px;
          background: linear-gradient(
            to bottom,
            #fbbf24 0%,
            rgba(251, 191, 36, 0.12) 30%,
            rgba(251, 191, 36, 0.12) 70%,
            #fbbf24 100%
          );
          box-shadow: 0 0 12px rgba(251, 191, 36, 0.75);
          pointer-events: none;
          z-index: 4;
        }
        .center-ticker::before,
        .center-ticker::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
        }
        .center-ticker::before {
          top: 0;
          border-top: 10px solid #fbbf24;
          filter: drop-shadow(0 2px 4px rgba(251, 191, 36, 0.6));
        }
        .center-ticker::after {
          bottom: 0;
          border-bottom: 10px solid #fbbf24;
          filter: drop-shadow(0 -2px 4px rgba(251, 191, 36, 0.6));
        }
        .roulette-empty {
          padding: 46px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          text-align: center;
          color: rgba(247, 244, 238, 0.65);
          font-size: 14px;
        }
        .winner-block {
          position: relative;
          width: 100%;
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: fadeUp 0.45s var(--ease);
        }
        .winner-block::before {
          content: '';
          position: absolute;
          top: -28px;
          left: 50%;
          transform: translateX(-50%);
          width: min(100%, 420px);
          height: 220px;
          background: radial-gradient(
            ellipse at top,
            rgba(251, 191, 36, 0.22),
            transparent 68%
          );
          pointer-events: none;
          z-index: 0;
        }
        .winner-congrats,
        .winner-card,
        .result-price,
        .place-list {
          position: relative;
          z-index: 1;
        }
        .winner-congrats {
          font-size: 13px;
          font-weight: 700;
          color: var(--primary-strong);
          text-align: center;
          margin-bottom: 10px;
        }
        .winner-card {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
          padding: 12px;
          border-radius: var(--r-lg);
          background: var(--surface);
          border: 1px solid rgba(234, 179, 8, 0.7);
          box-shadow: 0 0 30px rgba(234, 179, 8, 0.5), var(--shadow-md);
          animation: popIn 0.45s var(--ease);
        }
        .winner-top {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .winner-media {
          position: relative;
          flex: 0 0 auto;
          width: 96px;
          height: 96px;
          border-radius: 12px;
          overflow: hidden;
          background: var(--surface-2);
        }
        .winner-img {
          object-fit: cover;
        }
        .winner-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .winner-name {
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .winner-place {
          font-size: 13px;
          color: var(--text-soft);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .winner-rating {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          margin-top: 8px;
        }
        .winner-price {
          display: inline-block;
          margin-top: 6px;
          padding: 2px 10px;
          border-radius: var(--r-full);
          background: var(--grad-primary);
          color: var(--primary-contrast);
          font-size: 12px;
          font-weight: 800;
          box-shadow: var(--shadow-primary);
        }
        /* The closest place lives inside the winner card. */
        .winner-nearest {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-radius: var(--r-md);
          border: 1px solid var(--border);
          background: var(--surface-2);
          text-align: left;
          cursor: pointer;
          transition: border-color var(--dur-fast) var(--ease),
            transform var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
        }
        .winner-nearest:hover {
          transform: translateY(-1px);
          border-color: var(--primary);
          box-shadow: var(--shadow-sm);
        }
        .winner-nearest-thumb {
          position: relative;
          flex: 0 0 auto;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          overflow: hidden;
          background: var(--surface);
        }
        .winner-nearest-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .winner-nearest-name {
          font-size: 13px;
          font-weight: 800;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .winner-nearest-meta {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          color: var(--text-soft);
        }
        .winner-nearest-price {
          margin-left: 2px;
          padding: 1px 7px;
          border-radius: var(--r-full);
          background: rgba(234, 179, 8, 0.16);
          color: var(--primary-strong);
          font-size: 11px;
          font-weight: 800;
        }
        .winner-nearest-chev {
          flex: 0 0 auto;
          color: var(--text-faint);
        }
        .place-list {
          width: 100%;
          margin-top: 14px;
          padding: 12px;
          border-radius: var(--r-lg);
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
        }
        .place-list-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .place-hint {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0;
          text-transform: none;
          color: var(--primary-strong);
        }
        .places {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .place-row {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 30px 8px 8px;
          border-radius: var(--r-md);
          border: 1px solid var(--border);
          background: var(--surface-2);
          text-align: left;
          cursor: pointer;
          transition: border-color var(--dur-fast) var(--ease),
            transform var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
        }
        .place-row:hover {
          transform: translateY(-1px);
          border-color: var(--primary);
          box-shadow: var(--shadow-sm);
        }
        .place-thumb {
          position: relative;
          flex: 0 0 auto;
          width: 46px;
          height: 46px;
          border-radius: 10px;
          overflow: hidden;
          background: var(--surface);
        }
        .place-img {
          object-fit: cover;
        }
        .place-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .place-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .place-meta {
          display: inline-flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px;
          font-size: 11.5px;
          color: var(--text-soft);
        }
        .place-dish {
          display: block;
          font-size: 11px;
          color: var(--text-faint);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .place-distance {
          color: var(--text-soft);
        }
        .place-price {
          margin-left: 2px;
          padding: 1px 7px;
          border-radius: var(--r-full);
          background: rgba(234, 179, 8, 0.16);
          color: var(--primary-strong);
          font-size: 11px;
          font-weight: 800;
        }
        .place-chev {
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-faint);
        }
        .places-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 10px 4px 6px;
          text-align: center;
          font-size: 12.5px;
          color: var(--text-soft);
        }
        .places-empty-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
        }
        .mini-act {
          padding: 8px 12px;
          border-radius: var(--r-full);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--primary-strong);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: transform var(--dur-fast) var(--ease),
            border-color var(--dur-fast) var(--ease);
        }
        .mini-act:hover {
          transform: translateY(-1px);
          border-color: var(--primary);
        }
        .more-places {
          width: 100%;
          margin-top: 8px;
          padding: 8px;
          border-radius: var(--r-full);
          border: 1px dashed var(--border-strong);
          background: transparent;
          color: var(--text-soft);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .more-places:hover {
          border-color: var(--primary);
          color: var(--primary-strong);
        }
        .spin-btn {
          margin-top: 18px;
          width: 100%;
          height: 52px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: var(--r-full);
          border: none;
          background: var(--grad-primary);
          color: var(--primary-contrast);
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: var(--shadow-primary);
          transition: transform var(--dur-fast) var(--ease), opacity var(--dur-fast) var(--ease);
        }
        .spin-btn:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .spin-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .spin-btn:disabled {
          opacity: 0.65;
          cursor: default;
        }
        .spin-ico {
          animation: spin 0.9s linear infinite;
        }
        @media (max-width: 639px) {
          .roulette-card {
            width: 140px;
          }
          .roulette-fade {
            width: 52px;
          }
          .winner-media {
            width: 82px;
            height: 82px;
          }
          .rnd-chips {
            gap: 7px;
          }
          .rnd-chips .chip {
            padding: 7px 10px;
            font-size: 12px;
          }
          .place-list-head {
            align-items: flex-start;
            flex-direction: column;
            gap: 4px;
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes popIn {
          from {
            opacity: 0;
            transform: scale(0.94);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
