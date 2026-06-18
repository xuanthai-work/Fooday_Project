'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Search, Heart, Star, Bell, Sparkles } from 'lucide-react';
import { FOODS, FoodCategory } from '@/data/foods';
import { useFavorites, toggleFavorite } from '@/hooks/useFavorites';
import ThemeToggle from './ThemeToggle';

interface HomeViewProps {
  onNavigateToChat: (initialMsg?: string) => void;
}

const CATEGORIES: ('All' | FoodCategory)[] = ['All', 'Foods', 'Drinks', 'Snacks'];

export default function HomeView({ onNavigateToChat }: HomeViewProps) {
  const favorites = useFavorites();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredFoods = FOODS.filter((item) => {
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
          <button className="icon-button" aria-label="Notifications">
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
      {filteredFoods.length > 0 ? (
        <div className="grid">
          {filteredFoods.map((item, i) => {
            const isFav = favorites.includes(item.name);
            return (
              <article
                key={item.name}
                className="card"
                style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}
              >
                <div className="card-media">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 290px"
                    className="card-img"
                  />
                  {item.tag && <span className="card-tag glass">{item.tag}</span>}
                  <button
                    onClick={() => toggleFavorite(item.name)}
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
          padding: 26px 20px 32px;
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
          font-size: 12px;
          font-weight: 600;
          color: var(--primary-strong);
          margin-bottom: 4px;
        }
        .home-title {
          font-size: 30px;
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
          width: 42px;
          height: 42px;
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
          top: 9px;
          right: 10px;
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
          padding: 13px 16px;
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
          font-size: 15px;
          color: var(--text);
        }
        .search-input::placeholder {
          color: var(--text-faint);
        }
        .search-clear {
          border: none;
          background: var(--surface-3);
          color: var(--text-soft);
          width: 22px;
          height: 22px;
          border-radius: var(--r-full);
          font-size: 11px;
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
          padding: 9px 20px;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 14px;
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
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
        }
        .section-count {
          font-size: 13px;
          color: var(--text-faint);
          font-weight: 500;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        @media (min-width: 460px) {
          .grid {
            gap: 18px;
          }
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
        }
        .card:hover {
          transform: translateY(-6px);
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
          top: 10px;
          left: 10px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--text);
          padding: 4px 9px;
          border-radius: var(--r-full);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
        .fav {
          position: absolute;
          top: 9px;
          right: 9px;
          width: 32px;
          height: 32px;
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
          padding: 13px 14px 15px;
        }
        .card-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .card-place {
          font-size: 12.5px;
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
          margin-top: 11px;
        }
        .rating {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
        }
        .ask-ai {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--primary-strong);
          background: var(--primary-soft);
          border: 1px solid transparent;
          padding: 5px 11px;
          border-radius: var(--r-full);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease),
            color var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
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
          font-size: 40px;
          margin-bottom: 12px;
        }
        .empty-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
        }
        .empty-sub {
          font-size: 13.5px;
          color: var(--text-soft);
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}
