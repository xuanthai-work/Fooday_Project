'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Search, Heart, Star, Sparkles, MapPin } from 'lucide-react';
import { useFoods, type Food } from '@/hooks/useFoods';
import { useReviewStats } from '@/hooks/useReviewStats';
import { useFavorites } from '@/hooks/useFavorites';
import { useTranslation } from '@/i18n/LanguageContext';
import { MOOD_TASKS, itemMatchesMood, type MoodTaskCategory } from '@/lib/moods';
import {
  findNearestBranch,
  formatDistance,
  getAllBranches,
  resolveBranchCoords,
  useUserLocation,
} from '@/lib/geo';
import ThemeToggle from './ThemeToggle';
import DishDetailModal from './DishDetailModal';

interface HomeViewProps {
  onNavigateToChat: (initialMsg?: string) => void;
}

const normalize = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

export default function HomeView({ onNavigateToChat }: HomeViewProps) {
  const { t, lang } = useTranslation();
  const { foods, loading } = useFoods();
  const { ratingOf } = useReviewStats();
  const { favorites, toggleFavorite } = useFavorites();
  const { coords } = useUserLocation();
  const [selectedMood, setSelectedMood] = useState<MoodTaskCategory>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDish, setSelectedDish] = useState<Food | null>(null);
  const searchParams = useSearchParams();
  const dishParam = searchParams.get('dish');
  const handledDishParamRef = useRef<string | null>(null);

  // Open a dish from anywhere: other views dispatch a custom event, and the
  // AddDishModal duplicate flow uses the `?dish=<id>` query param so the
  // detail opens even after navigating back to the home route.
  useEffect(() => {
    const onOpenDish = (event: Event) => {
      const target = (event as CustomEvent<Food>).detail;
      if (target) setSelectedDish(target);
    };
    window.addEventListener('fooday:open-dish', onOpenDish as EventListener);
    return () => window.removeEventListener('fooday:open-dish', onOpenDish as EventListener);
  }, []);

  useEffect(() => {
    if (!dishParam || handledDishParamRef.current === dishParam) return;
    const target = foods.find((item) => String(item.id) === dishParam);
    if (!target) return;
    handledDishParamRef.current = dishParam;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync the deep link into the modal state
    setSelectedDish(target);
  }, [dishParam, foods]);

  const currentMoodOption = MOOD_TASKS.find((m) => m.id === selectedMood) ?? MOOD_TASKS[0];

  // The shortened Google Maps links hide their coordinates: expand them in the
  // background so every card can show its distance to the closest outlet.
  // The revision is bumped whenever a link turns into real coordinates.
  const [coordsRevision, setCoordsRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const allBranches = foods.flatMap((item) =>
      getAllBranches(item, t.branches.mainBranch),
    );
    resolveBranchCoords(allBranches).then((resolved) => {
      if (active && resolved) {
        setCoordsRevision((r) => r + 1);
      }
    });
    return () => {
      active = false;
    };
  }, [foods, t.branches.mainBranch]);

  // One card per dish — every card carries a small distance badge.
  const branchSummaries = useMemo(() => {
    // Reading the revision keeps the memo honest about its dependencies.
    void coordsRevision;
    const map = new Map<number, { total: number; distanceKm: number | null }>();
    for (const item of foods) {
      const branches = getAllBranches(item, t.branches.mainBranch);
      const nearest = findNearestBranch(branches, coords);
      map.set(item.id, {
        total: branches.length,
        distanceKm: nearest ? nearest.distanceKm : null,
      });
    }
    return map;
  }, [foods, coords, coordsRevision, t.branches.mainBranch]);

  const filteredFoods = foods.filter((item) => {
    const matchesMood = itemMatchesMood(item, currentMoodOption);
    const q = normalize(searchQuery);
    const matchesSearch =
      q === '' ||
      [
        item.name,
        item.restaurant,
        item.tag,
        item.address,
        item.review_note,
        // Search hits the whole menu: any dish in `dishes` finds the place.
        (item.dishes ?? []).join(' · '),
      ].some((field) => field != null && normalize(field).includes(q));
    return matchesMood && matchesSearch;
  });

  const trimmedQuery = searchQuery.trim();

  return (
    <div className="home animate-fade-in">
      {/* Header */}
      <header className="home-header">
        <div className="title-block">
          <span className="eyebrow">
            <Sparkles size={13} /> {t.home.eyebrow}
          </span>
          <h1 className="home-title">{t.home.title}</h1>
        </div>
        <div className="header-actions">
          <ThemeToggle />
        </div>
      </header>

      {/* Search */}
      <div className="search-bar glass">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder={t.home.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          aria-label={t.home.searchPlaceholder}
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery('')}
            aria-label={t.home.clearSearch}
          >
            ✕
          </button>
        )}
      </div>

      {trimmedQuery !== '' && (
        <p className="search-status">{t.home.foundResults(filteredFoods.length)}</p>
      )}

      {/* Mood / Task categories */}
      <div className="mood-categories" role="tablist" aria-label="Nhu cầu ăn uống">
        {MOOD_TASKS.map((task) => {
          const isActive = selectedMood === task.id;
          return (
            <button
              key={task.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedMood(task.id)}
              className={`chip mood-chip ${isActive ? 'active' : ''}`}
            >
              <span className="mood-icon">{task.icon}</span>
              <span>{t.home.moods[task.labelKey]}</span>
            </button>
          );
        })}
      </div>

      {/* Section label */}
      <div className="section-row">
        <h2 className="section-title">
          {selectedMood === 'All' ? t.home.popularPicks : t.home.moods[currentMoodOption.labelKey]}
        </h2>
        <span className="section-count">{t.home.dishCount(filteredFoods.length)}</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="card skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : filteredFoods.length > 0 ? (
        <div className="grid">
          {filteredFoods.map((item, index) => {
            const isFav = favorites.has(item.id);
            const branchSummary = branchSummaries.get(item.id);
            const hasDistance = branchSummary?.distanceKm != null;
            const isMultiBranch = Boolean(branchSummary && branchSummary.total > 1);
            const showDistanceBadge = hasDistance || isMultiBranch;
            // Several dishes on one card are shown as a joined menu line.
            const dishTitle =
              item.dishes && item.dishes.length > 1
                ? item.dishes.join(' · ')
                : item.name;
            return (
              <article
                key={item.id}
                className="card"
                style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDish(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDish(item);
                  }
                }}
              >
                <div className="card-media">
                  <Image
                    src={item.image_url}
                    alt={dishTitle}
                    fill
                    sizes="(max-width: 640px) 50vw, 290px"
                    className="card-img"
                    style={{ objectFit: 'cover' }}
                    priority={index < 4}
                  />
                  {dishTitle && <span className="card-type-tag">{dishTitle}</span>}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(item.id);
                    }}
                    className={`fav ${isFav ? 'is-fav' : ''}`}
                    aria-label={isFav ? t.random.saved : t.random.favorite}
                    aria-pressed={isFav}
                  >
                    <Heart
                      size={16}
                      fill={isFav ? 'var(--heart)' : 'none'}
                      color={isFav ? 'var(--heart)' : 'var(--text-soft)'}
                    />
                  </button>
                </div>
                <div className="card-body">
                  <h3 className="card-name">{item.restaurant}</h3>
                  {showDistanceBadge && branchSummary && (
                    <span className="card-branch-badge">
                      <MapPin size={12} />
                      {hasDistance
                        ? t.branches.distanceAway(
                            formatDistance(branchSummary.distanceKm!, lang),
                          )
                        : t.branches.multiBranch}
                    </span>
                  )}
                  <div className="card-foot">
                    <span className="rating">
                      <Star size={13} fill="var(--star)" color="var(--star)" />
                      {ratingOf(item.id, item.rating).toFixed(1)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToChat(t.home.askAbout(dishTitle, item.restaurant));
                      }}
                      className="ask-ai"
                    >
                      <Sparkles size={11} /> {t.home.askAi}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <Search size={26} />
          </div>
          <p className="empty-title">
            {trimmedQuery !== ''
              ? `${t.home.noResultsFound} “${trimmedQuery}”`
              : t.home.noResults}
          </p>
          <span className="empty-sub">{t.home.noResultsSub}</span>
        </div>
      )}

      {selectedDish && (
        <DishDetailModal
          dish={selectedDish}
          onClose={() => setSelectedDish(null)}
          onNavigateToChat={onNavigateToChat}
        />
      )}

      <style jsx>{`
        .home {
          padding: clamp(16px, 5vw, 26px) clamp(16px, 5vw, 20px) 32px;
        }
        .home-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 22px;
        }
        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--primary-strong);
          margin-bottom: 4px;
        }
        .home-title {
          font-size: clamp(24px, 7.5vw, 30px);
          font-weight: 800;
          color: var(--text);
          line-height: 1.05;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .search-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 16px;
          min-height: 48px;
          border-radius: var(--r-full);
          border: 1px solid var(--border-strong);
          margin-bottom: 20px;
          transition: border-color var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease);
        }
        .search-bar:focus-within {
          border-color: var(--primary);
          box-shadow: 0 0 0 4px var(--ring);
        }
        .search-icon {
          color: var(--text-faint);
          flex-shrink: 0;
        }
        .search-input {
          flex: 1;
          border: none;
          background: none;
          outline: none;
          font-size: 0.9375rem;
          color: var(--text);
          min-width: 0;
          height: 100%;
        }
        .search-input::placeholder {
          color: var(--text-faint);
        }
        .search-clear {
          border: none;
          background: var(--surface-3);
          color: var(--text-soft);
          width: 28px;
          height: 28px;
          border-radius: var(--r-full);
          font-size: 0.75rem;
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: background var(--dur-fast) var(--ease);
        }
        .search-clear:hover {
          background: var(--primary-soft-2);
          color: var(--primary-strong);
        }
        .search-status {
          margin: -8px 2px 12px;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--primary-strong);
        }
        .mood-categories {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 2px 2px 8px;
          margin-bottom: 18px;
          -ms-overflow-style: none;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .mood-categories::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .chip {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 5px 12px;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: transform var(--dur-fast) var(--ease),
            background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
        }
        .mood-chip {
          gap: 5px;
        }
        .mood-icon {
          font-size: 0.9375rem;
          line-height: 1;
        }
        .chip:hover:not(.active) {
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
        .section-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .section-title {
          font-size: clamp(16px, 4.5vw, 18px);
          font-weight: 700;
          color: var(--text);
        }
        .section-count {
          font-size: 0.8125rem;
          color: var(--text-faint);
          font-weight: 500;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(12px, 3.5vw, 18px);
        }
        @media (min-width: 768px) {
          .grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (min-width: 1280px) {
          .grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (min-width: 1600px) {
          .grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
        }
        @media (min-width: 1920px) {
          .grid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
        }
        .card.skeleton {
          height: 230px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          animation: pulse 1.2s var(--ease) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          cursor: pointer;
          animation: fadeInUp 0.5s var(--ease-out) both;
          transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease),
            border-color var(--dur) var(--ease);
          display: flex;
          flex-direction: column;
        }
        .card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--primary-soft-2);
        }
        .card-media {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          overflow: hidden;
          background: var(--surface-2);
        }
        .card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform var(--dur-slow) var(--ease);
        }
        .card:hover .card-img {
          transform: scale(1.08);
        }
        .card-type-tag {
          position: absolute;
          top: 8px;
          left: 8px;
          z-index: 2;
          font-size: 0.6875rem;
          font-weight: 700;
          color: var(--primary-strong);
          background: color-mix(in srgb, var(--surface) 88%, var(--primary) 12%);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--primary-soft-2);
          border-radius: var(--r-full);
          padding: 3px 8px;
          max-width: calc(100% - 64px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);
          pointer-events: none;
        }
        :global(:root[data-theme="dark"]) .card-type-tag {
          background: rgba(28, 24, 21, 0.90);
          color: var(--primary);
          border-color: var(--primary-soft-2);
        }
        @media (prefers-color-scheme: dark) {
          :global(:root:not([data-theme="light"])) .card-type-tag {
            background: rgba(28, 24, 21, 0.90);
            color: var(--primary);
            border-color: var(--primary-soft-2);
          }
        }
        .fav {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 2;
          width: 44px;
          height: 44px;
          border-radius: var(--r-full);
          border: none;
          background: var(--glass-strong);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          transition: transform var(--dur-fast) var(--ease);
        }
        .fav:hover {
          transform: scale(1.12);
        }
        .fav:active {
          transform: scale(0.9);
        }
        .fav.is-fav :global(svg) {
          animation: heartPop 0.4s var(--ease);
        }
        .card-body {
          padding: clamp(10px, 3vw, 14px) clamp(10px, 3vw, 14px) clamp(12px, 3.5vw, 15px);
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .card-name {
          font-size: clamp(0.875rem, 3.5vw, 0.9375rem);
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        /* Multi-outlet badge — one line, never wraps, never breaks the card. */
        .card-branch-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          align-self: flex-start;
          max-width: 100%;
          margin-bottom: 8px;
          padding: 3px 8px;
          border-radius: var(--r-full);
          border: 1px solid var(--primary-soft-2);
          background: var(--primary-soft);
          color: var(--primary-strong);
          font-size: 0.6875rem;
          font-weight: 700;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
        }
        .card-branch-badge :global(svg) {
          flex-shrink: 0;
        }
        .card-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
          padding-top: 10px;
          gap: 6px;
        }
        .rating {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--text);
          flex-shrink: 0;
        }
        .ask-ai {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          font-size: 0.71875rem;
          font-weight: 700;
          color: var(--primary-strong);
          background: var(--primary-soft);
          border: 1px solid transparent;
          min-height: 32px;
          padding: 0 10px;
          border-radius: var(--r-full);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease),
            color var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
          white-space: nowrap;
          flex-shrink: 1;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ask-ai:hover {
          background: var(--grad-primary);
          color: var(--primary-contrast);
          transform: translateY(-1px);
        }
        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 56px 20px;
        }
        .empty-icon {
          display: grid;
          place-items: center;
          width: 56px;
          height: 56px;
          border-radius: var(--r-full);
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--text-faint);
          margin-bottom: 14px;
        }
        .empty-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
        }
        .empty-sub {
          font-size: 0.84375rem;
          color: var(--text-soft);
          margin-top: 4px;
        }

      `}</style>
    </div>
  );
}
