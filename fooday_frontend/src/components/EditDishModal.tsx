'use client';

import React, { useMemo, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { User } from '@supabase/supabase-js';
import { X, Upload, Loader2, Plus } from 'lucide-react';
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

interface EditDishModalProps {
  dish: Food;
  onClose: () => void;
  onUpdated?: (updated: Food) => void;
}

/**
 * GitHub-style contributor list of a dish: everybody who edited it besides
 * its creator. The creator keeps living in `created_by` and is stored as the
 * first entry of the list with the `creator` role.
 */
export function buildContributors(dish: Food, user: User | null): Contributor[] {
  const list = parseContributors(dish.contributors);
  if (!user) return list;

  const index = list.findIndex((contributor) => contributor.id === user.id);

  // The author of the dish never turns into a plain contributor of their own
  // dish — their entry keeps the `creator` role and their stored details.
  if (dish.created_by && dish.created_by === user.id) {
    if (index === -1) {
      return [
        ...list,
        {
          id: user.id,
          name: user.email?.split('@')[0] || 'User',
          avatar_url: (user.user_metadata?.avatar_url as string | undefined) || '',
          updated_at: new Date().toISOString(),
          role: 'creator' as const,
        },
      ];
    }
    const next = [...list];
    next[index] = { ...next[index], role: 'creator' };
    return next;
  }

  const entry: Contributor = {
    id: user.id,
    name: user.email?.split('@')[0] || 'User',
    avatar_url: (user.user_metadata?.avatar_url as string | undefined) || '',
    updated_at: new Date().toISOString(),
    role: 'contributor',
  };

  if (index === -1) return [...list, entry];
  const next = [...list];
  next[index] = { ...next[index], ...entry };
  return next;
}

export default function EditDishModal({ dish, onClose, onUpdated }: EditDishModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // The multi-dish menu: `dish.dishes` when present, otherwise the legacy
  // joined `name` ("Xiên nướng, Nước ép") is split back into chips.
  const [dishList, setDishList] = useState<string[]>(() => {
    const stored = Array.isArray(dish.dishes)
      ? dish.dishes.map((item) => item.trim()).filter(Boolean)
      : [];
    if (stored.length > 0) return stored;
    // Legacy row: the menu was joined into `name` ("A, B") — split it back.
    const joined = (dish.name ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return joined.length > 0 ? joined : [];
  });
  const [dishInput, setDishInput] = useState('');
  // The first dish stands in for the legacy single-name field — it feeds the
  // image suggestions and the current single-name views.
  const name = dishList[0] ?? '';
  const [restaurant, setRestaurant] = useState(dish.restaurant ?? '');
  const [googleMapUrl, setGoogleMapUrl] = useState(dish.google_map_url ?? '');
  // Multi-category state: the stored `category` (legacy single value) and the
  // `categories` jsonb array are merged; every dish keeps at least one pick.
  const [selectedCategories, setSelectedCategories] = useState<FoodCategory[]>(() => {
    const stored = Array.isArray(dish.categories)
      ? (dish.categories as string[]).filter((c): c is FoodCategory =>
          (FOOD_CATEGORIES as string[]).includes(c),
        )
      : [];
    const legacy =
      dish.category && (FOOD_CATEGORIES as string[]).includes(dish.category)
        ? [dish.category]
        : [];
    const merged = Array.from(new Set([...legacy, ...stored]));
    return merged.length > 0 ? merged : ['Foods'];
  });
  const [address, setAddress] = useState(dish.address ?? '');
  const [isResolvingMap, setIsResolvingMap] = useState(false);
  const [openingTime, setOpeningTime] = useState(dish.opening_time ?? '');
  // TikTok-style hashtags: the raw serialized string the user sees + the
  // token at the caret that drives the suggestion dropdown.
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [tagText, setTagText] = useState(() => parseHashtags(dish.tag).join(' '));
  const [tagWord, setTagWord] = useState('');
  const [tagSuggestOpen, setTagSuggestOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState(dish.review_note ?? '');
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

  // Enter, a comma or the "+" button turns the typed text into dish chips.
  const handleAddDish = (raw: string) => {
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    setDishInput('');
    if (parts.length === 0) return;
    setDishList((prev) => {
      const next = [...prev];
      for (const part of parts) if (!next.includes(part)) next.push(part);
      return next;
    });
  };

  const handleRemoveDish = (item: string) =>
    setDishList((prev) => prev.filter((existing) => existing !== item));

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

  const canSubmit = Boolean(dishList.length > 0 && restaurant.trim() && imageList.length > 0) && !busy;

  const toggleCategory = (c: FoodCategory) => {
    // Multi-select: tap to add, tap again to remove — but never empty the list.
    setSelectedCategories((prev) => {
      if (prev.includes(c)) {
        return prev.length > 1 ? prev.filter((item) => item !== c) : prev;
      }
      return [...prev, c];
    });
  };

  /* ===== TikTok-style hashtag input ===== */

  const tagQuery = normalizeSingleHashtag(tagWord).replace(/^#/, '');
  const tagSuggestions = useMemo(
    () =>
      TRENDING_HASHTAGS.filter(
        (preset) =>
          !parseHashtags(tagText).includes(preset) && (!tagQuery || preset.slice(1).includes(tagQuery)),
      ).slice(0, 6),
    [tagText, tagQuery],
  );

  /** Extracts the token at the caret and keeps the dropdown in sync. */
  const refreshTagWord = (el: HTMLInputElement) => {
    const caret = el.selectionStart ?? el.value.length;
    const word = el.value.slice(0, caret).match(/[^\s,]*$/)?.[0] ?? '';
    setTagWord(word);
    setTagSuggestOpen(word.trim().length > 0);
  };

  const handleTagChange = (next: string) => {
    if (/[\s,]$/.test(next)) {
      // A token was completed (space or comma): normalize it and auto-# it.
      const tokens = parseHashtags(next);
      setTagText(tokens.length > 0 ? `${tokens.join(' ')} ` : '');
      setTagWord('');
      setTagSuggestOpen(false);
    } else {
      setTagText(next);
      if (tagInputRef.current) refreshTagWord(tagInputRef.current);
    }
  };

  const handleTagSuggestClosed = () => {
    setTagSuggestOpen(false);
    setTagWord('');
  };

  const handleTagBlur = () => {
    handleTagSuggestClosed();
    setTagText((prev) => parseHashtags(prev).join(' '));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Never let Enter submit the form while typing hashtags.
      e.preventDefault();
      setTagText((prev) => parseHashtags(prev).join(' '));
      handleTagSuggestClosed();
    } else if (e.key === 'Escape') {
      handleTagSuggestClosed();
    }
  };

  /** Clicking a suggestion fills it in and appends a space to keep typing. */
  const pickTagSuggestion = (preset: string) => {
    const el = tagInputRef.current;
    const caret = el?.selectionStart ?? tagText.length;
    const before = tagText.slice(0, caret).replace(/[^\s,]*$/, '');
    const after = tagText.slice(caret).replace(/^[^\s,]*/, '');
    const inserted = `${before}${preset} `;
    setTagText(`${inserted}${after}`);
    handleTagSuggestClosed();
    window.requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(inserted.length, inserted.length);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const finalTag = serializeHashtags(parseHashtags(tagText));

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

    // `name` keeps the first dish so every legacy view stays alive; the full
    // menu goes to `dishes` (with a joined-string fallback when the column is
    // not migrated yet). The `categories` array keeps every selected category;
    // the legacy `category` column keeps the first pick for older views.
    const basePayload = {
      name: dishList[0] ?? '',
      restaurant: restaurant.trim(),
      category: selectedCategories[0],
      rating: Number(dish.rating ?? 5),
      address: address.trim() || null,
      google_map_url: googleMapUrl.trim() || null,
      opening_time: openingTime.trim() || null,
      tag: finalTag || null,
      review_note: reviewNote.trim() || null,
      image_url: imageList[0] || dish.image_url || '',
      images: imageList,
      branches: cleanBranches.length > 0 ? cleanBranches : null,
    };
    // The `categories` column is newer than `category`; likewise `dishes` and
    // `contributors` may be unmigrated. The row starts complete and each
    // failing column is simply stripped before retrying.
    let row: Record<string, unknown> = {
      ...basePayload,
      categories: selectedCategories,
      dishes: dishList,
      contributors: buildContributors(dish, user),
    };
    /** The row minus one column (for databases without that migration). */
    const stripRowField = (field: string): Record<string, unknown> => {
      const rest: Record<string, unknown> = { ...row };
      delete rest[field];
      return rest;
    };

    const updateAttempt = (payload: Record<string, unknown>) =>
      supabase.from('foods').update(payload).eq('id', dish.id).select().single();

    let { data, error: updErr } = await updateAttempt(row);

    if (updErr && /categories/i.test(updErr.message)) {
      row = stripRowField('categories');
      ({ data, error: updErr } = await updateAttempt(row));
    }

    if (updErr && /dishes/i.test(updErr.message)) {
      // The `dishes` column is not migrated yet — the joined string in `name`
      // keeps the whole menu readable.
      row = { ...stripRowField('dishes'), name: dishList.join(', ') };
      ({ data, error: updErr } = await updateAttempt(row));
    }

    if (updErr && /contributors/i.test(updErr.message)) {
      // The `contributors` column is not migrated yet — save without it.
      row = stripRowField('contributors');
      ({ data, error: updErr } = await updateAttempt(row));
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

          {/* Dishes — tag-list input: Enter / comma / "+" adds a chip */}
          <div className="field">
            <span className="label">
              {t.addDish.dishesLabel} <span className="required-mark">*</span>
            </span>

            {dishList.length > 0 && (
              <div className="selected-tags">
                {dishList.map((item) => (
                  <span key={item} className="selected-tag-chip">
                    {item}
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() => handleRemoveDish(item)}
                      aria-label={`Remove ${item}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="tag-input-row">
              <DishNameAutocomplete
                value={dishInput}
                onChange={setDishInput}
                onCommit={handleAddDish}
                placeholder={t.addDish.dishInputPlaceholder}
                aria-label={t.addDish.dishesLabel}
              />
              <button
                type="button"
                className="tag-add-btn"
                onClick={() => handleAddDish(dishInput)}
                aria-label={t.addDish.addDishBtn}
                title={t.addDish.addDishBtn}
              >
                <Plus size={19} strokeWidth={2.4} />
              </button>
            </div>

            {dishList.length === 0 && (
              <span className="field-hint">{t.addDish.minOneDishRequired}</span>
            )}
          </div>

          {/* Category — multi-select: a place can sell mains, drinks AND snacks */}
          <div className="field">
            <span className="label">{t.editDish.category}</span>
            <div className="chips">
              {FOOD_CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`chip ${selectedCategories.includes(c) ? 'active' : ''}`}
                  onClick={() => toggleCategory(c)}
                  aria-pressed={selectedCategories.includes(c)}
                >
                  {t.home.categories[c]}
                </button>
              ))}
            </div>
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

          {/* Google Maps link + address — one grouped field; the maps link auto-
              fills the address. The compact branch button lives right under the
              address. */}
          <div className="field maps-address-group">
            <span className="label">
              {t.map.googleMapLabel} <span className="required-mark">*</span>
              <span className="label-divider" aria-hidden="true">|</span>
              {t.map.addressLabel}
            </span>

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

            <span className="field-divider" aria-hidden="true">|</span>

            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={
                isResolvingMap ? t.map.resolvingAddress : t.map.addressPlaceholder
              }
              disabled={isResolvingMap}
              aria-busy={isResolvingMap}
              className={isResolvingMap ? 'is-resolving' : ''}
              aria-label={t.map.addressLabel}
            />
            {isResolvingMap && (
              <span className="field-hint resolving-hint">
                <Loader2 size={13} className="spin" />
                {t.map.resolvingAddress}
              </span>
            )}

            <BranchEditor branches={branches} onChange={setBranches} />
          </div>

          {/* Opening hours & note — one two-column row */}
          <div className="two-cols-row">
            <label className="field">
              <span className="label">{t.editDish.openingTime}</span>
              <input
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                placeholder={t.detail.noHours}
                aria-label={t.editDish.openingTime}
              />
            </label>
            <label className="field">
              <span className="label">{t.editDish.reviewNote}</span>
              <textarea
                className="note-textarea"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={1}
                placeholder={t.addDish.reviewNotePlaceholder}
                aria-label={t.editDish.reviewNote}
              />
            </label>
          </div>

          {error && <div className="error">{error}</div>}

          {/* Tags — TikTok-style hashtags: type separated by spaces with a
              vertical suggestion dropdown under the input. Always the last
              field of the form, right above the action buttons. */}
          <div className="field">
            <span className="label">{t.editDish.tag}</span>

            <div className="tag-input-row hashtag-wrap">
              <input
                ref={tagInputRef}
                value={tagText}
                onChange={(e) => handleTagChange(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onKeyUp={(e) => refreshTagWord(e.currentTarget)}
                onClick={(e) => refreshTagWord(e.currentTarget)}
                onFocus={(e) => refreshTagWord(e.currentTarget)}
                onBlur={handleTagBlur}
                placeholder={t.editDish.tagPlaceholder}
                aria-label={t.editDish.tag}
                autoComplete="off"
                spellCheck={false}
              />

              {tagSuggestOpen && tagSuggestions.length > 0 && (
                <div className="tag-suggest-list" role="listbox" aria-label={t.editDish.tag}>
                  <span className="tag-suggest-head">{t.editDish.trendingHashtagsLabel}</span>
                  {tagSuggestions.map((preset) => {
                    const tag = preset.slice(1);
                    const start = tag.indexOf(tagQuery);
                    return (
                      <button
                        type="button"
                        key={preset}
                        role="option"
                        aria-selected={false}
                        className="tag-suggest-item"
                        // Keep the input focused — a blur would close the dropdown.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickTagSuggestion(preset)}
                      >
                        <span className="tag-suggest-hash" aria-hidden="true">
                          #
                        </span>
                        <span className="tag-suggest-name">
                          {start === -1 ? (
                            tag
                          ) : (
                            <>
                              <strong>{tag.slice(start, start + tagQuery.length)}</strong>
                              {tag.slice(start + tagQuery.length)}
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

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
        .required-mark {
          color: var(--heart);
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
        /* Google Maps link + address — one grouped field with a thin divider */
        .label-divider {
          margin: 0 5px;
          color: var(--text-faint);
          font-weight: 700;
        }
        .maps-address-group input.is-resolving {
          opacity: 0.5;
          cursor: progress;
        }
        .field-divider {
          text-align: center;
          color: var(--text-faint);
          font-weight: 700;
          font-size: 14px;
          line-height: 1;
          margin: 2px 0;
        }
        /* Opening hours & note — one two-column row */
        .two-cols-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 480px) {
          .two-cols-row {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
        }
        /* TikTok-style hashtag suggestion dropdown */
        .hashtag-wrap {
          position: relative;
          align-items: stretch;
        }
        .tag-suggest-list {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 30;
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-height: 216px;
          overflow-y: auto;
          padding: 6px;
          border-radius: var(--r-md);
          border: 1px solid var(--border);
          background: var(--surface);
          box-shadow: var(--shadow-lg);
        }
        .tag-suggest-head {
          padding: 2px 10px 4px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.01em;
          color: var(--text-faint);
        }
        .tag-suggest-item {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 10px;
          border: none;
          border-radius: var(--r-sm);
          background: transparent;
          color: var(--text);
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 600;
          line-height: 1.2;
          text-align: left;
          white-space: nowrap;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease);
        }
        .tag-suggest-item:hover {
          background: var(--primary-soft);
        }
        .tag-suggest-name {
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tag-suggest-item strong {
          color: var(--primary-strong);
          font-weight: 800;
        }
        .tag-suggest-hash {
          color: var(--primary-strong);
          font-weight: 800;
        }
        /* Compact one-line note field, last field of the form */
        .field textarea.note-textarea {
          width: 100%;
          height: 44px;
          min-height: 44px;
          padding: 10px 14px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text);
          font-family: inherit;
          font-size: 14.5px;
          line-height: 1.3;
          outline: none;
          resize: none;
          overflow-y: auto;
          transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
        }
        .field textarea.note-textarea:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--ring);
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
        .tag-input-row :global(.root) {
          flex: 1;
          min-width: 0;
        }
        .tag-add-btn {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          padding: 0;
          display: grid;
          place-items: center;
          border-radius: var(--r-md);
          border: 1px solid var(--primary-soft-2);
          background: var(--primary-soft);
          color: var(--primary-strong);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease),
            border-color var(--dur-fast) var(--ease),
            transform var(--dur-fast) var(--ease);
        }
        .tag-add-btn:active {
          transform: scale(0.96);
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
