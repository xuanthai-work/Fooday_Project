'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Search, Heart, Star, Bell, Sparkles, Plus } from 'lucide-react';
import { useFoods, FoodCategory } from '@/hooks/useFoods';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from './ThemeToggle';
import AddDishModal from './AddDishModal';

interface HomeViewProps {
  onNavigateToChat: (initialMsg?: string) => void;
}

const CATEGORIES: ('All' | FoodCategory)[] = ['All', 'Foods', 'Drinks', 'Snacks'];

export default function HomeView({ onNavigateToChat }: HomeViewProps) {
  const { foods, loading } = useFoods();
  const { favorites, toggleFavorite } = useFavorites();
  const { user } = useAuth();
  const isGuest = user?.is_anonymous ?? true;
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const handleAddClick = () => {
    if (isGuest) {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 2600);
      return;
    }
    setShowAdd(true);
  };

  const filteredFoods = foods.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      q === '' ||
      item.name.toLowerCase().includes(q) ||
      item.restaurant.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="home animate-fade-in">
      {/* Header */}
      <header className="home-header">
        <div className="title-block">
          <span className="eyebrow">
            <Sparkles size={13} /> What to eat today
          </span>
          <h1 className="home-title">Homepage</h1>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Add dish"
            onClick={handleAddClick}
            title={isGuest ? 'Sign up to add dishes' : 'Add a dish'}
          >
            <Plus size={20} />
          </button>
          <button className="icon-button" aria-label="Notifications">
            <Bell size={20} />
            <span className="notif-dot" />
          </button>
          <ThemeToggle />
        </div>
      </header>
      {showHint && <div className="add-hint">Sign up to add dishes ✨</div>}
      {showAdd && <AddDishModal onClose={() => setShowAdd(false)} />}

      {/* Search */}
      <div className="search-bar glass">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search dishes, drinks, places…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          aria-label="Search food"
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="categories" role="tablist" aria-label="Food categories">
        {CATEGORIES.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedCategory(category)}
              className={`chip ${isActive ? 'active' : ''}`}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Section label */}
      <div className="section-row">
        <h2 className="section-title">
          {selectedCategory === 'All' ? 'Popular picks' : selectedCategory}
        </h2>
        <span className="section-count">{filteredFoods.length} dishes</span>
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
              >
                <div className="card-media">
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 290px"
                    className="card-img"
                  />
                  {item.tag && <span className="card-tag glass">{item.tag}</span>}
                  <button
                    onClick={() => toggleFavorite(item.id)}
                    className={`fav ${isFav ? 'is-fav' : ''}`}
                    aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
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
                  <h3 className="card-name">{item.name}</h3>
                  <p className="card-place">{item.restaurant}</p>
                  <div className="card-foot">
                    <span className="rating">
                      <Star size={13} fill="var(--star)" color="var(--star)" />
                      {item.rating.toFixed(1)}
                    </span>
                    <button
                      onClick={() =>
                        onNavigateToChat(
                          `Tell me about ${item.name} from ${item.restaurant} — is it a good pick today?`,
                        )
                      }
                      className="ask-ai"
                    >
                      <Sparkles size={11} /> Ask AI
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-emoji">🍽️</div>
          <p className="empty-title">No dishes found</p>
          <span className="empty-sub">Try another category or search term.</span>
        </div>
      )}

      <style jsx>{`
        .home {
          padding: clamp(16px, 5vw, 26px) clamp(16px, 5vw, 20px) 32px;
        }
        .add-hint {
          display: inline-block;
          margin: 0 0 16px;
          padding: 8px 14px;
          border-radius: var(--r-full);
          background: var(--primary-soft);
          color: var(--primary-strong);
          font-size: 13px;
          font-weight: 600;
          animation: fadeInUp 0.3s var(--ease-out) both;
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
        .categories {
          display: flex;
          gap: 9px;
          overflow-x: auto;
          padding-bottom: 6px;
          margin-bottom: 22px;
          scrollbar-width: none;
        }
        .categories::-webkit-scrollbar {
          display: none;
        }
        .chip {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 20px;
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
        .chip:hover {
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
          cursor: default;
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
        .card-tag {
          position: absolute;
          top: 8px;
          left: 8px;
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
        .fav {
          position: absolute;
          top: 6px;
          right: 6px;
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
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .card-place {
          font-size: 0.78125rem;
          color: var(--text-soft);
          margin-top: 2px;
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
        .empty-emoji {
          font-size: 2.5rem;
          margin-bottom: 12px;
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
