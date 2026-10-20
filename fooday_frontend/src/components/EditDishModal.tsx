'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { X, Upload, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { refreshFoods, Food, FoodCategory, FOOD_CATEGORIES } from '@/hooks/useFoods';
import { dishImageService, DishImage } from '@/services/api';
import { useTranslation } from '@/i18n/LanguageContext';

interface EditDishModalProps {
  dish: Food;
  onClose: () => void;
  onUpdated?: (updated: Food) => void;
}

export default function EditDishModal({ dish, onClose, onUpdated }: EditDishModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [name, setName] = useState(dish.name ?? '');
  const [restaurant, setRestaurant] = useState(dish.restaurant ?? '');
  const [category, setCategory] = useState<FoodCategory>(dish.category ?? 'Foods');
  const [address, setAddress] = useState(dish.address ?? '');
  const [openingTime, setOpeningTime] = useState(dish.opening_time ?? '');
  const [tag, setTag] = useState(dish.tag ?? '');
  const [reviewNote, setReviewNote] = useState(dish.review_note ?? '');
  const [urlInput, setUrlInput] = useState(dish.image_url ?? '');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [unsplashUrl, setUnsplashUrl] = useState('');
  const [candidates, setCandidates] = useState<DishImage[]>([]);
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

  // Unsplash suggestions: only while the user hasn't pasted a URL or uploaded a photo.
  useEffect(() => {
    const q = name.trim();
    const hasUrl = /^https:\/\/\S+/i.test(urlInput.trim());
    if (!q || hasUrl || uploadedUrl) return;
    let active = true;
    const timer = setTimeout(async () => {
      const imgs = await dishImageService.search(q);
      if (!active) return;
      setCandidates(imgs);
      setUnsplashUrl(imgs[0]?.url ?? '');
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [name, urlInput, uploadedUrl]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9.]+/g, '-');
      const path = `${user.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from('dish-images').upload(path, file);
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('dish-images').getPublicUrl(path);
      setUploadedUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.addDish.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const pickCandidate = (url: string) => setUnsplashUrl(url);

  // Image priority: pasted URL → uploaded photo → Unsplash → existing image.
  const urlValid = /^https:\/\/\S+/i.test(urlInput.trim());
  const resolvedImage =
    (urlValid ? urlInput.trim() : '') || uploadedUrl || unsplashUrl || dish.image_url || '';
  const imageSource: 'url' | 'upload' | 'unsplash' | 'existing' | 'none' = urlValid
    ? 'url'
    : uploadedUrl
      ? 'upload'
      : unsplashUrl
        ? 'unsplash'
        : dish.image_url
          ? 'existing'
          : 'none';
  const canSubmit = Boolean(name.trim() && restaurant.trim()) && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const { data, error: updErr } = await supabase
      .from('foods')
      .update({
        name: name.trim(),
        restaurant: restaurant.trim(),
        category,
        address: address.trim() || null,
        opening_time: openingTime.trim() || null,
        tag: tag.trim() || null,
        review_note: reviewNote.trim() || null,
        image_url: resolvedImage,
      })
      .eq('id', dish.id)
      .select()
      .single();

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
          {/* Image — paste URL → upload → Unsplash suggestions → existing image */}
          <div className="image-block">
            <div className="preview">
              {resolvedImage ? (
                <Image
                  src={resolvedImage}
                  alt={name || 'Dish'}
                  fill
                  sizes="320px"
                  className="preview-img"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div className="preview-empty">
                  <Sparkles size={20} />
                  <span>{t.addDish.pasteHint}</span>
                </div>
              )}
              {resolvedImage && imageSource !== 'existing' && (
                <span className="src-badge">
                  {imageSource === 'url'
                    ? t.addDish.fromUrl
                    : imageSource === 'upload'
                      ? t.addDish.uploaded
                      : t.addDish.auto}
                </span>
              )}
            </div>

            <label className="field">
              <span className="label">{t.editDish.imageUrl}</span>
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={t.addDish.imageUrlPlaceholder}
                inputMode="url"
              />
            </label>

            <div className="upload-row">
              <button
                type="button"
                className="upload-btn"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                {uploading
                  ? t.addDish.uploading
                  : uploadedUrl
                    ? t.addDish.replacePhoto
                    : t.addDish.uploadPhoto}
              </button>
              {uploadedUrl && (
                <button type="button" className="link-btn" onClick={() => setUploadedUrl('')}>
                  {t.addDish.removeUpload}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} />
            </div>

            {!urlValid && !uploadedUrl && candidates.length > 0 && (
              <div className="thumbs">
                {candidates.map((c) => (
                  <button
                    type="button"
                    key={c.url}
                    className={`thumb ${unsplashUrl === c.url ? 'active' : ''}`}
                    onClick={() => pickCandidate(c.url)}
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

          <label className="field">
            <span className="label">{t.editDish.restaurant}</span>
            <input
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
              placeholder={t.addDish.restaurantPlaceholder}
              required
            />
          </label>

          <label className="field">
            <span className="label">{t.editDish.dishName}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.addDish.dishNamePlaceholder}
              required
            />
          </label>

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

          <label className="field">
            <span className="label">{t.editDish.address}</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t.detail.noAddress}
            />
          </label>

          <div className="row">
            <label className="field">
              <span className="label">{t.editDish.openingTime}</span>
              <input
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                placeholder={t.detail.noHours}
              />
            </label>

            <label className="field">
              <span className="label">{t.editDish.tag}</span>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder={t.addDish.tagPlaceholder}
              />
            </label>
          </div>

          <label className="field">
            <span className="label">{t.editDish.reviewNote}</span>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
              placeholder={t.detail.reviewNote}
            />
          </label>

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
        .preview {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          border-radius: var(--r-lg);
          overflow: hidden;
          background: var(--surface-2);
          border: 1px solid var(--border);
        }
        .preview-empty {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--text-faint);
          font-size: 13px;
        }
        .preview-img {
          object-fit: cover;
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
        .upload-btn {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 14px;
          border-radius: var(--r-full);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
        }
        .upload-btn:hover:not(:disabled) {
          border-color: var(--primary);
          color: var(--primary-strong);
        }
        .upload-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .link-btn {
          background: none;
          border: none;
          padding: 0;
          color: var(--text-faint);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
        }
        .link-btn:hover {
          color: var(--heart);
        }
        .src-badge {
          position: absolute;
          bottom: 8px;
          left: 8px;
          max-width: calc(100% - 16px);
          padding: 4px 9px;
          border-radius: var(--r-full);
          background: var(--glass-strong);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          color: var(--text);
          font-size: 11px;
          font-weight: 700;
          border: 1px solid var(--border);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }
        .row {
          display: flex;
          gap: 12px;
        }
        .row .field {
          flex: 1;
        }
        @media (max-width: 420px) {
          .row {
            flex-direction: column;
          }
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
