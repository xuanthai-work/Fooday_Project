'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Settings, Mail, MapPin, Star, ChevronRight, Heart, Clock } from 'lucide-react';
import { FOOD_BY_NAME } from '@/data/foods';
import { useFavorites } from '@/hooks/useFavorites';
import ThemeToggle from './ThemeToggle';

interface ProfileViewProps {
  onNavigateToChat: (initialMsg?: string) => void;
}

export default function ProfileView({ onNavigateToChat }: ProfileViewProps) {
  const favorites = useFavorites();
  const [tab, setTab] = useState<'favorites' | 'history'>('favorites');

  const favoriteItems = favorites
    .map((name) => FOOD_BY_NAME[name])
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="profile animate-fade-in">
      {/* Banner */}
      <div className="banner">
        <div className="banner-top">
          <button className="banner-btn" aria-label="Settings">
            <Settings size={19} />
          </button>
          <ThemeToggle variant="onPrimary" />
        </div>

        <div className="id-row">
          <div className="avatar-ring">
            <Image
              src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=300&q=80"
              alt="Deny Smith"
              width={78}
              height={78}
              className="avatar-img"
            />
          </div>
          <div className="id-text">
            <h2 className="name">Deny Smith</h2>
            <span className="detail">
              <Mail size={13} /> deny.smith@fooday.app
            </span>
            <span className="detail">
              <MapPin size={13} /> San Francisco, CA
            </span>
          </div>
        </div>
      </div>

      {/* Floating stats */}
      <div className="stats">
        <div className="stat">
          <span className="stat-num">{favoriteItems.length}</span>
          <span className="stat-label">Favorites</span>
        </div>
        <span className="stat-divider" />
        <div className="stat">
          <span className="stat-num">16</span>
          <span className="stat-label">Reviews</span>
        </div>
        <span className="stat-divider" />
        <div className="stat">
          <span className="stat-num">1.2k</span>
          <span className="stat-label">Points</span>
        </div>
      </div>

      {/* Segmented control */}
      <div className="segment-wrap glass">
        <div className="segment">
          <span
            className="segment-slider"
            style={{ transform: `translateX(${tab === 'history' ? '100%' : '0%'})` }}
          />
          <button
            className={`segment-btn ${tab === 'favorites' ? 'active' : ''}`}
            onClick={() => setTab('favorites')}
          >
            <Heart size={15} /> Favorites
          </button>
          <button
            className={`segment-btn ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            <Clock size={15} /> History
          </button>
        </div>
      </div>

      {/* Panel */}
      <div className="panel">
        {tab === 'favorites' ? (
          favoriteItems.length > 0 ? (
            <div className="fav-list">
              {favoriteItems.map((item, i) => (
                <button
                  key={item.name}
                  className="fav-item"
                  style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                  onClick={() =>
                    onNavigateToChat(
                      `Suggest dishes similar to ${item.name} from ${item.restaurant}.`,
                    )
                  }
                >
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={66}
                    height={66}
                    className="fav-img"
                  />
                  <div className="fav-info">
                    <h4 className="fav-name">{item.name}</h4>
                    <span className="fav-place">{item.restaurant}</span>
                    <span className="fav-rating">
                      <Star size={12} fill="var(--star)" color="var(--star)" />
                      {item.rating.toFixed(1)}
                    </span>
                  </div>
                  <ChevronRight size={20} className="chevron" />
                </button>
              ))}
            </div>
          ) : (
            <div className="placeholder">
              <div className="ph-icon">
                <Heart size={26} />
              </div>
              <p className="ph-title">No favorites yet</p>
              <span className="ph-sub">
                Tap the heart on any dish to save it here.
              </span>
            </div>
          )
        ) : (
          <div className="placeholder">
            <div className="ph-icon">
              <Clock size={26} />
            </div>
            <p className="ph-title">No history yet</p>
            <span className="ph-sub">
              Dishes you view and order will appear here.
            </span>
          </div>
        )}
      </div>

      <style jsx>{`
        .profile {
          padding-bottom: 28px;
        }
        .banner {
          background: var(--grad-primary);
          padding: 18px 22px 56px;
          border-bottom-left-radius: var(--r-xl);
          border-bottom-right-radius: var(--r-xl);
          position: relative;
        }
        .banner::after {
          content: '';
          position: absolute;
          inset: 0;
          border-bottom-left-radius: var(--r-xl);
          border-bottom-right-radius: var(--r-xl);
          background: radial-gradient(
            120% 80% at 80% 0%,
            rgba(255, 255, 255, 0.28),
            transparent 60%
          );
          pointer-events: none;
        }
        .banner-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
          position: relative;
          z-index: 1;
        }
        .banner-btn {
          width: 42px;
          height: 42px;
          border-radius: var(--r-full);
          border: 1px solid rgba(255, 255, 255, 0.28);
          background: rgba(255, 255, 255, 0.16);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
        }
        .banner-btn:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: rotate(45deg);
        }
        .id-row {
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          z-index: 1;
        }
        .avatar-ring {
          width: 84px;
          height: 84px;
          border-radius: var(--r-full);
          padding: 3px;
          background: rgba(255, 255, 255, 0.9);
          flex-shrink: 0;
          box-shadow: 0 10px 26px rgba(40, 40, 90, 0.28);
        }
        .avatar-img {
          width: 100%;
          height: 100%;
          border-radius: var(--r-full);
          object-fit: cover;
          display: block;
        }
        .id-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: #fff;
        }
        .name {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          line-height: 1.1;
          margin-bottom: 2px;
        }
        .detail {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.92);
        }
        .stats {
          display: flex;
          align-items: center;
          justify-content: space-around;
          margin: -32px 20px 0;
          padding: 16px 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          box-shadow: var(--shadow-md);
          position: relative;
          z-index: 2;
        }
        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          flex: 1;
        }
        .stat-num {
          font-family: var(--font-display), sans-serif;
          font-size: 19px;
          font-weight: 800;
          color: var(--text);
        }
        .stat-label {
          font-size: 11.5px;
          color: var(--text-soft);
          font-weight: 500;
        }
        .stat-divider {
          width: 1px;
          height: 30px;
          background: var(--border-strong);
        }
        .segment-wrap {
          position: sticky;
          top: 0;
          z-index: 10;
          padding: 16px 20px 12px;
        }
        .segment {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-full);
          padding: 4px;
        }
        .segment-slider {
          position: absolute;
          top: 4px;
          left: 4px;
          width: calc(50% - 4px);
          height: calc(100% - 8px);
          border-radius: var(--r-full);
          background: var(--surface);
          box-shadow: var(--shadow-sm);
          transition: transform var(--dur) var(--ease);
        }
        .segment-btn {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 0;
          background: none;
          border: none;
          font-size: 14px;
          font-weight: 700;
          color: var(--text-soft);
          cursor: pointer;
          transition: color var(--dur-fast) var(--ease);
        }
        .segment-btn.active {
          color: var(--primary-strong);
        }
        .panel {
          padding: 6px 20px 0;
        }
        .fav-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .fav-item {
          width: 100%;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 11px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          box-shadow: var(--shadow-sm);
          cursor: pointer;
          animation: fadeInUp 0.45s var(--ease-out) both;
          transition: transform var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
        }
        .fav-item:hover {
          transform: translateX(4px);
          box-shadow: var(--shadow-md);
          border-color: var(--primary-soft-2);
        }
        .fav-img {
          width: 66px;
          height: 66px;
          border-radius: var(--r-sm);
          object-fit: cover;
          flex-shrink: 0;
          background: var(--surface-2);
        }
        .fav-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .fav-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fav-place {
          font-size: 12.5px;
          color: var(--text-soft);
        }
        .fav-rating {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--text);
          margin-top: 2px;
        }
        .chevron {
          color: var(--text-faint);
          flex-shrink: 0;
          transition: color var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
        }
        .fav-item:hover .chevron {
          color: var(--primary-strong);
          transform: translateX(3px);
        }
        .placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 54px 20px;
        }
        .ph-icon {
          width: 62px;
          height: 62px;
          border-radius: var(--r-full);
          background: var(--primary-soft);
          color: var(--primary-strong);
          display: grid;
          place-items: center;
          margin-bottom: 14px;
        }
        .ph-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
        }
        .ph-sub {
          font-size: 13.5px;
          color: var(--text-soft);
          margin-top: 5px;
          max-width: 250px;
          line-height: 1.45;
        }
      `}</style>
    </div>
  );
}
