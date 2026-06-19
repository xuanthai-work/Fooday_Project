'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { X, Upload, Star, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { refreshFoods, FoodCategory } from '@/hooks/useFoods';
import { dishImageService, DishImage } from '@/services/api';

const CATEGORIES: FoodCategory[] = ['Foods', 'Drinks', 'Snacks'];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

interface AddDishModalProps {
  onClose: () => void;
}

export default function AddDishModal({ onClose }: AddDishModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Foods');
  const [restaurant, setRestaurant] = useState('');
  const [rating, setRating] = useState(5);
  const [tag, setTag] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [candidates, setCandidates] = useState<DishImage[]>([]);
  const [manual, setManual] = useState(false); // true once the user uploads / picks
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

  // Auto-fetch an image from the dish name (debounced; skipped once user overrides).
  useEffect(() => {
    const q = name.trim();
    if (!q || manual) return;
    let active = true;
    const timer = setTimeout(async () => {
      const imgs = await dishImageService.search(q);
      if (!active) return;
      setCandidates(imgs);
      if (imgs[0]) setImageUrl((prev) => prev || imgs[0].url);
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [name, manual]);

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
      setImageUrl(data.publicUrl);
      setManual(true);
      setCandidates([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const pickCandidate = (url: string) => {
    setImageUrl(url);
    setManual(true);
  };

  const canSubmit = Boolean(name.trim() && restaurant.trim() && imageUrl) && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 8)}`;
    const { error: insErr } = await supabase.from('foods').insert({
      slug,
      name: name.trim(),
      category,
      restaurant: restaurant.trim(),
      rating,
      image_url: imageUrl,
      tag: tag.trim() || null,
    });
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
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-head">
          <h2 className="modal-title">Add a dish</h2>
          <button className="close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          {/* Image */}
          <div className="image-block">
            <div className="preview">
              {imageUrl ? (
                <Image src={imageUrl} alt={name || 'Dish'} fill sizes="320px" className="preview-img" />
              ) : (
                <div className="preview-empty">
                  <Sparkles size={20} />
                  <span>Type a name — we&apos;ll find a photo</span>
                </div>
              )}
            </div>

            {candidates.length > 0 && (
              <div className="thumbs">
                {candidates.map((c) => (
                  <button
                    type="button"
                    key={c.url}
                    className={`thumb ${imageUrl === c.url ? 'active' : ''}`}
                    onClick={() => pickCandidate(c.url)}
                    aria-label="Use this photo"
                  >
                    <Image src={c.url} alt={c.alt} width={52} height={52} className="thumb-img" />
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="upload-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
              {uploading ? 'Uploading…' : 'Upload a photo instead'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} />
          </div>

          {/* Name */}
          <label className="field">
            <span className="label">Dish name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spicy Beef Ramen"
              required
            />
          </label>

          {/* Category */}
          <div className="field">
            <span className="label">Category</span>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`chip ${category === c ? 'active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Restaurant */}
          <label className="field">
            <span className="label">Restaurant</span>
            <input
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
              placeholder="e.g. Noodle House"
              required
            />
          </label>

          {/* Rating */}
          <div className="field">
            <span className="label">Rating</span>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  className="star"
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
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

          {/* Tag */}
          <label className="field">
            <span className="label">Tag (optional)</span>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. Trending"
            />
          </label>

          {error && <div className="error">{error}</div>}

          <div className="actions">
            <button type="button" className="cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit" disabled={!canSubmit}>
              {busy ? <Loader2 size={18} className="spin" /> : 'Add dish'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(10, 10, 25, 0.55);
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
        .preview-img { object-fit: cover; }
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
        .upload-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary-strong); }
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
        .field input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
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
        .stars { display: flex; gap: 4px; }
        .star { background: none; border: none; padding: 2px; cursor: pointer; line-height: 0; }
        .error {
          padding: 10px 12px;
          border-radius: var(--r-md);
          background: rgba(255, 90, 126, 0.12);
          color: var(--heart);
          font-size: 13px;
          font-weight: 500;
        }
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
