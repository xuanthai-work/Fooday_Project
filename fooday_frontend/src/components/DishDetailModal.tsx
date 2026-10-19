'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X, Heart, MapPin, Clock, Sparkles, Star, Share2, Navigation } from 'lucide-react';
import type { Food } from '@/hooks/useFoods';
import { useFavorites } from '@/hooks/useFavorites';
import { useTranslation } from '@/i18n/LanguageContext';

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
  const { favorites, toggleFavorite } = useFavorites();
  const [copied, setCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closingRef = useRef(false);

  // Only render the portal once mounted on the client (SSR-safe).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-mount flag (SSR-safe)
    setMounted(true);
  }, []);

  const isFav = favorites.has(dish.id);
  const rating = Number(dish.rating ?? 0);
  const imageUrl = dish.image_url?.trim() || '';
  // Prefer the explicit address; fall back to the restaurant name for the query.
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    dish.address || dish.restaurant,
  )}`;

  // Play the exit animation, then let the parent unmount us.
  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    setTimeout(onClose, 240);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [handleClose]);

  const handleShare = async () => {
    const url = `${window.location.origin}/#dish-${dish.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${dish.name} · ${dish.restaurant}`,
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
    onNavigateToChat(t.detail.askPrompt(dish.name, dish.restaurant));
    handleClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`detail-overlay ${isClosing ? 'is-closing' : ''}`}
      onClick={handleClose}
    >
      <div
        className="detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={dish.restaurant}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="hero">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={dish.name}
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
              onClick={() => toggleFavorite(dish.id)}
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
        </div>

        {/* Body */}
        <div className="detail-body">
          <div className="detail-head">
            <div className="detail-head-text">
              <h2 className="detail-title">{dish.restaurant}</h2>
              <p className="detail-sub">{dish.name}</p>
            </div>
            <span className="detail-rating">
              <Star size={14} fill="var(--star)" color="var(--star)" />
              {rating.toFixed(1)}
            </span>
          </div>

          {dish.tag && <span className="detail-tag">{dish.tag}</span>}

          <div className="info-list">
            <div className="info-row">
              <span className="info-icon">
                <MapPin size={16} />
              </span>
              <div className="info-text">
                <span className="info-label">{t.detail.address}</span>
                <span className="info-value">{dish.address || t.detail.noAddress}</span>
              </div>
              <a
                className="info-action"
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.detail.directions}
                title={t.detail.directions}
              >
                <Navigation size={16} />
              </a>
            </div>

            <div className="info-row">
              <span className="info-icon">
                <Clock size={16} />
              </span>
              <div className="info-text">
                <span className="info-label">{t.detail.openingTime}</span>
                <span className="info-value">{dish.opening_time || t.detail.noHours}</span>
              </div>
            </div>

            {dish.review_note && (
              <div className="info-row">
                <span className="info-icon">
                  <Sparkles size={16} />
                </span>
                <div className="info-text">
                  <span className="info-label">{t.detail.reviewNote}</span>
                  <span className="info-value">{dish.review_note}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="detail-actions">
          <button className="act-primary" onClick={handleAsk}>
            <Sparkles size={17} /> {t.detail.askAiAbout}
          </button>
          <a
            className="act-secondary"
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation size={17} /> {t.detail.directions}
          </a>
        </div>
      </div>

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
          background: rgba(10, 10, 25, 0.55);
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
          max-height: 92dvh;
          overflow-y: auto;
          background: var(--surface);
          border-radius: var(--r-xl) var(--r-xl) 0 0;
          box-shadow: var(--shadow-lg);
          animation: sheetSlideUp 0.3s cubic-bezier(0.2, 0.9, 0.3, 1) both;
          will-change: transform, opacity;
        }
        .detail-overlay.is-closing .detail-sheet {
          animation: sheetSlideDown 0.22s cubic-bezier(0.4, 0, 0.2, 1) both;
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
        .detail-body {
          padding: 18px 18px 0;
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
        .info-action {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          border-radius: var(--r-full);
          border: 1px solid var(--border-strong);
          color: var(--primary-strong);
          text-decoration: none;
          transition: background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
        }
        .info-action:hover {
          background: var(--primary-soft);
          border-color: var(--primary);
        }
        .detail-actions {
          position: sticky;
          bottom: 0;
          display: flex;
          gap: 10px;
          margin-top: 18px;
          padding: 16px 18px calc(16px + env(safe-area-inset-bottom, 0px));
          background: var(--surface);
          border-top: 1px solid var(--border);
        }
        .act-primary {
          flex: 1.4;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 48px;
          padding: 0 12px;
          border: none;
          border-radius: var(--r-full);
          background: var(--grad-primary);
          color: var(--primary-contrast);
          font-size: 0.9375rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: var(--shadow-primary);
          transition: transform var(--dur-fast) var(--ease);
        }
        .act-primary:hover {
          transform: translateY(-2px);
        }
        .act-primary:active {
          transform: scale(0.95);
        }
        .act-secondary {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 48px;
          padding: 0 12px;
          border: 1px solid var(--border-strong);
          border-radius: var(--r-full);
          background: var(--surface-2);
          color: var(--text);
          font-size: 0.9375rem;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          transition: border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
        }
        .act-secondary:hover {
          border-color: var(--primary);
          color: var(--primary-strong);
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
