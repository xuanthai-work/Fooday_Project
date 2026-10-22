'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { User } from '@supabase/supabase-js';
import { X, Upload, Star, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { refreshFoods, Food, FoodCategory, FOOD_CATEGORIES, Contributor, parseContributors } from '@/hooks/useFoods';
import { dishImageService, mapService, DishImage } from '@/services/api';
import { useTranslation } from '@/i18n/LanguageContext';
import { TRENDING_HASHTAGS, normalizeSingleHashtag, parseHashtags, serializeHashtags } from '@/lib/hashtags';
import { isGoogleMapsUrl } from '@/lib/maps';
import { parseBranches } from '@/lib/geo';
import DishNameAutocomplete from './DishNameAutocomplete';
import BranchEditor, { createBranchDraft, type BranchDraft } from './BranchEditor';

export { TRENDING_HASHTAGS };

interface EditDishModalProps {
  dish: Food;
  onClose: () => void;
  onUpdated?: (updated: Food) => void;
}

/**
 * GitHub-style contributor list of a dish: everybody who edited it besides
 * its creator. The creator keeps living in `created_by`.
 */
function buildContributors(dish: Food, user: User | null): Contributor[] {
  const list = parseContributors(dish.contributors);
  if (!user) return list;
  // The creator never shows up as a contributor of their own dish.
  if (dish.created_by && dish.created_by === user.id) return list;

  const entry: Contributor = {
    id: user.id,
    name: user.email?.split('@')[0] || 'User',
    avatar_url: (user.user_metadata?.avatar_url as string | undefined) || '',
    updated_at: new Date().toISOString(),
  };

  const index = list.findIndex((contributor) => contributor.id === user.id);
  if (index === -1) return [...list, entry];
  const next = [...list];
  next[index] = { ...next[index], ...entry };
  return next;
}

export default function EditDishModal({ dish, onClose, onUpdated }: EditDishModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [name, setName] = useState(dish.name ?? '');
  const [restaurant, setRestaurant] = useState(dish.restaurant ?? '');
  const [googleMapUrl, setGoogleMapUrl] = useState(dish.google_map_url ?? '');
  const [category, setCategory] = useState<FoodCategory>(dish.category ?? 'Foods');
  const [address, setAddress] = useState(dish.address ?? '');
  const [isResolvingMap, setIsResolvingMap] = useState(false);
  const [openingTime, setOpeningTime] = useState(dish.opening_time ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(() => parseHashtags(dish.tag));
  const [tagInput, setTagInput] = useState('');
  const [reviewNote, setReviewNote] = useState(dish.review_note ?? '');
  const [rating, setRating] = useState(Number(dish.rating ?? 5));
  const [imageList, setImageList] = useState<string[]>(
    dish.images && dish.images.length > 0
      ? dish.images
      : dish.image_url
        ? [dish.image_url]
        : [],
  );
  const [candidates, setCandidates] = useState<DishImage[]>([]);
  const [branches, setBranches] = useState<BranchDraft[]>(() =>
    parseBranches(dish.branches).map((branch) => ({
      ...createBranchDraft(),
      name: branch.name || '',
      googleMapUrl: branch.google_map_url || '',
      address: branch.address || '',
      lat: branch.lat ?? null,
      lng: branch.lng ?? null,
    })),
  );
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Unsplash suggestions based on the dish name.
  useEffect(() => {
    const q = name.trim();
    if (!q) return;
    let active = true;
    const timer = setTimeout(async () => {
      const imgs = await dishImageService.search(q);
      if (!active) return;
      setCandidates(imgs);
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [name]);

  // Auto-resolve the Google Maps link: fill the address (and the restaurant
  // name when it is still empty) as soon as the backend resolves the link.
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveSeqRef = useRef(0);

  const handleGoogleMapUrlChange = (value: string) => {
    setGoogleMapUrl(value);
    resolveSeqRef.current += 1;
    if (resolveTimerRef.current) {
      clearTimeout(resolveTimerRef.current);
      resolveTimerRef.current = null;
    }

    const url = value.trim();
    if (!isGoogleMapsUrl(url)) {
      setIsResolvingMap(false);
      return;
    }

    setIsResolvingMap(true);
    resolveTimerRef.current = setTimeout(async () => {
      resolveTimerRef.current = null;
      const seq = resolveSeqRef.current;
      const info = await mapService.parseMapLink(url);
      if (seq !== resolveSeqRef.current) return;
      setIsResolvingMap(false);
      if (!info) return;
      if (info.address) setAddress(info.address);
      if (info.restaurant_name) {
        setRestaurant((prev) => (prev.trim() ? prev : (info.restaurant_name as string)));
      }
    }, 500);
  };

  // Drop a pending resolution when the modal unmounts.
  useEffect(
    () => () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    },
    [],
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0 || !user) return;
    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const [i, file] of files.entries()) {
        const safe = file.name.replace(/[^a-zA-Z0-9.]+/g, '-');
        const path = `${user.id}/${Date.now()}-${i}-${safe}`;
        const { error: upErr } = await supabase.storage.from('dish-images').upload(path, file);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('dish-images').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setImageList((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.addDish.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const addPhoto = (url: string) => {
    setImageList((prev) => (prev.includes(url) ? prev : [...prev, url]));
  };

  const removeImage = (index: number) => {
    if (imageList.length <= 1) {
      setError(t.addDish.minOnePhoto);
      return;
    }
    setError(null);
    setImageList((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = Boolean(name.trim() && restaurant.trim() && imageList.length > 0) && !busy;

  const handleAddTag = (raw: string) => {
    const normalized = normalizeSingleHashtag(raw);
    setTagInput('');
    if (!normalized) return;
    setSelectedTags((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
  };

  const handleTogglePreset = (preset: string) => {
    setSelectedTags((prev) =>
      prev.includes(preset) ? prev.filter((item) => item !== preset) : [...prev, preset],
    );
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const finalTag = serializeHashtags(
      tagInput.trim() ? [...selectedTags, tagInput] : selectedTags,
    );

    // Keep only the branches that carry real information.
    const cleanBranches = branches
      .map((branch) => ({
        name: branch.name.trim(),
        address: branch.address.trim(),
        google_map_url: branch.googleMapUrl.trim(),
        lat: branch.lat ?? null,
        lng: branch.lng ?? null,
      }))
      .filter((branch) => branch.name || branch.address || branch.google_map_url);

    const basePayload = {
      name: name.trim(),
      restaurant: restaurant.trim(),
      category,
      rating,
      address: address.trim() || null,
      google_map_url: googleMapUrl.trim() || null,
      opening_time: openingTime.trim() || null,
      tag: finalTag || null,
      review_note: reviewNote.trim() || null,
      image_url: imageList[0] || dish.image_url || '',
      images: imageList,
      branches: cleanBranches.length > 0 ? cleanBranches : null,
    };

    // Who helped build this dish.
    const payload = {
      ...basePayload,
      contributors: buildContributors(dish, user),
    };

    let { data, error: updErr } = await supabase
      .from('foods')
      .update(payload)
      .eq('id', dish.id)
      .select()
      .single();

    if (updErr && /contributors/i.test(updErr.message)) {
      // The `contributors` column is not migrated yet — save without it.
      const retry = await supabase
        .from('foods')
        .update(basePayload)
        .eq('id', dish.id)
        .select()
        .single();
      data = retry.data;
      updErr = retry.error;
    }

    if (updErr) {
      setError(updErr.message);
      setBusy(false);
      return;
    }

    await refreshFoods();
    onUpdated?.(data as Food);
    onClose();
  };

  return (
    <div
      className="overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t.editDish.title}
      >
        <header className="modal-head">
          <h2 className="modal-title">{t.editDish.title}</h2>
          <button className="close" onClick={onClose} aria-label={t.detail.close}>
            <X size={20} />
          </button>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          {/* Photos — existing gallery + multi upload + Unsplash suggestions */}
          <div className="image-block">
            {imageList.length > 0 ? (
              <div className="photo-grid">
                {imageList.map((src, i) => (
                  <div className="photo-card" key={`${src}-${i}`}>
                    <Image
                      src={src}
                      alt={`${name || 'Dish'} ${i + 1}`}
                      fill
                      sizes="140px"
                      className="photo-img"
                      style={{ objectFit: 'cover' }}
                    />
                    {i === 0 && <span className="cover-badge">{t.addDish.coverBadge}</span>}
                    <button
                      type="button"
                      className="photo-del"
                      onClick={() => removeImage(i)}
                      aria-label={t.addDish.deletePhoto}
                      title={t.addDish.deletePhoto}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="photo-add"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                  <span>{uploading ? t.addDish.uploading : t.addDish.addMorePhotos}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="preview-empty"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 size={22} className="spin" />
                ) : (
                  <Upload size={22} />
                )}
                <span>{uploading ? t.addDish.uploading : t.addDish.pasteHint}</span>
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleUpload}
            />

            {candidates.length > 0 && (
              <div className="thumbs">
                {candidates.map((c) => (
                  <button
                    type="button"
                    key={c.url}
                    className={`thumb ${imageList.includes(c.url) ? 'active' : ''}`}
                    onClick={() => addPhoto(c.url)}
                    aria-label={t.addDish.useThisPhoto}
                  >
                    <Image
                      src={c.url}
                      alt={c.alt}
                      width={52}
                      height={52}
                      className="thumb-img"
                      style={{ objectFit: 'cover' }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Restaurant */}
          <label className={`field ${isResolvingMap ? 'resolving' : ''}`}>
            <span className="label">{t.editDish.restaurant}</span>
            <input
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
              placeholder={t.addDish.restaurantPlaceholder}
              required
            />
          </label>

          {/* Dish name */}
          <div className="field">
            <span className="label">{t.editDish.dishName}</span>
            <DishNameAutocomplete
              value={name}
              onChange={setName}
              placeholder={t.addDish.dishNamePlaceholder}
              required
              aria-label={t.editDish.dishName}
            />
          </div>

          {/* Category */}
          <div className="field">
            <span className="label">{t.editDish.category}</span>
            <div className="chips">
              {FOOD_CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`chip ${category === c ? 'active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {t.home.categories[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Opening hours */}
          <label className="field">
            <span className="label">{t.editDish.openingTime}</span>
            <input
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              placeholder={t.detail.noHours}
              aria-label={t.editDish.openingTime}
            />
          </label>

          {/* Google Maps link — auto-resolves the address */}
          <label className="field">
            <span className="label">{t.map.googleMapLabel}</span>
            <input
              value={googleMapUrl}
              onChange={(e) => handleGoogleMapUrlChange(e.target.value)}
              placeholder={t.map.googleMapPlaceholder}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              aria-label={t.map.googleMapLabel}
            />
            {googleMapUrl.trim() && !isGoogleMapsUrl(googleMapUrl) && (
              <span className="field-hint error-hint">{t.map.googleMapRequired}</span>
            )}
          </label>

          {/* Address — auto-filled from the Google Maps link */}
          <label className={`field ${isResolvingMap ? 'resolving' : ''}`}>
            <span className="label">{t.map.addressLabel}</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={
                isResolvingMap ? t.map.resolvingAddress : t.map.addressPlaceholder
              }
              disabled={isResolvingMap}
              aria-busy={isResolvingMap}
              aria-label={t.map.addressLabel}
            />
            {isResolvingMap && (
              <span className="field-hint resolving-hint">
                <Loader2 size={13} className="spin" />
                {t.map.resolvingAddress}
              </span>
            )}
          </label>

          {/* Branches — the extra outlets of the same restaurant */}
          <div className="field">
            <span className="label">{t.branches.branchesSection}</span>
            <BranchEditor branches={branches} onChange={setBranches} />
          </div>

          {/* Notes */}
          <label className="field">
            <span className="label">{t.editDish.reviewNote}</span>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
              placeholder={t.detail.reviewNote}
              aria-label={t.editDish.reviewNote}
            />
          </label>

          {/* Tags — multi-select presets + custom hashtag input */}
          <div className="field">
            <span className="label">{t.editDish.tag}</span>

            {selectedTags.length > 0 && (
              <div className="selected-tags">
                {selectedTags.map((selected) => (
                  <span key={selected} className="selected-tag-chip">
                    {selected}
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() =>
                        setSelectedTags((prev) => prev.filter((item) => item !== selected))
                      }
                      aria-label={`Remove ${selected}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="tag-input-row">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={t.editDish.tagPlaceholder}
                aria-label={t.editDish.tag}
              />
              <button
                type="button"
                className="tag-add-btn"
                onClick={() => handleAddTag(tagInput)}
              >
                {t.editDish.addTag}
              </button>
            </div>

            <div className="hashtag-presets">
              <span className="hashtag-presets-label">{t.editDish.trendingHashtagsLabel}</span>
              <div className="hashtag-chips">
                {TRENDING_HASHTAGS.map((preset) => {
                  const isSelected = selectedTags.includes(preset);
                  return (
                    <button
                      type="button"
                      key={preset}
                      className={`hashtag-chip ${isSelected ? 'active' : ''}`}
                      onClick={() => handleTogglePreset(preset)}
                      aria-pressed={isSelected}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rating */}
          <div className="field">
            <span className="label">{t.editDish.rating}</span>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  className="star"
                  onClick={() => setRating(n)}
                  aria-label={t.addDish.starAria(n)}
                >
                  <Star
                    size={22}
                    fill={n <= rating ? 'var(--star)' : 'none'}
                    color={n <= rating ? 'var(--star)' : 'var(--text-faint)'}
                  />
                </button>
              ))}
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="actions">
            <button type="button" className="cancel" onClick={onClose}>
              {t.editDish.cancel}
            </button>
            <button type="submit" className="submit" disabled={!canSubmit}>
              {busy ? (
                <>
                  <Loader2 size={18} className="spin" />
                  <span>{t.editDish.saving}</span>
                </>
              ) : (
                t.editDish.save
              )}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(20, 14, 10, 0.58);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          animation: fadeIn 0.2s var(--ease);
        }
        .modal {
          width: 100%;
          max-width: 460px;
          max-height: 92dvh;
          overflow-y: auto;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-xl);
          box-shadow: var(--shadow-lg);
          animation: fadeInUp 0.32s var(--ease-out) both;
        }
        @media (max-width: 600px) {
          .overlay {
            padding: 0;
            align-items: stretch;
          }
          .modal {
            max-width: none;
            max-height: 100dvh;
            border-radius: 0;
          }
        }
        .modal-head {
          position: sticky;
          top: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          z-index: 1;
        }
        .modal-title {
          font-family: var(--font-display), sans-serif;
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
        }
        .close {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: var(--r-full);
          border: none;
          background: var(--surface-2);
          color: var(--text-soft);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
        }
        .close:hover {
          background: var(--surface-3);
          color: var(--text);
        }
        .form {
          padding: 18px 20px 22px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .image-block {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .photo-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .photo-card {
          position: relative;
          width: 92px;
          height: 92px;
          border-radius: var(--r-md);
          overflow: hidden;
          background: var(--surface-2);
          border: 1px solid var(--border);
        }
        .photo-img {
          object-fit: cover;
        }
        .cover-badge {
          position: absolute;
          left: 6px;
          bottom: 6px;
          padding: 2px 7px;
          border-radius: var(--r-full);
          background: rgba(0, 0, 0, 0.65);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          pointer-events: none;
        }
        .photo-del {
          position: absolute;
          top: 4px;
          right: 4px;
          display: grid;
          place-items: center;
          width: 22px;
          height: 22px;
          border: none;
          border-radius: var(--r-full);
          background: var(--heart);
          color: #fff;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
          transition: transform var(--dur-fast) var(--ease), opacity var(--dur-fast) var(--ease);
        }
        .photo-del:hover {
          transform: scale(1.08);
        }
        .photo-add {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 92px;
          height: 92px;
          padding: 0 6px;
          border-radius: var(--r-md);
          border: 1.5px dashed var(--border-strong);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 12px;
          font-weight: 600;
          line-height: 1.2;
          text-align: center;
          cursor: pointer;
          transition: border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
        }
        .photo-add:hover:not(:disabled) {
          border-color: var(--primary);
          color: var(--primary-strong);
        }
        .photo-add:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .preview-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 96px;
          width: 100%;
          padding: 16px;
          border-radius: var(--r-md);
          border: 1.5px dashed var(--border-strong);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 13.5px;
          font-weight: 600;
          text-align: center;
          cursor: pointer;
          transition: border-color var(--dur-fast) var(--ease),
            color var(--dur-fast) var(--ease),
            background var(--dur-fast) var(--ease);
        }
        .preview-empty:hover:not(:disabled) {
          border-color: var(--primary);
          color: var(--primary-strong);
          background: var(--surface-3);
        }
        .preview-empty:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .thumb-img {
          object-fit: cover;
        }
        .thumbs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .thumb {
          padding: 0;
          width: 52px;
          height: 52px;
          border-radius: var(--r-sm);
          overflow: hidden;
          border: 2px solid transparent;
          cursor: pointer;
          background: var(--surface-2);
        }
        .thumb.active {
          border-color: var(--primary);
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }
        .label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-soft);
        }
        .field input,
        .field textarea {
          width: 100%;
          padding: 0 14px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text);
          font-family: inherit;
          font-size: 14.5px;
          outline: none;
          transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
        }
        .field input {
          height: 44px;
        }
        .field textarea {
          padding: 10px 14px;
          min-height: 84px;
          resize: vertical;
        }
        .field input:focus,
        .field textarea:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--ring);
        }
        .field.resolving input {
          opacity: 0.5;
          pointer-events: none;
          cursor: progress;
        }
        .field-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.3;
        }
        .resolving-hint {
          color: var(--primary-strong);
        }
        .error-hint {
          color: var(--heart);
        }
        .chips {
          display: flex;
          gap: 8px;
        }
        .chip {
          flex: 1;
          padding: 9px 0;
          border-radius: var(--r-md);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--dur-fast) var(--ease);
        }
        .chip.active {
          background: var(--grad-primary);
          color: var(--primary-contrast);
          border-color: transparent;
        }
        .stars {
          display: flex;
          gap: 4px;
        }
        .star {
          background: none;
          border: none;
          padding: 2px;
          cursor: pointer;
          line-height: 0;
        }
        .hashtag-presets {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 3px;
        }
        .hashtag-presets-label {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-faint);
          letter-spacing: 0.01em;
        }
        .hashtag-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .hashtag-chip {
          height: 24px;
          padding: 3px 8px;
          display: inline-flex;
          align-items: center;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 12px;
          font-weight: 600;
          line-height: 1;
          white-space: nowrap;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease),
            color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease),
            transform var(--dur-fast) var(--ease);
        }
        .hashtag-chip:hover {
          transform: translateY(-1px);
          border-color: var(--primary);
          color: var(--primary-strong);
        }
        .hashtag-chip.active {
          background: var(--grad-primary);
          border-color: var(--primary);
          color: var(--primary-contrast);
          box-shadow: var(--shadow-primary);
        }
        .selected-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 8px;
        }
        .selected-tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: var(--r-full);
          background: var(--primary-soft-2);
          color: var(--primary-strong);
          border: 1px solid var(--primary-soft);
          font-size: 12px;
          font-weight: 600;
          line-height: 1.2;
        }
        .remove-tag-btn {
          border: none;
          background: transparent;
          color: var(--primary-strong);
          font-size: 14px;
          line-height: 1;
          padding: 0;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: color var(--dur-fast) var(--ease);
        }
        .remove-tag-btn:hover {
          color: var(--heart);
        }
        .tag-input-row {
          display: flex;
          gap: 6px;
        }
        .tag-input-row input {
          flex: 1;
          min-width: 0;
          width: auto;
        }
        .tag-add-btn {
          flex-shrink: 0;
          height: 44px;
          padding: 0 14px;
          border-radius: var(--r-md);
          border: 1px solid var(--primary-soft-2);
          background: var(--primary-soft);
          color: var(--primary-strong);
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease),
            border-color var(--dur-fast) var(--ease);
        }
        .tag-add-btn:hover {
          background: var(--primary-soft-2);
          border-color: var(--primary);
        }
        .error {
          padding: 10px 12px;
          border-radius: var(--r-md);
          background: rgba(255, 90, 126, 0.12);
          color: var(--heart);
          font-size: 13px;
          font-weight: 500;
        }
        .actions {
          display: flex;
          gap: 10px;
          margin-top: 4px;
        }
        .cancel {
          flex: 1;
          height: 46px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text-soft);
          font-weight: 700;
          cursor: pointer;
        }
        .submit {
          flex: 2;
          height: 46px;
          border-radius: var(--r-md);
          border: none;
          background: var(--grad-primary);
          color: var(--primary-contrast);
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: var(--shadow-primary);
          transition: opacity var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
        }
        .submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }
        .submit:not(:disabled):active {
          transform: scale(0.98);
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
