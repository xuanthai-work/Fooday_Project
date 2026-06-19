'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Dices, Star, Heart, Sparkles, RotateCw } from 'lucide-react';
import { useFoods, CATEGORY_FILTERS, CategoryFilter, Food } from '@/hooks/useFoods';
import { useFavorites } from '@/hooks/useFavorites';

interface RandomViewProps {
  onNavigateToChat: (initialMsg?: string) => void;
}

export default function RandomView({ onNavigateToChat }: RandomViewProps) {
  const { foods } = useFoods();
  const { favorites, toggleFavorite } = useFavorites();
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [current, setCurrent] = useState<Food | null>(null);
  const [result, setResult] = useState<Food | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pool = useMemo(
    () => foods.filter((f) => category === 'All' || f.category === category),
    [foods, category],
  );

  // clear any pending reel timer on unmount
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const display = result ?? current ?? pool[0] ?? null;
  const pick = () => pool[Math.floor(Math.random() * pool.length)];

  const spin = () => {
    if (spinning || pool.length === 0) return;
    setResult(null);
    setSpinning(true);
    let delay = 60;
    const tick = () => {
      setCurrent(pick());
      delay = delay < 110 ? delay + 6 : delay * 1.22; // decelerate like a slot reel
      if (delay < 430) {
        timerRef.current = setTimeout(tick, delay);
      } else {
        const final = pick();
        setCurrent(final);
        setResult(final);
        setSpinning(false);
      }
    };
    tick();
  };

  const selectCategory = (c: CategoryFilter) => {
    if (spinning) return;
    setCategory(c);
    setResult(null);
    setCurrent(null);
  };

  const isFav = display ? favorites.has(display.id) : false;

  return (
    <div className="random animate-fade-in">
      <header className="rnd-head">
        <span className="eyebrow">
          <Dices size={13} /> Can&apos;t decide?
        </span>
        <h1 className="rnd-title">Random pick</h1>
      </header>

      <div className="rnd-chips" role="tablist" aria-label="Category">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c}
            className={`chip ${category === c ? 'active' : ''}`}
            onClick={() => selectCategory(c)}
            disabled={spinning}
          >
            {c}
          </button>
        ))}
      </div>

      <div className={`reel ${spinning ? 'spinning' : ''} ${result ? 'landed' : ''}`}>
        {display ? (
          <>
            <div className="reel-media">
              <Image
                src={display.image_url}
                alt={display.name}
                fill
                sizes="440px"
                className="reel-img"
                style={{ objectFit: 'cover' }}
              />
              <div className="reel-shade" />
              {result && <span className="reel-badge">You should eat</span>}
            </div>
            <div className="reel-info">
              <h2 className="reel-name">{display.restaurant}</h2>
              <p className="reel-place">{display.name}</p>
              <span className="reel-rating">
                <Star size={14} fill="var(--star)" color="var(--star)" />
                {display.rating.toFixed(1)}
              </span>
            </div>
          </>
        ) : (
          <div className="reel-empty">No dishes in this category yet.</div>
        )}
      </div>

      {result && (
        <div className="rnd-actions">
          <button
            className={`act ${isFav ? 'is-fav' : ''}`}
            onClick={() => toggleFavorite(result.id)}
          >
            <Heart size={16} fill={isFav ? 'var(--heart)' : 'none'} />
            {isFav ? 'Saved' : 'Favorite'}
          </button>
          <button
            className="act"
            onClick={() =>
              onNavigateToChat(`Tell me more about ${result.name} from ${result.restaurant}.`)
            }
          >
            <Sparkles size={16} /> Ask AI
          </button>
        </div>
      )}

      <button className="spin-btn" onClick={spin} disabled={spinning || pool.length === 0}>
        {result ? (
          <>
            <RotateCw size={18} /> Spin again
          </>
        ) : (
          <>
            <Dices size={18} /> Surprise me
          </>
        )}
      </button>

      <style jsx>{`
        .random {
          padding: clamp(20px, 6vw, 32px) clamp(16px, 5vw, 20px) 32px;
          max-width: 480px;
          margin-inline: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .rnd-head {
          text-align: center;
          margin-bottom: 18px;
        }
        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--primary-strong);
        }
        .rnd-title {
          font-size: clamp(24px, 7.5vw, 30px);
          font-weight: 800;
          color: var(--text);
          line-height: 1.1;
          margin-top: 2px;
        }
        .rnd-chips {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 22px;
        }
        .chip {
          padding: 9px 18px;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: transform var(--dur-fast) var(--ease),
            background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
        }
        .chip:hover:not(:disabled):not(.active) {
          transform: translateY(-2px);
          border-color: var(--primary);
          color: var(--primary-strong);
        }
        .chip.active {
          background: var(--grad-primary);
          color: var(--primary-contrast);
          border-color: transparent;
          box-shadow: var(--shadow-primary);
        }
        .chip:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .reel {
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-xl);
          overflow: hidden;
          box-shadow: var(--shadow-md);
          transition: box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease),
            transform var(--dur) var(--ease);
        }
        .reel.landed {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--ring), var(--shadow-lg);
          animation: popIn 0.4s var(--ease);
        }
        .reel-media {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          background: var(--surface-2);
        }
        .reel-img {
          object-fit: cover;
          transition: filter var(--dur-fast) var(--ease);
        }
        .reel.spinning .reel-img {
          filter: blur(5px) saturate(1.2);
        }
        .reel-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.45), transparent 55%);
          pointer-events: none;
        }
        .reel-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 5px 11px;
          border-radius: var(--r-full);
          background: var(--grad-primary);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          box-shadow: var(--shadow-primary);
        }
        .reel-info {
          padding: 14px 16px 16px;
        }
        .reel-name {
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .reel-place {
          font-size: 13px;
          color: var(--text-soft);
          margin-top: 2px;
        }
        .reel-rating {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          margin-top: 8px;
        }
        .reel-empty {
          padding: 48px 20px;
          text-align: center;
          color: var(--text-soft);
          font-size: 14px;
        }
        .rnd-actions {
          display: flex;
          gap: 10px;
          width: 100%;
          margin-top: 16px;
        }
        .act {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          height: 44px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
            transform var(--dur-fast) var(--ease);
        }
        .act:hover {
          transform: translateY(-2px);
          border-color: var(--primary);
          color: var(--primary-strong);
        }
        .act.is-fav {
          color: var(--heart);
          border-color: var(--heart);
        }
        .spin-btn {
          margin-top: 18px;
          width: 100%;
          height: 52px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: var(--r-full);
          border: none;
          background: var(--grad-primary);
          color: var(--primary-contrast);
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: var(--shadow-primary);
          transition: transform var(--dur-fast) var(--ease), opacity var(--dur-fast) var(--ease);
        }
        .spin-btn:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .spin-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .spin-btn:disabled {
          opacity: 0.6;
          cursor: default;
        }
      `}</style>
    </div>
  );
}
