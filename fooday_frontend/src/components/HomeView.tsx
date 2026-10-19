'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Search, Heart, Star, Bell, Sparkles } from 'lucide-react';
import { useFoods, type Food } from '@/hooks/useFoods';
import { useFavorites } from '@/hooks/useFavorites';
import { useTranslation } from '@/i18n/LanguageContext';
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

export type MoodTaskCategory =
  | 'All'
  | 'OfficeLunch'
  | 'Gathering'
  | 'Healthy'
  | 'WorkCafe'
  | 'AfternoonTea'
  | 'Romantic';

interface MoodTaskOption {
  id: MoodTaskCategory;
  labelKey:
    | 'all'
    | 'officeLunch'
    | 'gathering'
    | 'healthy'
    | 'workCafe'
    | 'afternoonTea'
    | 'romantic';
  icon: string;
  keywords: string[];
}

const MOOD_TASKS: MoodTaskOption[] = [
  { id: 'All', labelKey: 'all', icon: '🌟', keywords: [] },
  {
    id: 'OfficeLunch',
    labelKey: 'officeLunch',
    icon: '💼',
    keywords: ['cơm', 'bún', 'phở', 'mì', 'hủ tiếu', 'bánh mì', 'xôi', 'trưa', 'lunch', 'cơm tấm'],
  },
  {
    id: 'Gathering',
    labelKey: 'gathering',
    icon: '🍻',
    keywords: ['lẩu', 'nướng', 'bbq', 'buffet', 'nhậu', 'tụ tập', 'bia', 'hải sản'],
  },
  {
    id: 'Healthy',
    labelKey: 'healthy',
    icon: '🥗',
    keywords: ['chay', 'vegan', 'salad', 'healthy', 'clean', 'thanh đạm', 'rau'],
  },
  {
    id: 'WorkCafe',
    labelKey: 'workCafe',
    icon: '☕',
    keywords: ['cà phê', 'cafe', 'coffee', 'làm việc', 'yên tĩnh', 'trà', 'tea'],
  },
  {
    id: 'AfternoonTea',
    labelKey: 'afternoonTea',
    icon: '🧋',
    keywords: ['trà sữa', 'ăn vặt', 'chè', 'snack', 'bánh', 'ốc', 'xiên', 'trà chiều'],
  },
  {
    id: 'Romantic',
    labelKey: 'romantic',
    icon: '🍷',
    keywords: ['hẹn hò', 'ấm cúng', 'view đẹp', 'lãng mạn', 'steak', 'bò bít tết', 'pizza', 'sushi', 'rượu', 'romantic'],
  },
];

function itemMatchesMood(item: Food, mood: MoodTaskOption): boolean {
  if (mood.id === 'All') return true;
  if (mood.id === 'AfternoonTea' && item.category === 'Snacks') return true;
  const fields = [item.name, item.restaurant, item.tag, item.review_note];
  return mood.keywords.some((keyword) => {
    const k = normalize(keyword);
    return fields.some((field) => field != null && normalize(field).includes(k));
  });
}

export default function HomeView({ onNavigateToChat }: HomeViewProps) {
  const { t } = useTranslation();
  const { foods, loading } = useFoods();
  const { favorites, toggleFavorite } = useFavorites();
  const [selectedMood, setSelectedMood] = useState<MoodTaskCategory>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDish, setSelectedDish] = useState<Food | null>(null);

  const currentMoodOption = MOOD_TASKS.find((m) => m.id === selectedMood) ?? MOOD_TASKS[0];

  const filteredFoods = foods.filter((item) => {
    const matchesMood = itemMatchesMood(item, currentMoodOption);
    const q = normalize(searchQuery);
    const matchesSearch =
      q === '' ||
      [item.name, item.restaurant, item.tag, item.address, item.review_note].some(
        (field) => field != null && normalize(field).includes(q),
      );
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
          <button className="icon-button" aria-label={t.home.notifications}>
            <Bell size={20} />
            <span className="notif-dot" />
          </button>
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
          {filteredFoods.map((item, i) => {
            const isFav = favorites.has(item.id);
            return (
              <article
                key={item.id}
                className="card"
                style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}
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
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 290px"
                    className="card-img"
                    style={{ objectFit: 'cover' }}
                  />
                  {item.name && <span className="card-type-tag">{item.name}</span>}
                  {item.tag && <span className="card-tag glass">{item.tag}</span>}
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
                  <div className="card-foot">
                    <span className="rating">
                      <Star size={13} fill="var(--star)" color="var(--star)" />
                      {item.rating.toFixed(1)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToChat(t.home.askAbout(item.name, item.restaurant));
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
        .icon-button {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-soft);
          cursor: pointer;
          transition: transform var(--dur-fast) var(--ease),
            color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
        }
        .icon-button:hover {
          transform: translateY(-2px);
          color: var(--primary-strong);
          border-color: var(--primary);
        }
        .icon-button:active {
          transform: scale(0.94);
        }
        .notif-dot {
          position: absolute;
          top: 10px;
          right: 11px;
          width: 8px;
          height: 8px;
          border-radius: var(--r-full);
          background: var(--heart);
          border: 2px solid var(--surface-2);
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
          gap: 9px;
          overflow-x: auto;
          padding-bottom: 6px;
          margin-bottom: 22px;
          scrollbar-width: none;
        }
        .mood-categories::-webkit-scrollbar {
          display: none;
        }
        .chip {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 18px;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: transform var(--dur-fast) var(--ease),
            background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
        }
        .mood-chip {
          gap: 7px;
        }
        .mood-icon {
          font-size: 1rem;
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
          font-size: 0.75rem;
          font-weight: 700;
          color: #fff;
          background: rgba(32, 20, 12, 0.68);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: var(--r-full);
          padding: 4px 10px;
          max-width: calc(100% - 64px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          pointer-events: none;
        }
        .card-tag {
          position: absolute;
          top: 8px;
          left: 8px;
          z-index: 2;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--text);
          padding: 4px 8px;
          border-radius: var(--r-full);
          border: 1px solid rgba(255, 255, 255, 0.5);
          white-space: nowrap;
          max-width: calc(100% - 60px);
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .card-type-tag + .card-tag {
          top: 38px;
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
