'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Mail, MapPin, Star, ChevronRight, Heart, Clock, LogOut, User as UserIcon } from 'lucide-react';
import { FOOD_BY_NAME } from '@/data/foods';
import { useFavorites } from '@/hooks/useFavorites';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

interface ProfileViewProps {
  onNavigateToChat: (initialMsg?: string) => void;
}

export default function ProfileView({ onNavigateToChat }: ProfileViewProps) {
  const favorites = useFavorites();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<'favorites' | 'history'>('favorites');

  const favoriteItems = favorites
    .map((name) => FOOD_BY_NAME[name])
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const isGuest = user?.is_anonymous || !user?.email;

  const handleUpgrade = async () => {
    // To upgrade, they just sign out of guest mode to go back to AuthScreen
    await signOut();
  };

  return (
    <div className="profile animate-fade-in">
      <div className="profile-aside">
      {/* Banner */}
      <div className="banner">
        <div className="banner-top">
          <button className="banner-btn" aria-label="Sign Out" onClick={signOut}>
            <LogOut size={19} />
          </button>
          <ThemeToggle variant="onPrimary" />
        </div>

        <div className="id-row">
          <div className="avatar-ring">
            <div className="avatar-placeholder">
              <UserIcon size={40} strokeWidth={1.5} />
            </div>
          </div>
          <div className="id-text">
            <h2 className="name">{isGuest ? 'Guest User' : user?.email?.split('@')[0] || 'User'}</h2>
            <span className="detail">
              <Mail size={13} /> {isGuest ? 'Not signed in' : user?.email}
            </span>
            {isGuest ? (
              <button className="upgrade-btn" onClick={handleUpgrade}>
                Upgrade account
              </button>
            ) : (
              <span className="detail">
                <MapPin size={13} /> Fooday Member
              </span>
            )}
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
      </div>

      {/* Segmented control */}
      <div className="profile-main">
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
      </div>

      <style jsx>{`
        .profile {
          padding-bottom: 28px;
        }
        /* wrappers are transparent on mobile, become columns on desktop */
        .profile-aside,
        .profile-main {
          display: contents;
        }
        .banner {
          background: var(--grad-primary);
          padding: clamp(14px, 4vw, 18px) clamp(16px, 5vw, 22px) 56px;
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
          width: 44px;
          height: 44px;
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
          gap: clamp(12px, 4vw, 16px);
          position: relative;
          z-index: 1;
        }
        .avatar-ring {
          width: clamp(72px, 20vw, 84px);
          height: clamp(72px, 20vw, 84px);
          border-radius: var(--r-full);
          padding: 3px;
          background: rgba(255, 255, 255, 0.9);
          flex-shrink: 0;
          box-shadow: 0 10px 26px rgba(40, 40, 90, 0.28);
        }
        .avatar-placeholder {
          width: 100%;
          height: 100%;
          border-radius: var(--r-full);
          background: var(--surface-2);
          display: grid;
          place-items: center;
          color: var(--text-faint);
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
          min-width: 0;
          flex: 1;
        }
        .name {
          font-size: clamp(1.25rem, 5.5vw, 1.375rem);
          font-weight: 800;
          color: #fff;
          line-height: 1.1;
          margin-bottom: 2px;
          text-transform: capitalize;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .detail {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.92);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .upgrade-btn {
          margin-top: 4px;
          align-self: flex-start;
          min-height: 36px;
          padding: 0 12px;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: #fff;
          font-size: 0.75rem;
          font-weight: 700;
          border-radius: var(--r-full);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .upgrade-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        .stats {
          display: flex;
          align-items: center;
          justify-content: space-around;
          margin: -32px clamp(12px, 4vw, 20px) 0;
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
          min-width: 0;
        }
        .stat-num {
          font-family: var(--font-display), sans-serif;
          font-size: clamp(1rem, 5vw, 1.1875rem);
          font-weight: 800;
          color: var(--text);
        }
        .stat-label {
          font-size: 0.71875rem;
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
          padding: 16px clamp(16px, 5vw, 20px) 12px;
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
          min-height: 40px;
          background: none;
          border: none;
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text-soft);
          cursor: pointer;
          transition: color var(--dur-fast) var(--ease);
        }
        .segment-btn.active {
          color: var(--primary-strong);
        }
        .panel {
          padding: 6px clamp(16px, 5vw, 20px) 0;
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
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fav-place {
          font-size: 0.78125rem;
          color: var(--text-soft);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fav-rating {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.78125rem;
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
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
        }
        .ph-sub {
          font-size: 0.84375rem;
          color: var(--text-soft);
          margin-top: 5px;
          max-width: 250px;
          line-height: 1.45;
        }

        /* Desktop: two-column dashboard that fills the content area */
        @media (min-width: 1024px) {
          div.profile {
            max-width: 1400px;
            margin-inline: auto;
            padding: 28px 28px 32px;
            display: grid;
            grid-template-columns: 320px minmax(0, 1fr);
            gap: 28px;
            align-items: start;
          }
          .profile-aside {
            display: flex;
            flex-direction: column;
            gap: 16px;
            position: sticky;
            top: 28px;
          }
          .profile-main {
            display: flex;
            flex-direction: column;
            gap: 16px;
            min-width: 0;
          }
          .banner {
            border-radius: var(--r-xl);
            padding-bottom: 22px;
          }
          .banner::after {
            border-radius: var(--r-xl);
          }
          .stats {
            margin: 0;
          }
          .segment-wrap {
            position: static;
            padding: 0;
          }
          .panel {
            padding: 0;
            min-height: 360px;
          }
          .fav-list {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }
          .placeholder {
            justify-content: center;
            min-height: 360px;
          }
        }
        @media (min-width: 1440px) {
          .fav-list {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
