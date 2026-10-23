'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Mail,
  Star,
  ChevronRight,
  Heart,
  Clock,
  LogOut,
  Check,
  Camera,
  Loader2,
  Medal,
  Settings,
} from 'lucide-react';
import { useFoods, type Food } from '@/hooks/useFoods';
import { useReviewStats } from '@/hooks/useReviewStats';
import { useFavorites } from '@/hooks/useFavorites';
import { useUserReviews } from '@/hooks/useUserReviews';
import { useFunEffects } from '@/hooks/useFunEffects';
import ThemeToggle from './ThemeToggle';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n/LanguageContext';
import { LANGUAGES } from '@/i18n/translations';
import { calculateReviewPoints } from '@/lib/reviewPhotos';
import { nextTierOf, tierForPoints, tierProgress } from '@/lib/memberTiers';
import DishDetailModal from './DishDetailModal';

interface ProfileViewProps {
  onNavigateToChat: (initialMsg?: string) => void;
}

export default function ProfileView({ onNavigateToChat }: ProfileViewProps) {
  const { foods, byId } = useFoods();
  const { ratingOf } = useReviewStats();
  const { favorites } = useFavorites();
  const { user, signOut, updateProfile } = useAuth();
  const { t, lang, setLang } = useTranslation();
  const userReviews = useUserReviews(user?.id ?? null);
  const { enabled: funEnabled, toggle: toggleFunEffects } = useFunEffects();
  const [tab, setTab] = useState<'favorites' | 'history'>('favorites');
  const [selectedDish, setSelectedDish] = useState<Food | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const settingsAnchorRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!settingsAnchorRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  const favoriteItems = [...favorites]
    .map((id) => byId[id])
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const isGuest = user?.is_anonymous || !user?.email;
  const displayName = isGuest ? t.profile.guest : user?.email?.split('@')[0] || t.profile.guest;
  const initial = displayName.charAt(0).toUpperCase();
  const dishesAdded = user?.id ? foods.filter((f) => f.created_by === user.id).length : 0;
  // Reward points: 5 per favorite, 25 per dish added, and every review is
  // worth 5 points plus a bonus for the photos it carries.
  const reviewPoints = userReviews.reduce(
    (sum, review) => sum + calculateReviewPoints(review.image_url),
    0,
  );
  const points = favoriteItems.length * 5 + dishesAdded * 25 + reviewPoints;
  // Shopee-style membership tier derived from the reward points above.
  const tier = tierForPoints(points);
  const nextTier = nextTierOf(tier);
  const progress = Math.round(tierProgress(points) * 100);
  const pointsToNext = nextTier ? Math.max(0, nextTier.min - points) : 0;

  const handleUpgrade = async () => {
    // To upgrade, they just sign out of guest mode to go back to AuthScreen
    await signOut();
  };

  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined)?.trim() || '';

  const handleAvatarClick = () => {
    if (isGuest) {
      setAvatarError(t.profile.avatarGuestHint);
      setTimeout(() => setAvatarError(null), 2600);
      return;
    }
    avatarInputRef.current?.click();
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9.]+/g, '-');
      const path = `${user.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      const ok = await updateProfile({ avatar_url: url });
      if (!ok) setAvatarError(t.profile.avatarFailed);
    } catch {
      setAvatarError(t.profile.avatarFailed);
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="profile animate-fade-in">
      <div className="profile-aside">
      {/* Banner */}
      <div className="banner">
        <div className="banner-top">
          <button className="banner-btn" aria-label={t.profile.signOut} onClick={signOut}>
            <LogOut size={19} />
          </button>
          <div className="banner-actions" ref={settingsAnchorRef}>
            <button
              type="button"
              className={`lang-trigger ${settingsOpen ? 'open' : ''}`}
              aria-label={t.profile.settings}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              title={t.profile.settings}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <Settings size={19} />
            </button>
            <ThemeToggle variant="onPrimary" />
            {settingsOpen && (
              <div
                className="lang-pop settings-pop"
                role="dialog"
                aria-label={t.profile.settings}
              >
                <p className="lang-pop-title">{t.profile.settings}</p>

                <div className="settings-group">
                  <span className="settings-caption">{t.profile.languageLabel}</span>
                  <div className="lang-options" role="group" aria-label={t.profile.languageLabel}>
                    {LANGUAGES.map(({ code, label, flag }) => {
                      const active = lang === code;
                      return (
                        <button
                          key={code}
                          type="button"
                          className={`lang-option ${active ? 'active' : ''}`}
                          aria-pressed={active}
                          onClick={() => setLang(code)}
                        >
                          <span className="lang-flag" aria-hidden="true">
                            {flag}
                          </span>
                          <span className="lang-option-label">{label}</span>
                          {active && <Check size={16} strokeWidth={2.6} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="settings-group">
                  <div className="settings-row">
                    <span className="settings-label">{t.profile.funEffects}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={funEnabled}
                      aria-label={t.profile.funEffects}
                      className={`settings-switch ${funEnabled ? 'on' : ''}`}
                      onClick={toggleFunEffects}
                    >
                      <span className="settings-knob" />
                    </button>
                  </div>
                  <p className="settings-hint">{t.profile.funEffectsHint}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="id-row">
          <button
            type="button"
            className="avatar-ring avatar-button"
            onClick={handleAvatarClick}
            aria-label={t.profile.changeAvatar}
            title={isGuest ? t.profile.avatarGuestHint : t.profile.changeAvatar}
            disabled={avatarUploading}
          >
            <span className="avatar-ring">
              <span className="avatar-media">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName}
                    fill
                    sizes="84px"
                    className="avatar-image"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span className="avatar-placeholder">{initial}</span>
                )}
              </span>
            </span>
            <span className="avatar-overlay" aria-hidden="true">
              {avatarUploading ? <Loader2 size={18} className="spin" /> : <Camera size={18} />}
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarFile}
          />
          <div className="id-text">
            <h2 className="name">{isGuest ? t.profile.guestUser : displayName}</h2>
            <span className="detail">
              <Mail size={13} /> {isGuest ? t.profile.notSignedIn : user?.email}
            </span>
            {isGuest ? (
              <button className="upgrade-btn" onClick={handleUpgrade}>
                {t.profile.upgrade}
              </button>
            ) : (
              <div className="tier-block">
                <span className={`tier-badge tier-${tier.id}`}>
                  <Medal size={13} /> {t.profile.tierLabel(t.profile.tiers[tier.id])}
                </span>
                <span className="tier-hint">
                  {nextTier
                    ? t.profile.tierNext(pointsToNext, t.profile.tiers[nextTier.id])
                    : t.profile.tierMax}
                </span>
                <span
                  className="tier-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-label={t.profile.tierLabel(t.profile.tiers[tier.id])}
                >
                  <span
                    className={`tier-fill tier-fill-${tier.id}`}
                    style={{ width: `${progress}%` }}
                  />
                </span>
              </div>
            )}
            {avatarError && <span className="avatar-error">{avatarError}</span>}
          </div>
        </div>
      </div>

      {/* Floating stats */}
      <div className="stats">
        <div className="stat">
          <span className="stat-num">{favoriteItems.length}</span>
          <span className="stat-label">{t.profile.statFavorites}</span>
        </div>
        <span className="stat-divider" />
        <div className="stat">
          <span className="stat-num">{dishesAdded}</span>
          <span className="stat-label">{t.profile.statDishes}</span>
        </div>
        <span className="stat-divider" />
        <div className="stat">
          <span className="stat-num">{userReviews.length}</span>
          <span className="stat-label">{t.profile.statReviews}</span>
        </div>
        <span className="stat-divider" />
        <div className="stat">
          <span className="stat-num">{points}</span>
          <span className="stat-label">{t.profile.statPoints}</span>
        </div>
      </div>

      </div>

      {/* Segmented control */}
      <div className="profile-main">
      <div className="segment-wrap">
        <div className="segment">
          <span
            className="segment-slider"
            style={{ transform: `translateX(${tab === 'history' ? '100%' : '0%'})` }}
          />
          <button
            className={`segment-btn ${tab === 'favorites' ? 'active' : ''}`}
            onClick={() => setTab('favorites')}
          >
            <Heart size={15} /> {t.profile.tabFavorites}
          </button>
          <button
            className={`segment-btn ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            <Clock size={15} /> {t.profile.tabHistory}
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
                  key={item.id}
                  className="fav-item"
                  style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                  onClick={() => setSelectedDish(item)}
                >
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    width={66}
                    height={66}
                    className="fav-img"
                    style={{ objectFit: 'cover' }}
                  />
                  <div className="fav-info">
                    <h4 className="fav-name">{item.restaurant}</h4>
                    <span className="fav-place">{item.name}</span>
                    <span className="fav-rating">
                      <Star size={12} fill="var(--star)" color="var(--star)" />
                      {ratingOf(item.id, item.rating).toFixed(1)}
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
              <p className="ph-title">{t.profile.noFavorites}</p>
              <span className="ph-sub">{t.profile.noFavoritesSub}</span>
            </div>
          )
        ) : (
          <div className="placeholder">
            <div className="ph-icon">
              <Clock size={26} />
            </div>
            <p className="ph-title">{t.profile.noHistory}</p>
            <span className="ph-sub">{t.profile.noHistorySub}</span>
          </div>
        )}
      </div>

      </div>

      {selectedDish && (
        <DishDetailModal
          dish={selectedDish}
          onClose={() => setSelectedDish(null)}
          onNavigateToChat={onNavigateToChat}
        />
      )}

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
          z-index: 5;
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
        .banner-actions {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 3;
        }
        .lang-trigger {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: var(--r-full);
          border: 1px solid rgba(255, 255, 255, 0.28);
          background: rgba(255, 255, 255, 0.16);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease),
            border-color var(--dur-fast) var(--ease);
        }
        .lang-trigger:hover,
        .lang-trigger.open {
          background: rgba(255, 255, 255, 0.26);
          border-color: rgba(255, 255, 255, 0.5);
          transform: translateY(-2px);
        }
        .lang-trigger:active {
          transform: scale(0.94);
        }
        .lang-pop {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 220px;
          padding: 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          box-shadow: var(--shadow-lg);
          color: var(--text);
          animation: fadeInUp 0.22s var(--ease-out);
        }
        .settings-pop {
          width: 252px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .settings-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .settings-caption {
          margin: 0 2px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .settings-label {
          font-size: 0.8125rem;
          font-weight: 700;
          line-height: 1.25;
          color: var(--text);
        }
        .settings-hint {
          margin: 0 2px;
          font-size: 0.72rem;
          line-height: 1.35;
          color: var(--text-faint);
        }
        .settings-switch {
          position: relative;
          flex: 0 0 auto;
          width: 46px;
          height: 28px;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease),
            border-color var(--dur-fast) var(--ease);
        }
        .settings-switch.on {
          background: var(--grad-primary);
          border-color: transparent;
        }
        .settings-switch:hover {
          border-color: var(--primary);
        }
        .settings-knob {
          position: absolute;
          top: 50%;
          left: 3px;
          width: 20px;
          height: 20px;
          margin-top: -10px;
          border-radius: var(--r-full);
          background: #fff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
          transition: transform var(--dur-fast) var(--ease);
        }
        .settings-switch.on .settings-knob {
          transform: translateX(18px);
        }
        .lang-pop-title {
          margin: 0 4px 8px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .lang-options {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .lang-option {
          width: 100%;
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          border: none;
          border-radius: var(--r-sm);
          background: var(--surface-2);
          color: var(--text);
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          text-align: left;
          transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
        }
        .lang-option:hover:not(.active) {
          color: var(--primary-strong);
        }
        .lang-option.active {
          background: var(--grad-primary);
          color: var(--primary-contrast);
          box-shadow: var(--shadow-primary);
        }
        .lang-option-label {
          flex: 1;
        }
        .lang-flag {
          font-size: 1.05rem;
          line-height: 1;
        }
        .id-row {
          display: flex;
          align-items: center;
          gap: clamp(12px, 4vw, 16px);
          position: relative;
          z-index: 1;
        }
        .avatar-ring {
          position: relative;
          display: block;
          width: 100%;
          height: 100%;
          border-radius: var(--r-full);
          padding: 3px;
          background: rgba(255, 255, 255, 0.9);
          flex-shrink: 0;
          overflow: hidden;
        }
        .avatar-button {
          position: relative;
          width: clamp(72px, 20vw, 84px);
          height: clamp(72px, 20vw, 84px);
          border: none;
          padding: 0;
          border-radius: var(--r-full);
          background: none;
          cursor: pointer;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          box-shadow: 0 10px 26px rgba(40, 40, 90, 0.28);
          transition: transform var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
        }
        .avatar-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 30px rgba(40, 40, 90, 0.34);
        }
        .avatar-button:disabled {
          cursor: progress;
        }
        .avatar-media {
          position: relative;
          display: block;
          width: 100%;
          height: 100%;
          border-radius: var(--r-full);
          overflow: hidden;
        }
        .avatar-image {
          border-radius: var(--r-full);
        }
        .avatar-overlay {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: rgba(20, 14, 10, 0.5);
          color: #fff;
          opacity: 0;
          transition: opacity var(--dur-fast) var(--ease);
        }
        .avatar-button:hover .avatar-overlay,
        .avatar-button:focus-visible .avatar-overlay,
        .avatar-button:disabled .avatar-overlay {
          opacity: 1;
        }
        .spin {
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .avatar-error {
          font-size: 0.75rem;
          font-weight: 600;
          color: #ffd7cc;
        }
        .avatar-placeholder {
          width: 100%;
          height: 100%;
          border-radius: var(--r-full);
          background: var(--grad-primary);
          display: grid;
          place-items: center;
          color: #fff;
          font-family: var(--font-display), sans-serif;
          font-weight: 800;
          font-size: clamp(28px, 8vw, 34px);
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
        .tier-block {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 5px 8px;
          margin-top: 3px;
          max-width: 360px;
        }
        .tier-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px 3px 8px;
          border-radius: var(--r-full);
          border: 1px solid rgba(255, 255, 255, 0.42);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.01em;
          white-space: nowrap;
          color: #fff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.35);
        }
        .tier-bronze {
          background: linear-gradient(135deg, #d08b52, #9a5a24);
        }
        .tier-silver {
          background: linear-gradient(135deg, #eef3f9, #96a3b1);
          border-color: rgba(255, 255, 255, 0.75);
          color: #2f3944;
        }
        .tier-gold {
          background: linear-gradient(135deg, #ffe89c, #dda000);
          border-color: rgba(255, 255, 255, 0.6);
          color: #5b3c00;
        }
        .tier-diamond {
          background: linear-gradient(135deg, #a9ecff, #7f8dff);
          border-color: rgba(255, 255, 255, 0.65);
          color: #0c2145;
        }
        .tier-hint {
          min-width: 0;
          font-size: 0.7rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tier-track {
          grid-column: 1 / -1;
          height: 5px;
          border-radius: var(--r-full);
          background: rgba(255, 255, 255, 0.28);
          overflow: hidden;
        }
        .tier-fill {
          display: block;
          height: 100%;
          border-radius: inherit;
          transition: width 0.5s var(--ease);
        }
        .tier-fill-bronze {
          background: linear-gradient(90deg, #e6a877, #c17234);
        }
        .tier-fill-silver {
          background: linear-gradient(90deg, #f4f8fc, #aab6c4);
        }
        .tier-fill-gold {
          background: linear-gradient(90deg, #ffeaa8, #f0b400);
        }
        .tier-fill-diamond {
          background: linear-gradient(90deg, #b6f0ff, #8b95ff);
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
          white-space: nowrap;
        }
        /* Four stats now live in the bar — keep them readable on small phones. */
        @media (max-width: 420px) {
          .stats {
            padding: 16px 6px;
          }
          .stat-label {
            font-size: 0.625rem;
          }
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
          background: var(--bg);
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
