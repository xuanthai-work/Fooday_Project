'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Search, Heart, Star, Sparkles, MapPin, ChevronRight } from 'lucide-react';
import { useFoods, type Food } from '@/hooks/useFoods';
import { useReviewStats } from '@/hooks/useReviewStats';
import { useFavorites } from '@/hooks/useFavorites';
import { useTranslation } from '@/i18n/LanguageContext';
import {
  DISH_GROUPS,
  groupById,
  matchesGroup,
  matchesSubGroup,
  subGroupOf,
  groupOf,
  type DishGroupId,
  type DishSubId,
} from '@/lib/taxonomy';
import {
  findNearestBranch,
  formatDistance,
  getAllBranches,
  resolveBranchCoords,
  useUserLocation,
} from '@/lib/geo';
import { popularityScore } from '@/lib/popularity';
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

const HOME_FILTER_KEY = 'fooday:home-filter';

/** How the feed is ordered: closest first, or the most reviewed & best rated. */
type SortMode = 'near' | 'popular';

/** Keeps the selected chip in sight when a row is wider than the screen. */
function centerChip(bar: HTMLDivElement | null, selector: string) {
  const chip = bar?.querySelector<HTMLElement>(selector);
  if (!bar || !chip) return;
  bar.scrollTo({
    left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2,
    behavior: 'smooth',
  });
}

export default function HomeView({ onNavigateToChat }: HomeViewProps) {
  const { t, lang } = useTranslation();
  const { foods, loading } = useFoods();
  const { stats, ratingOf } = useReviewStats();
  const { favorites, toggleFavorite } = useFavorites();
  const { coords, loading: locating } = useUserLocation();
  const [selectedGroup, setSelectedGroup] = useState<DishGroupId>('all');
  const [selectedSub, setSelectedSub] = useState<DishSubId | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('near');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDish, setSelectedDish] = useState<Food | null>(null);
  const searchParams = useSearchParams();
  const dishParam = searchParams.get('dish');
  const handledDishParamRef = useRef<string | null>(null);
  const groupBarRef = useRef<HTMLDivElement | null>(null);
  const subBarRef = useRef<HTMLDivElement | null>(null);

  // Fade only the edges that actually hide more chips, so a fully visible row
  // never looks truncated and a scrolled one never looks broken.
  const [scrollFade, setScrollFade] = useState({
    groupStart: false,
    groupEnd: false,
    subStart: false,
    subEnd: false,
  });

  const syncScrollFade = useCallback(() => {
    const edges = (el: HTMLDivElement | null) => {
      if (!el) return { start: false, end: false };
      return {
        start: el.scrollLeft > 4,
        end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      };
    };
    const group = edges(groupBarRef.current);
    const sub = edges(subBarRef.current);
    setScrollFade((prev) =>
      prev.groupStart === group.start &&
      prev.groupEnd === group.end &&
      prev.subStart === sub.start &&
      prev.subEnd === sub.end
        ? prev
        : {
            groupStart: group.start,
            groupEnd: group.end,
            subStart: sub.start,
            subEnd: sub.end,
          },
    );
  }, []);

  // Remember the last chip so the second visit is one glance, zero taps.
  // The read happens exactly once (a ref guards StrictMode's double effect);
  // it must never re-read, otherwise the write below would echo back.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(HOME_FILTER_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        group?: DishGroupId;
        sub?: DishSubId | null;
        sort?: SortMode;
      };
      if (!saved.group || !DISH_GROUPS.some((group) => group.id === saved.group)) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved chip once on mount
      setSelectedGroup(saved.group);
      if (saved.group !== 'all' && saved.sub) setSelectedSub(saved.sub);
      if (saved.sort === 'near' || saved.sort === 'popular') setSortMode(saved.sort);
    } catch {
      /* private mode or corrupted value — start from "Tất cả" */
    }
  }, []);

  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      window.localStorage.setItem(
        HOME_FILTER_KEY,
        JSON.stringify({ group: selectedGroup, sub: selectedSub, sort: sortMode }),
      );
    } catch {
      /* storage unavailable — the filter still works for this session */
    }
  }, [selectedGroup, selectedSub, sortMode]);

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

  const currentGroup = groupById(selectedGroup);

  // Everything is classified once per catalog change, never per keystroke.
  const groupCounts = useMemo(() => {
    const counts = new Map<DishGroupId, number>([['all', foods.length]]);
    for (const item of foods) {
      const group = groupOf(item);
      if (!group) continue;
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return counts;
  }, [foods]);

  // Only branches with dishes are offered: never a chip that opens on "0 món".
  const visibleGroups = useMemo(
    () => DISH_GROUPS.filter((group) => group.id === 'all' || (groupCounts.get(group.id) ?? 0) > 0),
    [groupCounts],
  );

  const subCounts = useMemo(() => {
    const counts = new Map<DishSubId, number>();
    if (selectedGroup === 'all' || !currentGroup.subs) return counts;
    for (const item of foods) {
      if (groupOf(item) !== selectedGroup) continue;
      const sub = subGroupOf(item, selectedGroup);
      if (sub) counts.set(sub, (counts.get(sub) ?? 0) + 1);
    }
    return counts;
  }, [foods, selectedGroup, currentGroup]);

  const visibleSubs = useMemo(
    () => (currentGroup.subs ?? []).filter((sub) => (subCounts.get(sub.id) ?? 0) > 0),
    [currentGroup, subCounts],
  );

  // A single sub-chip is noise — the branch already means exactly that.
  const showSubRow = selectedGroup !== 'all' && visibleSubs.length >= 2;

  const selectGroup = (group: DishGroupId) => {
    setSelectedGroup(group);
    setSelectedSub(null);
  };

  const selectSub = (sub: DishSubId) => {
    setSelectedSub((current) => (current === sub ? null : sub));
  };

  // The sort switch replaces the old static heading on every section; the
  // current group/sub is echoed in the count line so context is never lost.
  const sectionContext = selectedSub
    ? t.home.subgroups[selectedSub]
    : selectedGroup !== 'all'
      ? t.home.groups[selectedGroup]
      : null;

  // With seven branches the selected chip can sit off-screen (e.g. after a
  // restore or when it is picked from the tray) — keep it centered.
  useEffect(() => {
    centerChip(groupBarRef.current, '.group-chip.active');
    syncScrollFade();
  }, [selectedGroup, visibleGroups.length, syncScrollFade]);

  useEffect(() => {
    centerChip(subBarRef.current, '.sub-chip.active');
    syncScrollFade();
  }, [selectedGroup, selectedSub, showSubRow, syncScrollFade]);

  useEffect(() => {
    window.addEventListener('resize', syncScrollFade);
    return () => window.removeEventListener('resize', syncScrollFade);
  }, [syncScrollFade]);

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

  // "Gần tôi" lists the closest place first; "Phổ biến" leads with the dishes
  // that have both a high rating and plenty of reviews (see lib/popularity).
  const filteredFoods = useMemo(() => {
    const q = normalize(searchQuery);
    const distanceOf = (item: Food) => branchSummaries.get(item.id)?.distanceKm ?? null;
    const reviewCountOf = (item: Food) => stats[item.id]?.count ?? 0;
    const scoreOf = (item: Food) =>
      popularityScore(stats[item.id]?.average ?? item.rating, reviewCountOf(item));

    const byDistance = (a: Food, b: Food) => {
      const da = distanceOf(a);
      const db = distanceOf(b);
      if (da !== null && db !== null) return da - db;
      if (da !== null) return -1;
      if (db !== null) return 1;
      return 0;
    };
    const byPopularity = (a: Food, b: Food) => {
      const diff = scoreOf(b) - scoreOf(a);
      if (Math.abs(diff) > 1e-9) return diff;
      const reviews = reviewCountOf(b) - reviewCountOf(a);
      if (reviews !== 0) return reviews;
      return byDistance(a, b);
    };

    return foods
      .filter((item) => {
        const matchesSelection =
          matchesGroup(item, selectedGroup) && matchesSubGroup(item, selectedGroup, selectedSub);
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
        return matchesSelection && matchesSearch;
      })
      .sort((a, b) => {
        if (sortMode === 'popular') return byPopularity(a, b);
        // No GPS yet: distance is unknown everywhere, so popularity leads.
        return byDistance(a, b) || byPopularity(a, b);
      });
  }, [foods, selectedGroup, selectedSub, searchQuery, sortMode, branchSummaries, stats]);

  const trimmedQuery = searchQuery.trim();

  return (
    <div className="home animate-fade-in">
      {/* Header */}
      <header className="home-header">
        <div className="title-block">
          <button
            type="button"
            className="eyebrow eyebrow-button"
            onClick={() => onNavigateToChat(t.chat.eatTodayPrompt)}
            aria-label={t.chat.eatTodayPrompt}
            title={t.chat.eatTodayPrompt}
          >
            <Sparkles size={13} /> {t.home.eyebrow}
            <ChevronRight size={12} className="eyebrow-chev" aria-hidden="true" />
          </button>
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

      {/* Level 1 — what kind of meal */}
      <div
        className={`group-bar ${scrollFade.groupStart ? 'fade-start' : ''} ${scrollFade.groupEnd ? 'fade-end' : ''}`}
        role="tablist"
        aria-label={t.home.groupLabel}
        ref={groupBarRef}
        onScroll={syncScrollFade}
      >
        {visibleGroups.map((group) => {
          const isActive = selectedGroup === group.id;
          return (
            <button
              key={group.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => selectGroup(group.id)}
              className={`chip group-chip ${isActive ? 'active' : ''}`}
            >
              <span className="group-icon" aria-hidden="true">
                {group.icon}
              </span>
              <span>{t.home.groups[group.id]}</span>
            </button>
          );
        })}
      </div>

      {/* Level 2 — refine inside the chosen branch, never required */}
      {showSubRow && (
        <div className="sub-panel" key={currentGroup.id}>
          <div
            className={`sub-bar ${scrollFade.subStart ? 'fade-start' : ''} ${scrollFade.subEnd ? 'fade-end' : ''}`}
            role="group"
            aria-label={t.home.groupLabel}
            ref={subBarRef}
            onScroll={syncScrollFade}
          >
            <button
              aria-pressed={selectedSub === null}
              onClick={() => setSelectedSub(null)}
              className={`sub-chip ${selectedSub === null ? 'active' : ''}`}
            >
              {t.home.groups.all}
              <span className="sub-count">{groupCounts.get(currentGroup.id) ?? 0}</span>
            </button>
            {visibleSubs.map((sub, index) => {
              const isActive = selectedSub === sub.id;
              return (
                <button
                  key={sub.id}
                  aria-pressed={isActive}
                  onClick={() => selectSub(sub.id)}
                  className={`sub-chip ${isActive ? 'active' : ''}`}
                  style={{ animationDelay: `${index * 35}ms` }}
                >
                  {t.home.subgroups[sub.id]}
                  <span className="sub-count">{subCounts.get(sub.id) ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Order switch — available on every chip, not just "Tất cả" */}
      <div className="section-row">
        <div
          className={`section-switch ${sortMode === 'popular' ? 'is-popular' : ''}`}
          role="group"
          aria-label={t.home.sortLabel}
        >
          <span className="switch-thumb" aria-hidden="true" />
          <button
            type="button"
            className={`switch-btn ${sortMode === 'near' ? 'active' : ''}`}
            aria-pressed={sortMode === 'near'}
            onClick={() => setSortMode('near')}
          >
            {t.home.nearMe}
          </button>
          <button
            type="button"
            className={`switch-btn ${sortMode === 'popular' ? 'active' : ''}`}
            aria-pressed={sortMode === 'popular'}
            onClick={() => setSortMode('popular')}
          >
            {t.home.popular}
          </button>
        </div>
        <span className="section-count">
          {sectionContext && <span className="section-context">{sectionContext} ·</span>}
          {t.home.dishCount(filteredFoods.length)}
        </span>
      </div>

      {sortMode === 'near' && !coords && !locating && filteredFoods.length > 0 && (
        <p className="section-hint">
          <MapPin size={12} /> {t.home.nearMeHint}
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="card skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : filteredFoods.length > 0 ? (
        <div className="grid" key={sortMode}>
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
        /* The eyebrow is a shortcut: tapping it asks the AI what to eat today. */
        .eyebrow-button {
          border: 0;
          background: transparent;
          padding: 3px 7px;
          margin: -3px -7px 1px;
          border-radius: var(--r-full);
          font-family: inherit;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease),
            transform var(--dur-fast) var(--ease);
        }
        .eyebrow-button:hover {
          background: var(--primary-soft);
          transform: translateY(-1px);
        }
        .eyebrow-button:active {
          transform: scale(0.97);
        }
        .eyebrow-button:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        .eyebrow-chev {
          opacity: 0.72;
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
        .group-bar {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 2px 2px 8px;
          margin-bottom: 12px;
          -ms-overflow-style: none;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .group-bar::-webkit-scrollbar {
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
        .group-chip {
          gap: 6px;
          min-height: 38px;
          padding: 0 15px 0 12px;
          font-size: 0.84375rem;
          letter-spacing: -0.01em;
        }
        .group-icon {
          font-size: 1rem;
          line-height: 1;
          transform: translateY(-0.5px);
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
        /* Level 2 lives inside a soft tray so the hierarchy is obvious at a
           glance: the tray belongs to the level-1 chip above it. */
        .sub-panel {
          margin: 0 0 18px;
          padding: 7px;
          border-radius: 18px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
          animation: subIn var(--dur) var(--ease-out) both;
          overflow: hidden;
        }
        .sub-bar {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        /* Edge fades are applied only to the side that still hides chips. */
        .group-bar.fade-end,
        .sub-bar.fade-end {
          -webkit-mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 14px), transparent 100%);
          mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 14px), transparent 100%);
        }
        .group-bar.fade-start,
        .sub-bar.fade-start {
          -webkit-mask-image: linear-gradient(to right, transparent 0, #000 16px, #000 100%);
          mask-image: linear-gradient(to right, transparent 0, #000 16px, #000 100%);
        }
        .group-bar.fade-start.fade-end,
        .sub-bar.fade-start.fade-end {
          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0,
            #000 16px,
            #000 calc(100% - 14px),
            transparent 100%
          );
          mask-image: linear-gradient(
            to right,
            transparent 0,
            #000 16px,
            #000 calc(100% - 14px),
            transparent 100%
          );
        }
        .sub-bar::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .sub-chip {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 34px;
          padding: 0 11px;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-soft);
          font-size: 0.78125rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          animation: subChipIn 0.34s var(--ease-out) both;
          transition: transform var(--dur-fast) var(--ease),
            background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
            border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
        }
        .sub-chip:hover:not(.active) {
          transform: translateY(-1px);
          border-color: var(--primary-soft-2);
          color: var(--primary-strong);
        }
        .sub-chip.active {
          background: var(--primary-soft);
          border-color: var(--primary);
          color: var(--primary-strong);
          box-shadow: 0 2px 10px -5px var(--ring);
        }
        .sub-count {
          font-size: 0.6875rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          padding: 3px 6px;
          border-radius: var(--r-full);
          background: var(--surface-3);
          color: var(--text-faint);
          transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
        }
        .sub-chip.active .sub-count {
          background: var(--primary);
          color: var(--primary-contrast);
        }
        @keyframes subIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes subChipIn {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .sub-panel,
          .sub-chip {
            animation: none;
          }
        }
        .section-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .section-switch {
          position: relative;
          display: inline-grid;
          grid-template-columns: 1fr 1fr;
          align-items: center;
          padding: 4px;
          border-radius: var(--r-full);
          flex-shrink: 0;
        }
        .switch-thumb {
          position: absolute;
          top: 4px;
          bottom: 4px;
          left: 4px;
          width: calc(50% - 4px);
          border-radius: var(--r-full);
          background: var(--grad-primary);
          box-shadow: var(--shadow-primary);
          transition: transform var(--dur-fast) var(--ease);
        }
        .section-switch.is-popular .switch-thumb {
          transform: translateX(100%);
        }
        .switch-btn {
          position: relative;
          z-index: 1;
          padding: 6px 14px;
          border: 0;
          border-radius: var(--r-full);
          background: transparent;
          color: var(--text-faint);
          font-family: inherit;
          font-size: clamp(14px, 3.9vw, 16px);
          font-weight: 700;
          line-height: 1.2;
          white-space: nowrap;
          cursor: pointer;
          transition: color var(--dur-fast) var(--ease);
        }
        .switch-btn:hover:not(.active) {
          color: var(--text);
        }
        .switch-btn.active {
          color: var(--primary-contrast);
        }
        .section-count {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
          font-size: 0.8125rem;
          color: var(--text-faint);
          font-weight: 500;
          white-space: nowrap;
        }
        .section-context {
          min-width: 0;
          max-width: 34vw;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-soft);
          font-weight: 600;
        }
        .section-hint {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin: -6px 0 12px;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--primary-strong);
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
