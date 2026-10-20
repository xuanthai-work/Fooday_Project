'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X, Heart, MapPin, Clock, Sparkles, Star, Share2, ExternalLink, Pencil } from 'lucide-react';
import type { Food } from '@/hooks/useFoods';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/hooks/useAuth';
import { useReviews } from '@/hooks/useReviews';
import { useTranslation } from '@/i18n/LanguageContext';
import EditDishModal from './EditDishModal';

interface DishDetailModalProps {
  dish: Food;
  onClose: () => void;
  onNavigateToChat: (msg: string) => void;
}

export default function DishDetailModal({
  dish,
  onClose,
  onNavigateToChat,
}: DishDetailModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();
  const [currentDish, setCurrentDish] = useState<Food>(dish);
  const { reviews, loading: reviewsLoading, addReview, deleteReview, totalCount, averageRating } =
    useReviews(currentDish.id);

  const [copied, setCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loginHint, setLoginHint] = useState(false);
  const [draftRating, setDraftRating] = useState(5);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const closingRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Only render the portal once mounted on the client (SSR-safe).
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-mount flag (SSR-safe)
    setMounted(true);
    setNow(Date.now());
  }, []);

  const isFav = favorites.has(currentDish.id);
  const rating = Number(currentDish.rating ?? 0);
  const imageUrl = currentDish.image_url?.trim() || '';
  const isGuest = !user || Boolean(user.is_anonymous);
  // Prefer the explicit address; fall back to the restaurant name for the query.
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    currentDish.address || currentDish.restaurant,
  )}`;
  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'G';

  // Play the exit animation, then let the parent unmount us.
  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    setTimeout(onClose, 240);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditing) handleClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [handleClose, isEditing]);

  useEffect(() => {
    if (!loginHint) return;
    const timer = setTimeout(() => setLoginHint(false), 2400);
    return () => clearTimeout(timer);
  }, [loginHint]);

  const handleShare = async () => {
    const url = `${window.location.origin}/#dish-${currentDish.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${currentDish.name} · ${currentDish.restaurant}`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user cancelled the share sheet, or the clipboard is unavailable */
    }
  };

  const handleAsk = () => {
    onNavigateToChat(t.detail.askPrompt(currentDish.name, currentDish.restaurant));
    handleClose();
  };

  const handleEdit = () => {
    if (isGuest) {
      setLoginHint(true);
      return;
    }
    setIsEditing(true);
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || posting) return;
    setPosting(true);
    await addReview(draftRating, comment);
    setComment('');
    setDraftRating(5);
    setPosting(false);
  };

  // Expand the sheet to full screen once the user scrolls into the content.
  const handleScroll = () => {
    const el = sheetRef.current;
    if (!el) return;
    setExpanded(el.scrollTop > 24);
  };

  // Inlined (not a child component) so styled-jsx scoping still applies.
  const stars = (value: number, size = 14) => (
    <span className="stars-row">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= value ? 'var(--star)' : 'none'}
          color={n <= value ? 'var(--star)' : 'var(--text-faint)'}
        />
      ))}
    </span>
  );

  const formatTime = (iso: string) => {
    const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours < 1) return t.reviews.justNow;
    if (hours < 24) return t.reviews.hoursAgo(hours);
    return t.reviews.daysAgo(Math.floor(hours / 24));
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`detail-overlay ${isClosing ? 'is-closing' : ''}`}
      onClick={handleClose}
    >
      <div
        className={`detail-sheet ${expanded ? 'expanded' : ''}`}
        ref={sheetRef}
        onScroll={handleScroll}
        role="dialog"
        aria-modal="true"
        aria-label={currentDish.restaurant}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drag-handle" aria-hidden="true" />

        {/* Sticky mini header — appears once the sheet is expanded */}
        <div className={`sheet-sticky-bar ${expanded ? 'show' : ''}`}>
          <span className="sticky-title">{currentDish.restaurant}</span>
          <div className="sticky-actions">
            <button
              className="sticky-ask-btn"
              onClick={handleAsk}
              title={t.detail.askAiAbout}
              aria-label={t.detail.askAiAbout}
            >
              <Sparkles size={16} />
            </button>
            <button
              className="sticky-close"
              onClick={handleClose}
              aria-label={t.detail.close}
              title={t.detail.close}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="hero">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={currentDish.name}
              fill
              sizes="(max-width: 640px) 100vw, 560px"
              className="hero-img"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className="hero-fallback" aria-hidden="true">
              <Sparkles size={40} />
            </div>
          )}
          <div className="hero-shade" />
          <div className="hero-top">
            <button
              className={`icon-btn fav ${isFav ? 'is-fav' : ''}`}
              onClick={() => toggleFavorite(currentDish.id)}
              aria-label={isFav ? t.random.saved : t.random.favorite}
              aria-pressed={isFav}
            >
              <Heart
                size={19}
                fill={isFav ? 'var(--heart)' : 'none'}
                color={isFav ? 'var(--heart)' : '#fff'}
              />
            </button>
            <div className="hero-top-right">
              <button
                className="icon-btn"
                onClick={handleEdit}
                aria-label={t.detail.edit}
                title={t.detail.edit}
              >
                <Pencil size={18} />
              </button>
              <button
                className="icon-btn"
                onClick={handleShare}
                aria-label={t.detail.share}
                title={t.detail.share}
              >
                <Share2 size={18} />
              </button>
              <button
                className="icon-btn"
                onClick={handleClose}
                aria-label={t.detail.close}
                title={t.detail.close}
              >
                <X size={20} />
              </button>
            </div>
          </div>
          {copied && <span className="copied-toast">{t.detail.copied}</span>}
          {loginHint && (
            <span className="copied-toast login-toast">{t.detail.editRequireLogin}</span>
          )}
        </div>

        {/* Body */}
        <div className="detail-body">
          <div className="detail-head">
            <div className="detail-head-text">
              <h2 className="detail-title">{currentDish.restaurant}</h2>
              <p className="detail-sub">{currentDish.name}</p>
            </div>
            <div className="detail-head-actions">
              <button className="ask-ai-pill" onClick={handleAsk}>
                <Sparkles size={14} />
                <span>{t.detail.askAiPill || 'Hỏi AI'}</span>
              </button>
              <span className="detail-rating">
                <Star size={14} fill="var(--star)" color="var(--star)" />
                {rating.toFixed(1)}
              </span>
            </div>
          </div>

          {currentDish.tag && <span className="detail-tag">{currentDish.tag}</span>}

          <div className="info-list">
            <a
              className="info-row info-row-link"
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={t.detail.tapToOpenMaps}
            >
              <span className="info-icon">
                <MapPin size={16} />
              </span>
              <div className="info-text">
                <span className="info-label">{t.detail.address}</span>
                <span className="info-value">
                  {currentDish.address || `${currentDish.restaurant} (${t.detail.directions})`}
                </span>
              </div>
              <span className="info-arrow" aria-hidden="true">
                <ExternalLink size={15} />
              </span>
            </a>

            <div className="info-row">
              <span className="info-icon">
                <Clock size={16} />
              </span>
              <div className="info-text">
                <span className="info-label">{t.detail.openingTime}</span>
                <span className="info-value">{currentDish.opening_time || t.detail.noHours}</span>
              </div>
            </div>

            {currentDish.review_note && (
              <div className="info-row">
                <span className="info-icon">
                  <Sparkles size={16} />
                </span>
                <div className="info-text">
                  <span className="info-label">{t.detail.reviewNote}</span>
                  <span className="info-value">{currentDish.review_note}</span>
                </div>
              </div>
            )}
          </div>

          {/* Reviews & comments */}
          <section className="reviews">
            <div className="reviews-head">
              <h3 className="reviews-title">{t.reviews.title}</h3>
              <span className="reviews-count">{t.reviews.count(totalCount)}</span>
            </div>

            {totalCount > 0 && (
              <div className="reviews-summary">
                <span className="summary-score">{averageRating.toFixed(1)}</span>
                {stars(Math.round(averageRating), 16)}
              </div>
            )}

            <form className="composer" onSubmit={handlePost}>
              <div className="avatar" aria-hidden="true">
                {userInitial}
              </div>
              <div className="composer-main">
                <span className="composer-label">{t.reviews.ratingLabel}</span>
                <div className="star-picker">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      className="star-btn"
                      onClick={() => setDraftRating(n)}
                      aria-label={`${n}`}
                      aria-pressed={n === draftRating}
                    >
                      <Star
                        size={22}
                        fill={n <= draftRating ? 'var(--star)' : 'none'}
                        color={n <= draftRating ? 'var(--star)' : 'var(--text-faint)'}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  className="composer-input"
                  rows={3}
                  placeholder={t.reviews.placeholder}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="composer-actions">
                  <button
                    type="submit"
                    className="post-btn"
                    disabled={posting || !comment.trim()}
                  >
                    {posting ? t.reviews.posting : t.reviews.post}
                  </button>
                </div>
              </div>
            </form>

            {reviewsLoading ? (
              <div className="reviews-loading">{t.reviews.posting}</div>
            ) : reviews.length === 0 ? (
              <div className="reviews-empty">
                <span className="empty-emoji">💬</span>
                <p>{t.reviews.empty}</p>
              </div>
            ) : (
              <ul className="review-list">
                {reviews.map((r) => (
                  <li key={r.id} className="review-item">
                    <div className="avatar" aria-hidden="true">
                      {(r.user_name[0] || '?').toUpperCase()}
                    </div>
                    <div className="review-body">
                      <div className="review-top">
                        <span className="review-name">{r.user_name}</span>
                        <span className="review-time">{formatTime(r.created_at)}</span>
                      </div>
                      {stars(r.rating, 13)}
                      <p className="review-text">{r.comment}</p>
                    </div>
                    {user && r.user_id === user.id && (
                      <button
                        className="review-del"
                        onClick={() => deleteReview(r.id)}
                        aria-label={t.reviews.delete}
                      >
                        {t.reviews.delete}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {isEditing && (
        <EditDishModal
          dish={currentDish}
          onClose={() => setIsEditing(false)}
          onUpdated={(updated) => setCurrentDish(updated)}
        />
      )}

      <style jsx>{`
        .detail-overlay {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          z-index: 100;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgba(20, 14, 10, 0.58);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          animation: overlayIn 0.24s ease both;
        }
        .detail-overlay.is-closing {
          animation: overlayOut 0.22s ease both;
        }
        .detail-sheet {
          position: relative;
          width: 100%;
          max-width: 560px;
          max-height: 85dvh;
          overflow-y: auto;
          background: var(--surface);
          border-radius: var(--r-xl) var(--r-xl) 0 0;
          box-shadow: var(--shadow-lg);
          animation: sheetSlideUp 0.3s cubic-bezier(0.2, 0.9, 0.3, 1) both;
          will-change: transform, opacity;
          transition: max-height var(--dur) var(--ease), border-radius var(--dur) var(--ease);
        }
        .detail-overlay.is-closing .detail-sheet {
          animation: sheetSlideDown 0.22s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .drag-handle {
          width: 40px;
          height: 4px;
          margin: 8px auto;
          border-radius: var(--r-full);
          background: var(--border-strong);
        }
        .sheet-sticky-bar {
          position: sticky;
          top: 0;
          z-index: 4;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          height: 0;
          overflow: hidden;
          padding: 0 14px;
          background: var(--surface);
          border-bottom: 1px solid transparent;
          opacity: 0;
          pointer-events: none;
          transition: height var(--dur) var(--ease), opacity var(--dur) var(--ease),
            border-color var(--dur) var(--ease);
        }
        .sheet-sticky-bar.show {
          height: 52px;
          opacity: 1;
          pointer-events: auto;
          border-bottom-color: var(--border);
        }
        .sticky-title {
          font-weight: 700;
          font-size: 0.9375rem;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sticky-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .sticky-close,
        .sticky-ask-btn {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          border: none;
          border-radius: var(--r-full);
          background: var(--surface-2);
          color: var(--text-soft);
          cursor: pointer;
          transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
        }
        .sticky-close:hover {
          color: var(--heart);
          background: var(--surface-3);
        }
        .sticky-ask-btn {
          color: var(--primary);
        }
        .sticky-ask-btn:hover {
          color: var(--primary-strong);
          background: var(--primary-soft);
        }
        /* Mobile: expand the sheet to full screen on scroll */
        @media (max-width: 639px) {
          .detail-sheet.expanded {
            max-height: 100dvh;
            height: 100dvh;
            border-radius: 0;
          }
        }
        .hero {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: var(--surface-2);
          overflow: hidden;
        }
        .hero-img {
          object-fit: cover;
        }
        .hero-fallback {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: var(--grad-primary);
          color: var(--primary-contrast);
        }
        .hero-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0, 0, 0, 0.42), transparent 42%);
          pointer-events: none;
        }
        .hero-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 12px;
          z-index: 2;
        }
        .hero-top-right {
          display: flex;
          gap: 8px;
        }
        .icon-btn {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          border-radius: var(--r-full);
          border: 1px solid rgba(255, 255, 255, 0.28);
          background: rgba(0, 0, 0, 0.35);
          color: #fff;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
        }
        .icon-btn:hover {
          background: rgba(0, 0, 0, 0.5);
        }
        .icon-btn:active {
          transform: scale(0.94);
        }
        .icon-btn.is-fav :global(svg) {
          animation: heartPop 0.4s var(--ease);
        }
        .copied-toast {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 12px;
          border-radius: var(--r-full);
          background: var(--text);
          color: var(--bg);
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          animation: overlayIn 0.2s var(--ease-out) both;
          z-index: 2;
        }
        .login-toast {
          bottom: 52px;
          max-width: calc(100% - 32px);
          white-space: normal;
          text-align: center;
          line-height: 1.35;
        }
        .detail-body {
          padding: 18px 18px 8px;
        }
        .detail-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .detail-head-text {
          min-width: 0;
        }
        .detail-head-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .ask-ai-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 34px;
          padding: 0 12px;
          border-radius: var(--r-full);
          border: 1px solid var(--primary-soft-2);
          background: var(--primary-soft);
          color: var(--primary);
          font-size: 0.8125rem;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
          box-shadow: 0 0 18px rgba(255, 107, 53, 0.18);
          transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
            transform var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
        }
        .ask-ai-pill:hover {
          background: var(--grad-primary);
          color: #fff;
          transform: translateY(-1px);
          box-shadow: var(--shadow-primary);
        }
        .ask-ai-pill:active {
          transform: scale(0.95);
        }
        .detail-title {
          font-size: clamp(1.25rem, 5vw, 1.5rem);
          font-weight: 800;
          color: var(--text);
          line-height: 1.15;
        }
        .detail-sub {
          font-size: 0.9375rem;
          color: var(--text-soft);
          margin-top: 2px;
        }
        .detail-rating {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
          padding: 4px 9px;
          border-radius: var(--r-full);
          background: var(--surface-2);
          border: 1px solid var(--border);
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--text);
        }
        .detail-tag {
          display: inline-block;
          margin-top: 10px;
          padding: 4px 10px;
          border-radius: var(--r-full);
          background: var(--primary-soft);
          color: var(--primary-strong);
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .info-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }
        .info-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
        }
        .info-icon {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border-radius: var(--r-full);
          background: var(--primary-soft);
          color: var(--primary-strong);
        }
        .info-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .info-label {
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .info-value {
          font-size: 0.875rem;
          color: var(--text);
          line-height: 1.45;
          word-break: break-word;
        }
        .info-row-link {
          text-decoration: none;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
        }
        .info-row-link:hover {
          background: var(--surface-3);
          border-color: var(--primary-soft);
        }
        .info-arrow {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          color: var(--text-faint);
          transition: color var(--dur-fast) var(--ease);
        }
        .info-row-link:hover .info-arrow {
          color: var(--primary);
        }
        /* Reviews & comments */
        .reviews {
          margin-top: 24px;
          padding-bottom: 8px;
        }
        .reviews-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }
        .reviews-title {
          font-size: 1.0625rem;
          font-weight: 800;
          color: var(--text);
        }
        .reviews-count {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-faint);
        }
        .reviews-summary {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          padding: 12px 14px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
        }
        .summary-score {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text);
          line-height: 1;
        }
        .stars-row {
          display: inline-flex;
          gap: 2px;
        }
        .composer {
          display: flex;
          gap: 12px;
          margin-top: 16px;
          padding: 14px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
        }
        .avatar {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border-radius: var(--r-full);
          background: var(--grad-primary);
          color: #fff;
          font-size: 0.9375rem;
          font-weight: 800;
          text-transform: uppercase;
        }
        .composer-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .composer-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-soft);
        }
        .star-picker {
          display: flex;
          gap: 2px;
        }
        .star-btn {
          background: none;
          border: none;
          padding: 2px;
          line-height: 0;
          cursor: pointer;
        }
        .composer-input {
          width: 100%;
          min-height: 76px;
          resize: vertical;
          padding: 10px 12px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface);
          color: var(--text);
          font-family: inherit;
          font-size: 0.875rem;
          outline: none;
          transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
        }
        .composer-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--ring);
        }
        .composer-actions {
          display: flex;
          justify-content: flex-end;
        }
        .post-btn {
          height: 40px;
          padding: 0 20px;
          border: none;
          border-radius: var(--r-full);
          background: var(--grad-primary);
          color: var(--primary-contrast);
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: var(--shadow-primary);
          transition: transform var(--dur-fast) var(--ease), opacity var(--dur-fast) var(--ease);
        }
        .post-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .post-btn:disabled {
          opacity: 0.5;
          box-shadow: none;
          cursor: not-allowed;
        }
        .review-list {
          list-style: none;
          margin-top: 8px;
        }
        .review-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 0;
          border-top: 1px solid var(--border);
        }
        .review-body {
          flex: 1;
          min-width: 0;
        }
        .review-top {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }
        .review-name {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .review-time {
          font-size: 0.75rem;
          color: var(--text-faint);
          flex-shrink: 0;
        }
        .review-text {
          font-size: 0.875rem;
          color: var(--text-soft);
          line-height: 1.5;
          margin-top: 4px;
          word-break: break-word;
        }
        .review-del {
          align-self: flex-start;
          flex-shrink: 0;
          background: none;
          border: none;
          padding: 2px 4px;
          color: var(--text-faint);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: color var(--dur-fast) var(--ease);
        }
        .review-del:hover {
          color: var(--heart);
        }
        .reviews-loading {
          padding: 20px;
          text-align: center;
          color: var(--text-faint);
          font-size: 0.875rem;
        }
        .reviews-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 8px;
          padding: 32px 16px;
          color: var(--text-soft);
        }
        .empty-emoji {
          font-size: 1.75rem;
        }

        @media (min-width: 640px) {
          .detail-overlay {
            align-items: center;
            padding: 16px;
          }
          .detail-sheet {
            max-height: 86dvh;
            border-radius: var(--r-xl);
            animation: modalZoomIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .detail-overlay.is-closing .detail-sheet {
            animation: modalZoomOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) both;
          }
          .drag-handle {
            display: none;
          }
        }

        @keyframes sheetSlideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes sheetSlideDown {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(100%);
          }
        }
        @keyframes modalZoomIn {
          from {
            transform: scale(0.94) translateY(12px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        @keyframes modalZoomOut {
          from {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
          to {
            transform: scale(0.96) translateY(8px);
            opacity: 0;
          }
        }
        @keyframes overlayIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes overlayOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}
