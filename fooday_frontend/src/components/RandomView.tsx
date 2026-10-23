'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ChevronRight,
  Crosshair,
  Dices,
  Heart,
  Loader2,
  RotateCw,
  Sparkles,
  Star,
  Eye,
} from 'lucide-react';
import { useFoods, FOOD_CATEGORIES, FoodCategory, Food, foodHasCategory } from '@/hooks/useFoods';
import { useReviewStats } from '@/hooks/useReviewStats';
import { useFavorites } from '@/hooks/useFavorites';
import { useEmojiRain } from '@/hooks/useEmojiRain';
import { useFunEffects } from '@/hooks/useFunEffects';
import { useTranslation } from '@/i18n/LanguageContext';
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

const REEL_SIZE = 45;
const SPIN_MS = 5200;

function buildReel<T>(pool: T[], size = REEL_SIZE): T[] {
  if (pool.length === 0) return [];
  const out: T[] = [];
  while (out.length < size) {
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out;
}

function rarityOf(rating: number): Rarity {
  if (rating >= 4.6) return 'gold';
  if (rating >= 4.3) return 'pink';
  if (rating >= 4.0) return 'purple';
  return 'blue';
}

/** Every category of a dish (falls back to the legacy single category). */
function foodCategoriesOf(item: Food): FoodCategory[] {
  const list = item.categories ?? [];
  return list.length > 0 ? list : [item.category];
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

/** Fallback price for dishes whose `price` column is still empty. */
function estimatePrice(food: Food): number {
  const text = normalize(`${food.name} ${food.restaurant} ${food.review_note ?? ''} ${food.tag ?? ''}`);
  const noted = text.match(/(\d{2,3})\s*(k|nghin|ngan|\/ng)\b/);
  if (noted) {
    const amount = Number(noted[1]) * 1000;
    if (amount >= 15000 && amount <= 900000) return amount;
  }
  if (/buffet|lau|nuong|bbq|hai san|king bbq|dookki|shogun|manyo|k-pub|k pub/.test(text)) return 249000;
  if (/kfc|lotteria|mcdonald|burger|popeyes|jollibee|pizza|bon chon|don chicken/.test(text)) return 89000;
  if (/banh mi|xien|che |xoi|banh duc|tra sua|cafe|ca phe|coffee|snack/.test(text)) return 40000;
  if (/pho|bun |com |chao|mi |my |hu tieu|banh cuon/.test(text)) return 65000;
  return 70000;
}

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
  return { value: estimatePrice(food), estimated: true };
}

/** `~40k` = estimated (the place has no price yet), `40k` = real price. */
function formatFoodPrice(food: Food): string {
  const { value, estimated } = priceOf(food);
  return `${estimated ? '~' : ''}${formatPrice(value)}`;
}

type PriceTier = 'all' | 'under30' | '30' | '50' | '199' | '299';

const PRICE_TIERS: { id: PriceTier; labelKey: 'priceAll' | 'priceUnder30' | 'price30' | 'price50' | 'price199' | 'price299' }[] = [
  { id: 'all', labelKey: 'priceAll' },
  { id: 'under30', labelKey: 'priceUnder30' },
  { id: '30', labelKey: 'price30' },
  { id: '50', labelKey: 'price50' },
  { id: '199', labelKey: 'price199' },
  { id: '299', labelKey: 'price299' },
];

function inPriceTier(price: number, tier: PriceTier): boolean {
  if (tier === 'all') return true;
  if (tier === 'under30') return price < 30000;
  if (tier === '30') return price >= 30000 && price <= 50000;
  if (tier === '50') return price > 50000 && price <= 199000;
  if (tier === '199') return price > 199000 && price <= 299000;
  return price > 299000;
}

/**
 * One dish name shared by every restaurant serving it. The roulette spins on
 * dishes (not on individual places) so the result is "what to eat" and the
 * restaurants come afterwards.
 */
interface DishGroup {
  key: string;
  name: string;
  image_url: string;
  categories: FoodCategory[];
  places: Food[];
  /** Best rating among the places serving it. */
  rating: number;
  minPrice: number;
  maxPrice: number;
  /** True when no place of the group has a real price yet. */
  estimated: boolean;
}

function buildDishGroups(pool: Food[]): DishGroup[] {
  const byName = new Map<string, Food[]>();
  for (const food of pool) {
    const key = normalize(food.name).trim();
    if (!key) continue;
    const list = byName.get(key);
    if (list) list.push(food);
    else byName.set(key, [food]);
  }

  const groups: DishGroup[] = [];
  for (const [key, places] of byName) {
    const real = places
      .map((place) => place.price)
      .filter((value): value is number => typeof value === 'number' && value > 0);
    const values = real.length > 0 ? real : places.map((place) => priceOf(place).value);
    const best = places.reduce((acc, place) => Math.max(acc, place.rating), 0);
    groups.push({
      key,
      name: places[0].name,
      image_url: places[0].image_url,
      categories: foodCategoriesOf(places[0]),
      places,
      rating: best,
      minPrice: Math.min(...values),
      maxPrice: Math.max(...values),
      estimated: real.length === 0,
    });
  }
  return groups;
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
  const { favorites, toggleFavorite } = useFavorites();
  const { bursts, trigger: triggerRain } = useEmojiRain();
  const { enabled: funEnabled } = useFunEffects();
  const { coords } = useUserLocation();
  const [category, setCategory] = useState<FoodCategory>('Foods');
  const [priceTier, setPriceTier] = useState<PriceTier>('all');
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

  // Every dish of the category, once per unique dish name.
  const pool = useMemo(
    () => buildDishGroups(foods.filter((f) => foodHasCategory(f, category))),
    [foods, category],
  );

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
    const nextReel = buildReel(pool);
    if (nextReel.length > winnerIndex) nextReel[winnerIndex] = winner;

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

  const selectCategory = (c: FoodCategory) => {
    if (spinning) return;
    setCategory(c);
    resetSpin();
  };

  // The price only filters the restaurants of the dish already revealed, so
  // picking a range never re-spins.
  const selectPrice = (tier: PriceTier) => {
    if (spinning) return;
    setPriceTier(tier);
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
      .filter((place) => inPriceTier(priceOf(place).value, priceTier))
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
  }, [result, priceTier, coords, coordsRevision, t.branches.mainBranch, ratingOf]);

  const visiblePlaces = placesExpanded ? rankedPlaces : rankedPlaces.slice(0, 3);
  const nearestPlace = rankedPlaces[0] ?? null;
  const winnerRating = useMemo(
    () =>
      result
        ? Math.max(...result.places.map((place) => ratingOf(place.id, place.rating)))
        : 0,
    [result, ratingOf],
  );
  const favoriteTarget = nearestPlace?.food ?? result?.places[0] ?? null;
  const isFav = favoriteTarget ? favorites.has(favoriteTarget.id) : false;
  const askRestaurant =
    nearestPlace?.food.restaurant ?? result?.places[0]?.restaurant ?? '';

  return (
    <div className="random animate-fade-in">
      <header className="rnd-head">
        <span className="eyebrow">
          <Dices size={13} /> {t.random.eyebrow}
        </span>
        <h1 className="rnd-title">{t.random.title}</h1>
      </header>

      <div className="rnd-chips" role="tablist" aria-label={t.random.categoryLabel}>
        {FOOD_CATEGORIES.map((c) => (
          <button
            key={c}
            className={`chip ${category === c ? 'active' : ''}`}
            onClick={() => selectCategory(c)}
            disabled={spinning}
            aria-pressed={category === c}
          >
            {t.home.categories[c]}
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
                  <span className="rc-cat">
                    {group.categories.map((c) => t.home.categories[c]).join(' · ')}
                  </span>
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
          <div className="roulette-empty">{t.random.empty}</div>
        )}
        <div className="roulette-fade fade-left" />
        <div className="roulette-fade fade-right" />
        <div className="center-ticker" />
      </div>

      {result && (
        <div className="winner-block">
          <p className="winner-congrats">{t.random.congrats}</p>
          <div className="winner-card">
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

          <div className="price-block result-price">
            <span className="price-label">{t.random.priceLabel}</span>
            <div className="rnd-chips price-chips" role="tablist" aria-label={t.random.priceLabel}>
              {PRICE_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  className={`chip price-chip ${priceTier === tier.id ? 'active' : ''}`}
                  onClick={() => selectPrice(tier.id)}
                  disabled={spinning}
                  aria-pressed={priceTier === tier.id}
                >
                  {t.random[tier.labelKey]}
                </button>
              ))}
            </div>
          </div>

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
                  <button className="mini-act" onClick={() => selectPrice('all')}>
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
                {rankedPlaces.length > 3 && (
                  <button
                    className="more-places"
                    onClick={() => setPlacesExpanded((value) => !value)}
                  >
                    {placesExpanded
                      ? t.random.showLessPlaces
                      : t.random.morePlaces(rankedPlaces.length - 3)}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="rnd-actions">
            <button
              className="act"
              onClick={() => {
                const target = nearestPlace?.food ?? result.places[0];
                if (target) setSelectedDish(target);
              }}
            >
              <Eye size={16} /> {t.random.viewNearest}
            </button>
            <button
              className="act"
              onClick={() => onNavigateToChat(t.random.askAbout(result.name, askRestaurant))}
            >
              <Sparkles size={16} /> {t.random.askAi}
            </button>
            <button
              className={`act ${isFav ? 'is-fav' : ''}`}
              onClick={() => favoriteTarget && toggleFavorite(favoriteTarget.id)}
              disabled={!favoriteTarget}
            >
              <Heart size={16} fill={isFav ? 'var(--heart)' : 'none'} />
              {isFav ? t.random.saved : t.random.favorite}
            </button>
          </div>
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
          margin-bottom: 8px;
          text-align: center;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .price-chips {
          display: grid;
          /* uneven tracks so longer ranges get the room they need */
          grid-template-columns:
            minmax(0, 0.85fr) minmax(0, 0.85fr) minmax(0, 1fr)
            minmax(0, 1.15fr) minmax(0, 1.25fr) minmax(0, 0.9fr);
          gap: 4px;
          margin-bottom: 0;
          width: 100%;
          flex-wrap: nowrap;
        }
        .price-chips .price-chip {
          width: 100%;
          min-width: 0;
          padding: 8px 3px;
          font-size: clamp(9px, 2.9vw, 12.5px);
          line-height: 1.15;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
          text-align: center;
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
        .place-list,
        .rnd-actions {
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
          align-items: center;
          gap: 14px;
          padding: 12px;
          border-radius: var(--r-lg);
          background: var(--surface);
          border: 1px solid rgba(234, 179, 8, 0.7);
          box-shadow: 0 0 30px rgba(234, 179, 8, 0.5), var(--shadow-md);
          animation: popIn 0.45s var(--ease);
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
        .rnd-actions {
          display: flex;
          gap: 8px;
          width: 100%;
          margin-top: 14px;
        }
        .act {
          flex: 1;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 44px;
          padding: 0 8px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 12.5px;
          font-weight: 700;
          text-align: center;
          cursor: pointer;
          transition: border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
            transform var(--dur-fast) var(--ease);
        }
        .act:hover:not(:disabled) {
          transform: translateY(-2px);
          border-color: var(--primary);
          color: var(--primary-strong);
        }
        .act:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .act.is-fav {
          color: var(--heart);
          border-color: var(--heart);
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
          .rnd-actions {
            flex-wrap: wrap;
          }
          .act {
            flex: 1 1 calc(50% - 4px);
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
