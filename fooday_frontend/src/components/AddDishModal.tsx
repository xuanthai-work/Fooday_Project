'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, Upload, Loader2, Plus, Clock, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import {
  useFoods,
  refreshFoods,
  FoodCategory,
  FOOD_CATEGORIES,
  Contributor,
  type Branch,
  type Food,
} from '@/hooks/useFoods';
import { dishImageService, mapService, DishImage, ParsedMapInfo } from '@/services/api';
import { useTranslation } from '@/i18n/LanguageContext';
import { TRENDING_HASHTAGS, normalizeSingleHashtag, parseHashtags, serializeHashtags } from '@/lib/hashtags';
import { isGoogleMapsUrl, extractPlaceId, mapsLinksMatch } from '@/lib/maps';
import { extractCoordsFromUrl, parseBranches } from '@/lib/geo';
import {
  PRICE_SLIDER_MAX,
  PRICE_SLIDER_MIN,
  PRICE_SLIDER_STEP,
  formatSliderPrice,
} from '@/lib/price';
import { formatOpeningHours, formatTimeVietnamese } from '@/lib/openingHours';
import ClockTimePicker from './ClockTimePicker';
import PriceSlider from './PriceSlider';
import {
  findBrandMatch,
  isBranchAlreadyExists,
  suggestBranchName,
  type BrandMatch,
  type BranchDraftInfo,
} from '@/lib/brandMatch';
import DishNameAutocomplete from './DishNameAutocomplete';
import BranchEditor, { type BranchDraft } from './BranchEditor';
import { buildContributors } from './EditDishModal';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Find an existing dish whose Google Maps place matches the parsed link. */
function findDuplicateFood(
  foods: Food[],
  info: ParsedMapInfo,
  rawUrl: string,
): Food | null {
  const placeId =
    info.place_id?.toLowerCase() || extractPlaceId(info.resolved_url) || extractPlaceId(rawUrl);
  const candidates = [info.resolved_url, rawUrl].filter(Boolean) as string[];

  for (const food of foods) {
    const links = [
      food.google_map_url,
      ...(food.branches ?? []).map((branch) => branch.google_map_url),
    ];
    for (const link of links) {
      if (!link) continue;
      if (placeId && extractPlaceId(link) === placeId) return food;
      if (placeId && link.toLowerCase().includes(placeId)) return food;
      if (candidates.some((candidate) => mapsLinksMatch(link, candidate))) return food;
    }
  }
  return null;
}

interface AddDishModalProps {
  onClose: () => void;
}

/** A chain/brand found in the catalog with the draft of the new outlet. */
interface DetectedChain {
  match: BrandMatch;
  branchName: string;
  draft: BranchDraftInfo;
}

export default function AddDishModal({ onClose }: AddDishModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { foods } = useFoods();
  const router = useRouter();
  const [dishList, setDishList] = useState<string[]>([]);
  const [dishInput, setDishInput] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<FoodCategory[]>(['Foods']);
  const [priceValue, setPriceValue] = useState<number | null>(null);
  const [restaurant, setRestaurant] = useState('');
  const [googleMapUrl, setGoogleMapUrl] = useState('');
  const [address, setAddress] = useState('');
  const [isResolvingMap, setIsResolvingMap] = useState(false);
  const [duplicateDish, setDuplicateDish] = useState<Food | null>(null);
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [detectedChain, setDetectedChain] = useState<DetectedChain | null>(null);
  const [showChainModal, setShowChainModal] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [hoursOpen, setHoursOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [imageList, setImageList] = useState<string[]>([]);
  const [branches, setBranches] = useState<BranchDraft[]>([]);
  const [candidates, setCandidates] = useState<DishImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // The first dish stands in for the legacy single-name field — it feeds the
  // image suggestions, the slug and every current view.
  const name = dishList[0] ?? '';

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

  const handleRemoveDish = (dish: string) =>
    setDishList((prev) => prev.filter((item) => item !== dish));

  // Esc to close (closes the duplicate warning first when it is open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showChainModal) {
        setShowChainModal(false);
        return;
      }
      if (showDuplicatePopup) {
        setShowDuplicatePopup(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, showDuplicatePopup, showChainModal]);

  // Unsplash suggestions by dish name (debounced). Auto-seed the gallery with the
  // first result until the user adds photos of their own.
  useEffect(() => {
    const q = name.trim();
    if (!q) return;
    let active = true;
    const timer = setTimeout(async () => {
      const imgs = await dishImageService.search(q);
      if (!active) return;
      setCandidates(imgs);
      setImageList((prev) =>
        prev.length === 0 && imgs[0]?.url ? [imgs[0].url] : prev,
      );
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [name]);

  // Auto-resolve the pasted Google Maps link: the backend extracts the place
  // name and the postal address, then we fill the address (and the restaurant
  // name when it is still empty) automatically.
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveSeqRef = useRef(0);
  // Keep the latest catalog visible to the debounced resolver callback.
  const foodsRef = useRef(foods);
  useEffect(() => {
    foodsRef.current = foods;
  }, [foods]);

  const handleGoogleMapUrlChange = (value: string) => {
    setGoogleMapUrl(value);
    setDuplicateDish(null);
    setShowDuplicatePopup(false);
    setDetectedChain(null);
    setShowChainModal(false);
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

      // The place already exists in the catalog: warn and stop the submission.
      const existing = findDuplicateFood(foodsRef.current, info, url);
      if (existing) {
        setDuplicateDish(existing);
        setShowDuplicatePopup(true);
        return;
      }

      if (info.address) setAddress(info.address);

      // B2: the place is new, but its name may belong to a restaurant that is
      // already on Fooday — offer merging it as a new branch of that chain.
      const rawName = info.restaurant_name || '';
      if (rawName.trim()) {
        const placeId =
          info.place_id?.toLowerCase() ||
          extractPlaceId(info.resolved_url) ||
          extractPlaceId(url);
        const link = info.resolved_url || url;
        const match = findBrandMatch(rawName, foodsRef.current);
        if (
          match &&
          !isBranchAlreadyExists(placeId, link, info.address, match.representativeFood)
        ) {
          const coords = extractCoordsFromUrl(link);
          setDetectedChain({
            match,
            branchName: suggestBranchName(rawName, match.representativeFood),
            draft: {
              name: rawName,
              address: info.address ?? '',
              google_map_url: link,
              lat: coords?.lat ?? null,
              lng: coords?.lng ?? null,
            },
          });
          setShowChainModal(true);
          return;
        }
      }

      if (info.restaurant_name) {
        setRestaurant((prev) => (prev.trim() ? prev : (info.restaurant_name as string)));
      }
    }, 500);
  };

  // Close this form and jump straight to the dish that already exists.
  const handleViewExisting = () => {
    const target = duplicateDish;
    if (!target) return;
    setShowDuplicatePopup(false);
    setDuplicateDish(null);
    onClose();
    window.dispatchEvent(new CustomEvent<Food>('fooday:open-dish', { detail: target }));
    if (window.location.pathname !== '/') {
      router.push(`/?dish=${target.id}`);
    }
  };

  // Chain dialog, action 1 (recommended): save the new outlet on the matched
  // restaurant, then jump straight to it so the user sees the added branch.
  const handleMergeBranch = async () => {
    const chain = detectedChain;
    if (!chain || savingBranch) return;
    setSavingBranch(true);
    setError(null);
    try {
      const { match, draft, branchName } = chain;
      const target = match.representativeFood;
      const newBranch: Branch = {
        name: branchName,
        address: draft.address,
        google_map_url: draft.google_map_url,
        lat: draft.lat,
        lng: draft.lng,
      };
      // Each dish of the brand keeps its own branch list — only append the
      // new outlet so no local data is lost.
      for (const dish of match.dishes) {
        const nextBranches = [...parseBranches(dish.branches), newBranch];
        const contributorList = buildContributors(dish, user);
        let { error: updErr } = await supabase
          .from('foods')
          .update({ branches: nextBranches, contributors: contributorList })
          .eq('id', dish.id);
        if (updErr && /contributors/i.test(updErr.message)) {
          // The `contributors` column is not migrated yet — save without it.
          ({ error: updErr } = await supabase
            .from('foods')
            .update({ branches: nextBranches })
            .eq('id', dish.id));
        }
        if (updErr) throw updErr;
      }
      await refreshFoods();
      setShowChainModal(false);
      setDetectedChain(null);
      onClose();
      window.dispatchEvent(
        new CustomEvent<Food>('fooday:open-dish', {
          detail: {
            ...target,
            branches: [...parseBranches(target.branches), newBranch],
            contributors: buildContributors(target, user),
          },
        }),
      );
      if (window.location.pathname !== '/') {
        router.push(`/?dish=${target.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.addDish.branchSaveFailed);
    } finally {
      setSavingBranch(false);
    }
  };

  // Chain dialog, action 2: keep adding a dish, standardised on the matched
  // brand. The pasted place becomes the main location of the dish being
  // added, i.e. it joins the branch list of this very dish.
  const handleContinueForBranch = () => {
    const chain = detectedChain;
    if (!chain) return;
    setRestaurant(chain.match.targetRestaurant);
    setGoogleMapUrl(chain.draft.google_map_url.trim());
    if (!address.trim() && chain.draft.address) setAddress(chain.draft.address);
    setShowChainModal(false);
    setDetectedChain(null);
  };

  // Chain dialog, action 3: treat the pasted place as a brand-new restaurant.
  const handleSeparateRestaurant = () => {
    setShowChainModal(false);
    setDetectedChain(null);
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

  const canSubmit =
    Boolean(
      dishList.length > 0 &&
        restaurant.trim() &&
        imageList.length > 0 &&
        isGoogleMapsUrl(googleMapUrl),
    ) &&
    !busy &&
    !duplicateDish;

  const priceLabel = priceValue
    ? formatSliderPrice(priceValue)
    : t.addDish.priceUnset;

  const hoursLabel =
    openTime || closeTime
      ? [openTime && formatTimeVietnamese(openTime), closeTime && formatTimeVietnamese(closeTime)]
          .filter(Boolean)
          .join(' – ')
      : t.addDish.hoursUnset;

  /** Human labels for the requirements that are still missing. */
  const missingFields = [
    dishList.length === 0 && !dishInput.trim() ? t.addDish.missingDish : null,
    imageList.length === 0 ? t.addDish.missingPhoto : null,
    !restaurant.trim() ? t.addDish.missingRestaurant : null,
    !isGoogleMapsUrl(googleMapUrl) ? t.addDish.missingMaps : null,
  ].filter((label): label is string => Boolean(label));

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

  const tagInputRef = useRef<HTMLInputElement>(null);
  // The whole hashtag string as the user sees it, e.g. `#viahe #giahocsinh`.
  const [tagText, setTagText] = useState('');
  // The token the caret currently sits in (drives the suggestion dropdown).
  const [tagWord, setTagWord] = useState('');
  const [tagSuggestOpen, setTagSuggestOpen] = useState(false);

  const tagQuery = normalizeSingleHashtag(tagWord).replace(/^#/, '');
  const tagSuggestions = useMemo(
    () =>
      TRENDING_HASHTAGS.filter(
        (preset) => !parseHashtags(tagText).includes(preset) && (!tagQuery || preset.slice(1).includes(tagQuery)),
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
    // A name typed but not committed with Enter / "+" still counts.
    const pendingDish = dishInput.trim();
    const finalDishes =
      pendingDish && !dishList.includes(pendingDish) ? [...dishList, pendingDish] : dishList;

    if (
      finalDishes.length === 0 ||
      !restaurant.trim() ||
      imageList.length === 0 ||
      !isGoogleMapsUrl(googleMapUrl) ||
      duplicateDish
    ) {
      // Promote the typed dish to a chip so the next tap only fills what's left.
      if (pendingDish) handleAddDish(pendingDish);
      return;
    }
    setBusy(true);
    setError(null);
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 8)}`;
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
    // The author of the dish is stored as the first entry of the contributor
    // list, so the detail modal can always show a real name and avatar.
    const initialContributors: Contributor[] = user
      ? [
          {
            id: user.id,
            name: user.email?.split('@')[0] || 'User',
            avatar_url: (user.user_metadata?.avatar_url as string | undefined) || '',
            updated_at: new Date().toISOString(),
            role: 'creator',
          },
        ]
      : [];
    // `name` keeps the first dish so every legacy view stays alive; the full
    // menu goes to `dishes` (with a joined-string fallback when the column is
    // not migrated yet). The `categories` array is the multi-category update
    // of `category`, which keeps carrying the first selection for compat.
    const basePayload = {
      slug,
      name: finalDishes[0] ?? '',
      category: selectedCategories[0],
      restaurant: restaurant.trim(),
      rating: 5,
      // Optional price picked on the slider.
      price: priceValue,
      image_url: imageList[0] || '',
      images: imageList,
      tag: finalTag || null,
      address: address.trim() || null,
      google_map_url: googleMapUrl.trim(),
      opening_time: formatOpeningHours({ open: openTime, close: closeTime }),
      review_note: reviewNote.trim() || null,
      // Only sent when there is something to store.
      ...(cleanBranches.length > 0 ? { branches: cleanBranches } : {}),
    };
    // The `categories` column is newer than `category`; likewise `dishes` and
    // `contributors` may be unmigrated. The row starts complete and each
    // failing column is simply stripped before retrying.
    let row: Record<string, unknown> = {
      ...basePayload,
      categories: selectedCategories,
      dishes: finalDishes,
      contributors: initialContributors,
    };
    /** The row minus one column (for databases without that migration). */
    const stripRowField = (field: string): Record<string, unknown> => {
      const rest: Record<string, unknown> = { ...row };
      delete rest[field];
      return rest;
    };

    let { error: insErr } = await supabase.from('foods').insert(row);
    if (insErr && /categories/i.test(insErr.message)) {
      row = stripRowField('categories');
      ({ error: insErr } = await supabase.from('foods').insert(row));
    }
    if (insErr && /dishes/i.test(insErr.message)) {
      // The `dishes` column is not migrated yet — the joined string in `name`
      // keeps the whole menu readable.
      row = { ...stripRowField('dishes'), name: finalDishes.join(', ') };
      ({ error: insErr } = await supabase.from('foods').insert(row));
    }
    if (insErr && /contributors/i.test(insErr.message)) {
      // The `contributors` column is not migrated yet — save without it.
      row = stripRowField('contributors');
      const retry = await supabase.from('foods').insert(row);
      insErr = retry.error;
    }
    if (insErr && /price/i.test(insErr.message)) {
      // The `price` column is not migrated yet — the app falls back to estimates.
      row = stripRowField('price');
      const retry = await supabase.from('foods').insert(row);
      insErr = retry.error;
    }
    if (insErr) {
      setError(insErr.message);
      setBusy(false);
      return;
    }
    await refreshFoods();
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal-head">
          <h2 className="modal-title">{t.addDish.title}</h2>
          <button className="close" onClick={onClose} aria-label={t.addDish.close}>
            <X size={20} />
          </button>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          {/* Photos — gallery + multi upload + Unsplash suggestions */}
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
                    <Image src={c.url} alt={c.alt} width={52} height={52} className="thumb-img" style={{ objectFit: 'cover' }} />
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
                {dishList.map((dish) => (
                  <span key={dish} className="selected-tag-chip">
                    {dish}
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() => handleRemoveDish(dish)}
                      aria-label={`Remove ${dish}`}
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
            <span className="label">{t.addDish.categoryLabel}</span>
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

          {/* Price — volume-style slider, every notch is 10k (10k → 1m+) */}
          <div className="field">
            <span className="label">{t.addDish.priceLabel}</span>
            <div className="price-slider-head">
              <span className="price-slider-value">{priceLabel}</span>
              {priceValue !== null && (
                <button
                  type="button"
                  className="price-clear"
                  onClick={() => setPriceValue(null)}
                >
                  {t.addDish.priceClear}
                </button>
              )}
            </div>
            <PriceSlider
              value={priceValue ?? PRICE_SLIDER_MIN * 1000}
              min={PRICE_SLIDER_MIN * 1000}
              max={PRICE_SLIDER_MAX * 1000}
              step={PRICE_SLIDER_STEP * 1000}
              onChange={setPriceValue}
              ariaLabel={t.addDish.priceLabel}
              ariaValueText={priceLabel}
            />
            <div className="price-slider-scale" aria-hidden="true">
              <span>10k</span>
              <span>50k</span>
              <span>100k</span>
              <span>200k</span>
              <span>1m+</span>
            </div>
          </div>

          {/* Restaurant */}
          <label className={`field ${isResolvingMap ? 'resolving' : ''}`}>
            <span className="label">{t.addDish.restaurantLabel}</span>
            <input
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
              placeholder={t.addDish.restaurantPlaceholder}
              required
            />
          </label>

          {/* Google Maps link + address — one grouped field; the maps link is
              required and auto-fills the address. The compact branch button
              lives right under the address. */}
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
              required
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

          {/* Opening hours — one clock icon opens a single-hand clock */}
          <div className="field">
            <span className="label">{t.addDish.openingTime}</span>
            <button
              type="button"
              className="hours-trigger"
              onClick={() => setHoursOpen(true)}
              aria-haspopup="dialog"
              aria-label={t.addDish.hoursTitle}
            >
              <Clock size={18} className="hours-trigger-icon" />
              <span className={`hours-trigger-text ${openTime || closeTime ? '' : 'is-empty'}`}>
                {hoursLabel}
              </span>
              <ChevronRight size={16} className="hours-trigger-chev" />
            </button>
          </div>

          <label className="field">
            <span className="label">{t.addDish.reviewNote}</span>
            <textarea
              className="note-textarea"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={1}
              placeholder={t.addDish.reviewNotePlaceholder}
              aria-label={t.addDish.reviewNote}
            />
          </label>

          {duplicateDish && !showDuplicatePopup && (
            <div className="duplicate-inline" role="alert">
              <span className="duplicate-inline-icon" aria-hidden="true">
                📍
              </span>
              <span className="duplicate-inline-text">
                {t.addDish.duplicateRestaurantDesc(duplicateDish.name, duplicateDish.restaurant)}
              </span>
              <button
                type="button"
                className="duplicate-inline-btn"
                onClick={() => setShowDuplicatePopup(true)}
              >
                {t.addDish.viewExistingDishBtn}
              </button>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          {/* Tags — TikTok-style hashtags: type separated by spaces with a
              vertical suggestion dropdown under the input. Always the last
              field of the form, right above the action buttons. */}
          <div className="field">
            <span className="label">{t.addDish.tagLabel}</span>

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
                placeholder={t.addDish.tagPlaceholder}
                aria-label={t.addDish.tagLabel}
                autoComplete="off"
                spellCheck={false}
              />

              {tagSuggestOpen && tagSuggestions.length > 0 && (
                <div className="tag-suggest-list" role="listbox" aria-label={t.addDish.tagLabel}>
                  <span className="tag-suggest-head">{t.addDish.trendingHashtagsLabel}</span>
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

          {!canSubmit && !busy && missingFields.length > 0 && (
            <p className="missing-fields" role="status">
              {t.addDish.missingPrefix} {missingFields.join(' · ')}
            </p>
          )}

          <div className="actions">
            <button type="button" className="cancel" onClick={onClose}>
              {t.addDish.cancel}
            </button>
            <button
              type="submit"
              className={`submit ${canSubmit ? '' : 'is-blocked'}`}
              disabled={busy}
              aria-disabled={!canSubmit}
            >
              {busy ? <Loader2 size={18} className="spin" /> : t.addDish.submit}
            </button>
          </div>
        </form>
      </div>

      {duplicateDish && showDuplicatePopup && (
        <div
          className="duplicate-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setShowDuplicatePopup(false);
          }}
        >
          <div
            className="duplicate-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="duplicate-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="duplicate-icon" aria-hidden="true">
              📍
            </div>
            <h3 id="duplicate-title" className="duplicate-title">
              {t.addDish.duplicateRestaurantTitle}
            </h3>
            <p className="duplicate-desc">
              {t.addDish.duplicateRestaurantDesc(duplicateDish.name, duplicateDish.restaurant)}
            </p>
            <div className="duplicate-actions">
              <button
                type="button"
                className="duplicate-secondary"
                onClick={() => setShowDuplicatePopup(false)}
              >
                {t.addDish.duplicateCloseBtn}
              </button>
              <button type="button" className="duplicate-primary" onClick={handleViewExisting}>
                {t.addDish.viewExistingDishBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {detectedChain && showChainModal && (
        <div
          className="duplicate-overlay"
          onClick={(e) => {
            e.stopPropagation();
            handleSeparateRestaurant();
          }}
        >
          <div
            className="duplicate-modal chain-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="chain-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="duplicate-icon" aria-hidden="true">
              🏢
            </div>
            <span className="chain-badge">{t.addDish.chainSuggestBadge}</span>
            <h3 id="chain-title" className="duplicate-title">
              {t.addDish.chainDetectedTitle(detectedChain.match.targetRestaurant)}
            </h3>
            <p className="duplicate-desc">{t.addDish.chainDetectedDesc}</p>
            <div
              className="chain-branch-card"
              role="group"
              aria-label={t.addDish.branchNamePlaceholder}
            >
              <span className="chain-branch-name">
                <span aria-hidden="true">📍</span>
                {detectedChain.branchName}
              </span>
              {detectedChain.draft.address ? (
                <span className="chain-branch-address">{detectedChain.draft.address}</span>
              ) : null}
            </div>
            <div className="chain-actions">
              <button
                type="button"
                className="chain-primary"
                onClick={handleMergeBranch}
                disabled={savingBranch}
              >
                {savingBranch ? <Loader2 size={18} className="spin" /> : t.addDish.mergeBranchBtn}
              </button>
              <button
                type="button"
                className="chain-secondary"
                onClick={handleContinueForBranch}
                disabled={savingBranch}
              >
                {t.addDish.addDishForBranchBtn}
              </button>
              <button
                type="button"
                className="chain-ghost"
                onClick={handleSeparateRestaurant}
                disabled={savingBranch}
              >
                {t.addDish.separateRestaurantBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {hoursOpen && (
        <ClockTimePicker
          hours={{ open: openTime, close: closeTime }}
          onSave={(next) => {
            setOpenTime(next.open);
            setCloseTime(next.close);
            setHoursOpen(false);
          }}
          onClose={() => setHoursOpen(false)}
        />
      )}

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(20, 14, 10, 0.58);
          backdrop-filter: blur(4px);
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
          .overlay { padding: 0; align-items: stretch; }
          .modal { max-width: none; max-height: 100dvh; border-radius: 0; }
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
        .close:hover { background: var(--surface-3); color: var(--text); }
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
        .photo-img { object-fit: cover; }
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
        .photo-del:hover { transform: scale(1.08); }
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
        .photo-add:hover:not(:disabled) { border-color: var(--primary); color: var(--primary-strong); }
        .photo-add:disabled { opacity: 0.6; cursor: not-allowed; }
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
        .thumb-img { object-fit: cover; }
        .thumbs { display: flex; gap: 8px; flex-wrap: wrap; }
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
        .thumb.active { border-color: var(--primary); }
        .field { display: flex; flex-direction: column; gap: 7px; }
        .label { font-size: 13px; font-weight: 600; color: var(--text-soft); }
        .field input {
          height: 44px;
          padding: 0 14px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text);
          font-size: 14.5px;
          outline: none;
          transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
        }
        .field textarea {
          width: 100%;
          padding: 10px 14px;
          min-height: 84px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text);
          font-family: inherit;
          font-size: 14.5px;
          outline: none;
          resize: vertical;
          transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
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
        .required-mark { color: var(--heart); }
        .field-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.3;
        }
        .resolving-hint { color: var(--primary-strong); }
        .error-hint { color: var(--heart); }
        .chips { display: flex; gap: 8px; }
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
        /* Volume-style price slider: brighter on the left, deeper orange right. */
        .price-slider-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }
        .price-slider-value {
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--primary-strong);
          font-variant-numeric: tabular-nums;
        }
        .price-clear {
          border: 0;
          background: none;
          padding: 0;
          color: var(--text-faint);
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
        }
        .price-clear:hover {
          color: var(--heart);
        }
        .price-slider-scale {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-faint);
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
        /* Opening hours — one clock icon opens the picker */
        .hours-trigger {
          width: 100%;
          height: 44px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text);
          font-family: inherit;
          font-size: 14px;
          text-align: left;
          cursor: pointer;
          transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
        }
        .hours-trigger:hover {
          border-color: var(--primary);
        }
        .hours-trigger:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        .hours-trigger-icon {
          flex: 0 0 auto;
          color: var(--primary-strong);
        }
        .hours-trigger-text {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-weight: 600;
        }
        .hours-trigger-text.is-empty {
          color: var(--text-faint);
          font-weight: 500;
        }
        .hours-trigger-chev {
          flex: 0 0 auto;
          color: var(--text-faint);
        }
        .missing-fields {
          margin: 2px 0 0;
          font-size: 12px;
          font-weight: 600;
          color: var(--primary-strong);
        }
        .submit.is-blocked {
          opacity: 0.55;
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
        .remove-tag-btn:hover { color: var(--heart); }
        .tag-input-row {
          display: flex;
          gap: 6px;
        }
        .tag-input-row input {
          flex: 1;
          min-width: 0;
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
        .duplicate-inline {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 10px 12px;
          border-radius: var(--r-md);
          border: 1px solid var(--primary-soft-2);
          background: var(--primary-soft);
          color: var(--primary-strong);
          font-size: 12.5px;
          font-weight: 600;
          line-height: 1.35;
        }
        .duplicate-inline-icon { flex-shrink: 0; font-size: 15px; line-height: 1; }
        .duplicate-inline-text { flex: 1; min-width: 0; }
        .duplicate-inline-btn {
          flex-shrink: 0;
          padding: 5px 9px;
          border-radius: var(--r-full);
          border: 1px solid var(--primary-soft-2);
          background: var(--surface);
          color: var(--primary-strong);
          font-family: inherit;
          font-size: 11.5px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease),
            border-color var(--dur-fast) var(--ease);
        }
        .duplicate-inline-btn:hover {
          background: var(--primary-soft-2);
          border-color: var(--primary);
        }
        .duplicate-overlay {
          position: fixed;
          inset: 0;
          z-index: 70;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(20, 14, 10, 0.62);
          backdrop-filter: blur(5px);
          animation: fadeIn 0.18s var(--ease);
        }
        .duplicate-modal {
          width: 100%;
          max-width: 360px;
          padding: 24px 22px 20px;
          text-align: center;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-xl);
          box-shadow: var(--shadow-lg);
          animation: fadeInUp 0.26s var(--ease-out) both;
        }
        .duplicate-icon {
          display: grid;
          place-items: center;
          width: 54px;
          height: 54px;
          margin: 0 auto 12px;
          border-radius: var(--r-full);
          background: var(--grad-primary);
          font-size: 24px;
          line-height: 1;
          box-shadow: var(--shadow-primary);
        }
        .duplicate-title {
          margin-bottom: 7px;
          font-family: var(--font-display), sans-serif;
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          line-height: 1.2;
        }
        .duplicate-desc {
          margin-bottom: 18px;
          font-size: 13.5px;
          font-weight: 500;
          line-height: 1.45;
          color: var(--text-soft);
        }
        .duplicate-actions {
          display: flex;
          gap: 9px;
        }
        .duplicate-secondary,
        .duplicate-primary {
          height: 44px;
          border-radius: var(--r-md);
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: transform var(--dur-fast) var(--ease),
            background var(--dur-fast) var(--ease);
        }
        .duplicate-secondary {
          flex: 1;
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text-soft);
        }
        .duplicate-secondary:hover { background: var(--surface-3); }
        .duplicate-primary {
          flex: 1.5;
          border: none;
          background: var(--grad-primary);
          color: var(--primary-contrast);
          box-shadow: var(--shadow-primary);
        }
        .duplicate-primary:active { transform: scale(0.98); }
        .chain-modal { text-align: center; }
        .chain-modal .duplicate-icon { margin-bottom: 10px; }
        .chain-badge {
          display: inline-block;
          margin-bottom: 12px;
          padding: 4px 11px;
          border-radius: var(--r-full);
          border: 1px solid var(--primary-soft-2);
          background: var(--primary-soft);
          color: var(--primary-strong);
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .chain-branch-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 14px;
          margin-bottom: 16px;
          border-radius: var(--r-md);
          border: 1px solid var(--border);
          background: var(--surface-2);
          text-align: left;
        }
        .chain-branch-name {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13.5px;
          font-weight: 700;
          color: var(--text);
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .chain-branch-address {
          font-size: 12.5px;
          font-weight: 500;
          line-height: 1.45;
          color: var(--text-soft);
          word-break: break-word;
        }
        .chain-actions {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .chain-primary,
        .chain-secondary {
          flex: none;
          width: 100%;
          height: 44px;
          border-radius: var(--r-md);
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: transform var(--dur-fast) var(--ease),
            background var(--dur-fast) var(--ease),
            opacity var(--dur-fast) var(--ease);
        }
        .chain-primary {
          border: none;
          background: var(--grad-primary);
          color: var(--primary-contrast);
          box-shadow: var(--shadow-primary);
        }
        .chain-primary:active { transform: scale(0.98); }
        .chain-secondary {
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text-soft);
        }
        .chain-secondary:hover { background: var(--surface-3); }
        .chain-primary:disabled,
        .chain-secondary:disabled,
        .chain-ghost:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .chain-ghost {
          height: 40px;
          padding: 8px 0;
          border: none;
          background: transparent;
          color: var(--text-soft);
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
          transition: color var(--dur-fast) var(--ease);
        }
        .chain-ghost:hover { color: var(--heart); }
        .actions { display: flex; gap: 10px; margin-top: 4px; }
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
          display: grid;
          place-items: center;
          box-shadow: var(--shadow-primary);
          transition: opacity var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
        }
        .submit:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
        .submit:not(:disabled):active { transform: scale(0.98); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
