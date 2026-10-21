'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X, Heart, MapPin, Clock, Sparkles, Star, Share2, ExternalLink, ImagePlus, Pencil, Store } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { Food } from '@/hooks/useFoods';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/hooks/useAuth';
import { useReviews } from '@/hooks/useReviews';
import { useTranslation } from '@/i18n/LanguageContext';
import { parseHashtags } from '@/lib/hashtags';
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
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();
  const [currentDish, setCurrentDish] = useState<Food>(dish);
  const { reviews, loading: reviewsLoading, addReview, deleteReview, totalCount, averageRating, blockedUntil } =
    useReviews(currentDish.id);

  const [copied, setCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loginHint, setLoginHint] = useState(false);
  const [draftRating, setDraftRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const closingRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Only render the portal once mounted on the client (SSR-safe).
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-mount flag (SSR-safe)
    setMounted(true);
    setNow(Date.now());
  }, []);

  const isFav = favorites.has(currentDish.id);
  const hashtags = parseHashtags(currentDish.tag);
  const seededRating = Number(currentDish.rating ?? 0);
  const rating = totalCount > 0 ? averageRating : seededRating;
  const images: string[] =
    currentDish.images && currentDish.images.length > 0
      ? currentDish.images
      : currentDish.image_url
        ? [currentDish.image_url]
        : [];
  const safeImgIndex = images.length
    ? Math.min(activeImgIndex, images.length - 1)
    : 0;
  const isGuest = !user || Boolean(user.is_anonymous);
  // Prefer the Google Maps link saved with the dish; fall back to a search query.
  const mapsUrl =
    currentDish.google_map_url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      currentDish.address || currentDish.restaurant,
    )}`;
  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'G';

  const formatCooldownDate = (date: Date) =>
    date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  // Play the exit animation, then let the parent unmount us.
  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    setTimeout(onClose, 240);
  }, [onClose]);

  // Keep the latest close handler in a ref so the drag listeners below never
  // have to be re-subscribed when the parent re-renders.
  const closeRef = useRef(handleClose);
  useEffect(() => {
    closeRef.current = handleClose;
  }, [handleClose]);

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

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setUploading(true);
    setFormError(null);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9.]+/g, '-');
      const path = `${user.id}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from('review-images').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('review-images').getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
    } catch {
      setFormError(t.reviews.uploadFailed);
    } finally {
      setUploading(false);
    }
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
    if (!comment.trim() || posting || uploading || blockedUntil) return;
    setPosting(true);
    setFormError(null);
    const result = await addReview(draftRating, comment, photoUrl);
    if (result === 'ok') {
      setComment('');
      setDraftRating(5);
      setPhotoUrl(null);
    } else if (result === 'cooldown') {
      setFormError(t.reviews.cooldown(formatCooldownDate(blockedUntil ?? new Date())));
    } else if (result !== 'empty') {
      setFormError(t.reviews.postFailed);
    }
    setPosting(false);
  };

  // Reveal the sticky mini header only once the hero photo has scrolled away.
  // The sheet height never changes while scrolling, so momentum stays smooth.
  const handleScroll = () => {
    const el = sheetRef.current;
    if (!el) return;
    const threshold = heroRef.current?.offsetHeight ?? 200;
    setShowSticky(el.scrollTop > threshold);
  };

  // Keep the photo counter in sync with the horizontal swipe position.
  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el || images.length === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveImgIndex(Math.max(0, Math.min(idx, images.length - 1)));
  };

  // --- Pull-down to dismiss -------------------------------------------------
  // Grabbing the sheet while it rests at the very top and pulling down moves
  // it along with the finger; releasing past the threshold — or flicking it
  // downwards quickly — closes the sheet. While the content is scrolled the
  // swipe keeps scrolling the content instead.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || isEditing) return;

    const THRESHOLD = 80; // damped px that count as "pulled far enough"
    const RESISTANCE = 0.85; // dampens the travel so the sheet feels elastic
    const FLING_SPEED = 0.45; // px/ms that counts as a flick
    const FLING_MIN = 24; // …but only after a small pull
    const SLOP = 8; // travel needed before the gesture is claimed
    const SPRING = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';

    let startY = 0;
    let startX = 0;
    let anchorY = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let offset = 0;
    let tracking = false;
    let dragging = false;
    let scrolled = false;

    const paint = (value: number) => {
      offset = value;
      el.style.setProperty('--drag-offset', `${value}px`);
    };

    const begin = () => {
      dragging = true;
      el.style.transition = 'none';
      setIsDragging(true);
    };

    const move = (y: number, time: number) => {
      const dt = time - lastTime;
      if (dt > 0) velocity = (y - lastY) / dt;
      lastY = y;
      lastTime = time;

      if (!dragging) {
        // Only claim the gesture when the content rests at the very top.
        if (el.scrollTop > 0) return;
        if (y - startY <= SLOP) return;
        if (scrolled) anchorY = y; // the content scrolled first — rebase
        begin();
      }

      paint(Math.max(0, (y - anchorY) * RESISTANCE));
    };

    const settle = () => {
      if (!dragging) return;
      dragging = false;
      setIsDragging(false);
      const flung = velocity > FLING_SPEED && offset > FLING_MIN;
      if (offset > THRESHOLD || flung) {
        closeRef.current();
        return;
      }
      // Not far enough — spring back to the resting position.
      el.style.transition = SPRING;
      paint(0);
    };

    const start = (y: number, x: number) => {
      startY = y;
      startX = x;
      anchorY = y;
      lastY = y;
      lastTime = performance.now();
      velocity = 0;
      offset = 0;
      tracking = true;
      dragging = false;
      scrolled = el.scrollTop > 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      start(e.touches[0].clientY, e.touches[0].clientX);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (el.scrollTop > 0) scrolled = true;
      const dy = touch.clientY - startY;
      const dx = touch.clientX - startX;
      // Cancel the native scroll only for a clearly vertical swipe aimed at the
      // sheet — a sideways swipe keeps scrolling the photo carousel.
      const claimed = dragging || (dy > SLOP && Math.abs(dy) > Math.abs(dx));
      if (claimed && el.scrollTop <= 0 && e.cancelable) {
        e.preventDefault();
      }
      move(touch.clientY, performance.now());
    };

    const onTouchEnd = () => {
      tracking = false;
      settle();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!tracking) return;
      if (el.scrollTop > 0) scrolled = true;
      move(e.clientY, performance.now());
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      tracking = false;
      settle();
    };

    const onPointerDown = (e: PointerEvent) => {
      // Touch is handled by the touch listeners above: only they can cancel
      // the native scroll while the sheet is being dragged.
      if (e.pointerType === 'touch' || e.button !== 0) return;
      // Ignore drags that start on the scrollbar.
      const rect = el.getBoundingClientRect();
      if (e.clientX - rect.left > el.clientWidth) return;
      start(e.clientY, e.clientX);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('pointerdown', onPointerDown);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isEditing]);

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
      {/* The shell carries the enter/exit animation so the sheet itself stays
          free to be transformed by the pull-down gesture. */}
      <div className="sheet-shell" onClick={(e) => e.stopPropagation()}>
        <div
          className={`detail-sheet ${isDragging ? 'is-dragging' : ''}`}
          ref={sheetRef}
          onScroll={handleScroll}
          role="dialog"
          aria-modal="true"
          aria-label={currentDish.name}
        >
          {/* Sticky mini header — fades in once the hero photo is out of view.
              It overlays the content (negative margin) so showing it never
              shifts the layout around. */}
          <div className={`sheet-sticky-bar ${showSticky ? 'show' : ''}`}>
            <span className="sticky-spacer" aria-hidden="true" />
            <span className="sticky-title">
              {currentDish.name} · {currentDish.restaurant}
            </span>
            <button
              className="sticky-share"
              onClick={handleShare}
              aria-label={t.detail.share}
              title={t.detail.share}
            >
              <Share2 size={18} />
            </button>
          </div>

          {/* Hero — Google Maps style swipeable photo carousel (bleeds to the top edge) */}
          <div className="hero" ref={heroRef}>
            <div className="drag-handle" aria-hidden="true" />
            {images.length > 0 ? (
              <>
                <div className="carousel-track" ref={carouselRef} onScroll={handleCarouselScroll}>
                  {images.map((src, i) => (
                    <div key={`${src}-${i}`} className="carousel-slide">
                      <Image
                        src={src}
                        alt={`${currentDish.name} ${i + 1}`}
                        fill
                        sizes="(max-width: 640px) 100vw, 560px)"
                        style={{ objectFit: 'cover' }}
                        priority={i === 0}
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
                {images.length > 1 && (
                  <span className="carousel-badge">
                    {safeImgIndex + 1} / {images.length}
                  </span>
                )}
              </>
            ) : (
              <div className="hero-fallback" aria-hidden="true">
                <Sparkles size={40} />
              </div>
            )}
            <div className="hero-shade" />
            <div className="hero-top">
              <div className="hero-top-left">
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
              </div>
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
                <h2 className="detail-title">{currentDish.name}</h2>
                <p className="detail-sub">
                  <Store size={14} />
                  <span>{currentDish.restaurant}</span>
                </p>
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

            {hashtags.length > 0 && (
              <div className="detail-tags">
                {hashtags.map((h) => (
                  <span key={h} className="detail-tag">
                    {h}
                  </span>
                ))}
              </div>
            )}

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
                    {currentDish.address || t.detail.noAddress}
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

              {blockedUntil ? (
                <p className="cooldown-note">
                  {t.reviews.cooldown(
                    formatCooldownDate(blockedUntil),
                  )}
                </p>
              ) : (
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
                    {photoUrl && (
                      <div className="photo-preview">
                        <Image
                          src={photoUrl}
                          alt=""
                          width={88}
                          height={88}
                          className="photo-preview-img"
                        />
                        <button
                          type="button"
                          className="photo-remove"
                          onClick={() => setPhotoUrl(null)}
                          aria-label={t.reviews.removePhoto}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    {formError && <p className="form-error">{formError}</p>}
                    <div className="composer-actions">
                      <button
                        type="button"
                        className="photo-btn"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading || posting}
                      >
                        <ImagePlus size={16} />
                        {uploading ? t.reviews.photoUploading : t.reviews.addPhoto}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handlePhoto}
                      />
                      <button
                        type="submit"
                        className="post-btn"
                        disabled={posting || uploading || !comment.trim()}
                      >
                        {posting ? t.reviews.posting : t.reviews.post}
                      </button>
                    </div>
                  </div>
                </form>
              )}

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
                        {r.image_url && (
                          <a
                            className="review-photo"
                            href={r.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Image
                              src={r.image_url}
                              alt=""
                              width={220}
                              height={160}
                              className="review-photo-img"
                            />
                          </a>
                        )}
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
      </div>

      {isEditing && (
        <EditDishModal
          dish={currentDish}
          onClose={() => setIsEditing(false)}
          onUpdated={(updated) => {
            setCurrentDish(updated);
            setActiveImgIndex(0);
            carouselRef.current?.scrollTo({ left: 0 });
          }}
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
        /* The shell plays the enter/exit animation; the sheet inside stays
           free so the pull-down gesture can transform it on its own. */
        .sheet-shell {
          position: relative;
          width: 100%;
          max-width: 560px;
          display: flex;
          flex-direction: column;
          animation: sheetSlideUp 0.3s cubic-bezier(0.2, 0.9, 0.3, 1) both;
          will-change: transform;
        }
        .detail-overlay.is-closing .sheet-shell {
          animation: sheetSlideDown 0.22s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .detail-sheet {
          position: relative;
          width: 100%;
          max-height: 85dvh;
          overflow-y: auto;
          overflow-x: hidden;
          background: var(--surface);
          border-radius: var(--r-xl) var(--r-xl) 0 0;
          box-shadow: var(--shadow-lg);
          will-change: transform;
          overscroll-behavior: contain;
          transform: translateY(var(--drag-offset, 0px));
          transition: transform 0.25s var(--ease);
        }
        .detail-sheet.is-dragging {
          transition: none;
          user-select: none;
          -webkit-user-select: none;
          cursor: grabbing;
        }
        /* Floating grab handle — sits on top of the hero, never eats layout space */
        .drag-handle {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 6;
          width: 44px;
          height: 5px;
          border-radius: var(--r-full);
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          pointer-events: none;
          animation: handleBreathe 2.6s ease-in-out infinite;
        }
        /* Sticky mini header — overlays the content (negative margin) so it
           never shifts the layout, it just fades/slides in over the hero. */
        .sheet-sticky-bar {
          position: sticky;
          top: 0;
          z-index: 6;
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr) 36px;
          align-items: center;
          gap: 10px;
          height: 52px;
          margin-bottom: -52px;
          padding: 0 14px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
          opacity: 0;
          transform: translateY(-100%);
          pointer-events: none;
          will-change: transform, opacity;
          transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
        }
        .sheet-sticky-bar.show {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        .sticky-spacer {
          width: 36px;
          height: 36px;
        }
        .sticky-title {
          min-width: 0;
          text-align: center;
          font-weight: 700;
          font-size: 0.9375rem;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sticky-share {
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
        .sticky-share:hover {
          color: var(--primary);
          background: var(--primary-soft);
        }
        /* Mobile: fixed sheet height — scrolling never changes it, so the
           momentum stays smooth and the action buttons never jump away. */
        @media (max-width: 639px) {
          .detail-sheet {
            height: 90dvh;
            max-height: 90dvh;
            border-radius: 24px 24px 0 0;
          }
        }        .hero {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: var(--surface-2);
          overflow: hidden;
        }
        .carousel-track {
          display: flex;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
          width: 100%;
          height: 100%;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
        }
        .carousel-track::-webkit-scrollbar {
          display: none;
        }
        .carousel-slide {
          flex: 0 0 100%;
          min-width: 100%;
          height: 100%;
          scroll-snap-align: start;
          position: relative;
        }
        .carousel-badge {
          position: absolute;
          bottom: 12px;
          right: 14px;
          background: rgba(0, 0, 0, 0.65);
          color: #fff;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          z-index: 2;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          pointer-events: none;
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
        .hero-top-left {
          display: flex;
          gap: 8px;
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
          word-break: break-word;
        }
        .detail-sub {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.9375rem;
          color: var(--text-soft);
          margin-top: 4px;
        }
        .detail-sub :global(svg) {
          flex-shrink: 0;
          color: var(--primary-strong);
        }
        .detail-sub span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
        .detail-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 8px 0 16px;
        }
        .detail-tag {
          display: inline-flex;
          align-items: center;
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
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .photo-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 40px;
          padding: 0 12px;
          border-radius: var(--r-full);
          border: 1px solid var(--border-strong);
          background: var(--surface);
          color: var(--text);
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
        }
        .photo-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .photo-preview {
          position: relative;
          width: 88px;
          height: 88px;
          border-radius: var(--r-sm);
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .photo-remove {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 24px;
          height: 24px;
          border: none;
          border-radius: var(--r-full);
          background: rgba(20, 14, 10, 0.72);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .form-error,
        .cooldown-note {
          margin: 12px 0 0;
          font-size: 0.8125rem;
          line-height: 1.45;
          color: var(--text-soft);
        }
        .cooldown-note {
          padding: 12px 14px;
          border-radius: var(--r-md);
          background: var(--surface-2);
          border: 1px solid var(--border);
        }
        .form-error {
          color: var(--heart);
        }
        .review-photo {
          display: block;
          width: min(100%, 220px);
          margin-top: 8px;
          border-radius: var(--r-sm);
          overflow: hidden;
          border: 1px solid var(--border);
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
          .sheet-shell {
            animation: modalZoomIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .detail-overlay.is-closing .sheet-shell {
            animation: modalZoomOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) both;
          }
          .detail-sheet {
            max-height: 86dvh;
            border-radius: var(--r-xl);
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
        /* Gentle pulse — hints that the handle can be grabbed to pull the
           sheet down. */
        @keyframes handleBreathe {
          0%,
          100% {
            opacity: 0.75;
          }
          50% {
            opacity: 1;
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
