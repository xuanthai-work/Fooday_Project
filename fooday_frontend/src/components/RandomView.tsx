'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Dices, Star, Heart, Sparkles, RotateCw, Eye, Loader2 } from 'lucide-react';
import { useFoods, CATEGORY_FILTERS, CategoryFilter, Food } from '@/hooks/useFoods';
import { useFavorites } from '@/hooks/useFavorites';
import { useTranslation } from '@/i18n/LanguageContext';
import DishDetailModal from './DishDetailModal';

interface RandomViewProps {
  onNavigateToChat: (initialMsg?: string) => void;
}

type Rarity = 'blue' | 'purple' | 'pink' | 'gold';

const REEL_SIZE = 45;
const SPIN_MS = 5200;

function buildReel(pool: Food[], size = REEL_SIZE): Food[] {
  if (pool.length === 0) return [];
  const out: Food[] = [];
  while (out.length < size) {
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out;
}

function rarityOf(food: Food): Rarity {
  if (food.rating >= 4.6) return 'gold';
  if (food.rating >= 4.3) return 'pink';
  if (food.rating >= 4.0) return 'purple';
  return 'blue';
}

export default function RandomView({ onNavigateToChat }: RandomViewProps) {
  const { t } = useTranslation();
  const { foods } = useFoods();
  const { favorites, toggleFavorite } = useFavorites();
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [reel, setReel] = useState<Food[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Food | null>(null);
  const [selectedDish, setSelectedDish] = useState<Food | null>(null);
  const [offset, setOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const pool = useMemo(
    () => foods.filter((f) => category === 'All' || f.category === category),
    [foods, category],
  );

  const initialReel = useMemo(() => buildReel(pool), [pool]);
  const track = reel.length > 0 ? reel : initialReel;

  useEffect(
    () => () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      if (audioRef.current) void audioRef.current.close();
    },
    [],
  );

  const playTicks = () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const startAt = ctx.currentTime + 0.05;
      let at = 0;
      let interval = 0.055;
      for (let i = 0; i < 48 && at < SPIN_MS / 1000 - 0.4; i += 1) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 820 + Math.random() * 320;
        gain.gain.setValueAtTime(0.0001, startAt + at);
        gain.gain.exponentialRampToValueAtTime(0.04, startAt + at + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + at + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt + at);
        osc.stop(startAt + at + 0.06);
        at += interval;
        interval *= 1.13;
      }
    } catch {
      /* Web Audio is unavailable — spin silently. */
    }
  };

  const spinCase = () => {
    if (spinning || pool.length === 0) return;
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);

    const winner = pool[Math.floor(Math.random() * pool.length)];
    const winnerIndex = 32 + Math.floor(Math.random() * 7);
    const nextReel = buildReel(pool);
    if (nextReel.length > winnerIndex) nextReel[winnerIndex] = winner;

    setResult(null);
    setSelectedDish(null);
    setReel(nextReel);
    setOffset(0);
    setIsTransitioning(false);
    setSpinning(true);
    playTicks();

    startTimerRef.current = setTimeout(() => {
      const containerW = containerRef.current?.clientWidth || 360;
      const isMobile = window.innerWidth < 640;
      const cardW = isMobile ? 140 : 170;
      const gap = 12;
      const step = cardW + gap;
      const randomShift = (Math.random() - 0.5) * (cardW * 0.6);
      const targetX = winnerIndex * step + cardW / 2 - containerW / 2 + randomShift;
      setIsTransitioning(true);
      setOffset(-targetX);
    }, 50);

    endTimerRef.current = setTimeout(() => {
      setSpinning(false);
      setResult(winner);
    }, 50 + SPIN_MS);
  };

  const selectCategory = (c: CategoryFilter) => {
    if (spinning) return;
    setCategory(c);
    setResult(null);
    setSelectedDish(null);
    setReel([]);
    setOffset(0);
    setIsTransitioning(false);
  };

  const isFav = result ? favorites.has(result.id) : false;

  return (
    <div className="random animate-fade-in">
      <header className="rnd-head">
        <span className="eyebrow">
          <Dices size={13} /> {t.random.eyebrow}
        </span>
        <h1 className="rnd-title">{t.random.title}</h1>
      </header>

      <div className="rnd-chips" role="tablist" aria-label={t.home.categories.All}>
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c}
            className={`chip ${category === c ? 'active' : ''}`}
            onClick={() => selectCategory(c)}
            disabled={spinning}
          >
            {t.home.categories[c]}
          </button>
        ))}
      </div>

      <div className="roulette-box" ref={containerRef} aria-live="polite">
        {track.length > 0 ? (
          <div
            className="roulette-track"
            style={{
              transform: `translate3d(${offset}px, 0, 0)`,
              transition: isTransitioning
                ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.15, 1)`
                : 'none',
            }}
          >
            {track.map((item, i) => (
              <div key={`${item.id}-${i}`} className={`roulette-card r-${rarityOf(item)}`}>
                <div className="rc-media">
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    sizes="170px"
                    loading="eager"
                    className="rc-img"
                    style={{ objectFit: 'cover' }}
                  />
                  <span className="rc-cat">{t.home.categories[item.category]}</span>
                </div>
                <div className="rc-body">
                  <p className="rc-name">{item.name}</p>
                  <span className="rc-place">{item.restaurant}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="roulette-empty">{t.random.empty}</div>
        )}
        <div className="roulette-fade fade-left" />
        <div className="roulette-fade fade-right" />
        <div className="center-ticker" />
      </div>

      {result && (
        <div className="winner-block">
          <p className="winner-congrats">{t.random.congrats}</p>
          <div className="winner-card">
            <div className="winner-media">
              <Image
                src={result.image_url}
                alt={result.name}
                fill
                sizes="120px"
                className="winner-img"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div className="winner-info">
              <h2 className="winner-name">{result.name}</h2>
              <p className="winner-place">{result.restaurant}</p>
              <span className="winner-rating">
                <Star size={14} fill="var(--star)" color="var(--star)" />
                {result.rating.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="rnd-actions">
            <button className="act" onClick={() => setSelectedDish(result)}>
              <Eye size={16} /> {t.random.viewDetail}
            </button>
            <button
              className="act"
              onClick={() =>
                onNavigateToChat(t.random.askAbout(result.name, result.restaurant))
              }
            >
              <Sparkles size={16} /> {t.random.askAi}
            </button>
            <button
              className={`act ${isFav ? 'is-fav' : ''}`}
              onClick={() => toggleFavorite(result.id)}
            >
              <Heart size={16} fill={isFav ? 'var(--heart)' : 'none'} />
              {isFav ? t.random.saved : t.random.favorite}
            </button>
          </div>
        </div>
      )}

      <button
        className={`spin-btn ${spinning ? 'is-spinning' : ''}`}
        onClick={spinCase}
        disabled={spinning || pool.length === 0}
      >
        {spinning ? (
          <>
            <Loader2 size={18} className="spin-ico" /> {t.random.spinningCase}
          </>
        ) : result ? (
          <>
            <RotateCw size={18} /> {t.random.spinAgain}
          </>
        ) : (
          <>
            <Dices size={18} /> {t.random.spinCase}
          </>
        )}
      </button>

      {selectedDish && (
        <DishDetailModal
          dish={selectedDish}
          onClose={() => setSelectedDish(null)}
          onNavigateToChat={onNavigateToChat}
        />
      )}

      <style jsx>{`
        .random {
          padding: clamp(20px, 6vw, 32px) clamp(16px, 5vw, 20px) 40px;
          max-width: 640px;
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
        .roulette-box {
          position: relative;
          width: 100%;
          overflow: hidden;
          padding-block: 18px;
          border-radius: var(--r-lg);
          border: 1px solid rgba(234, 179, 8, 0.35);
          background: linear-gradient(180deg, #241c16 0%, #15110e 55%, #0c0907 100%);
          box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.65),
            inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 14px 34px rgba(0, 0, 0, 0.28);
        }
        .roulette-box::before {
          content: '';
          position: absolute;
          inset: 5px;
          border-radius: calc(var(--r-lg) - 5px);
          border: 1px solid rgba(234, 179, 8, 0.16);
          pointer-events: none;
          z-index: 5;
        }
        .roulette-track {
          display: flex;
          gap: 12px;
          width: max-content;
          will-change: transform;
        }
        .roulette-card {
          flex: 0 0 auto;
          width: 170px;
          border-radius: 14px;
          overflow: hidden;
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
        }
        .rc-media {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          background: var(--surface-2);
        }
        .rc-img {
          object-fit: cover;
        }
        .rc-cat {
          position: absolute;
          top: 7px;
          left: 7px;
          padding: 3px 8px;
          border-radius: var(--r-full);
          background: rgba(12, 9, 7, 0.72);
          color: #f8fafc;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.02em;
          backdrop-filter: blur(4px);
        }
        .rc-body {
          padding: 8px 10px 10px;
        }
        .rc-name {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rc-place {
          display: block;
          margin-top: 2px;
          font-size: 11px;
          color: var(--text-soft);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .r-blue {
          border-color: rgba(59, 130, 246, 0.65);
          box-shadow: inset 0 0 18px rgba(59, 130, 246, 0.16);
        }
        .r-purple {
          border-color: rgba(168, 85, 247, 0.7);
          box-shadow: inset 0 0 18px rgba(168, 85, 247, 0.18);
        }
        .r-pink {
          border-color: rgba(236, 72, 153, 0.7);
          box-shadow: inset 0 0 18px rgba(236, 72, 153, 0.2);
        }
        .r-gold {
          border-color: rgba(234, 179, 8, 0.85);
          box-shadow: inset 0 0 18px rgba(234, 179, 8, 0.22);
        }
        .roulette-fade {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 72px;
          pointer-events: none;
          z-index: 3;
        }
        .fade-left {
          left: 0;
          background: linear-gradient(to right, #15110e 12%, rgba(21, 17, 14, 0));
        }
        .fade-right {
          right: 0;
          background: linear-gradient(to left, #15110e 12%, rgba(21, 17, 14, 0));
        }
        .center-ticker {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 2px;
          margin-left: -1px;
          background: linear-gradient(
            to bottom,
            #fbbf24 0%,
            rgba(251, 191, 36, 0.12) 30%,
            rgba(251, 191, 36, 0.12) 70%,
            #fbbf24 100%
          );
          box-shadow: 0 0 12px rgba(251, 191, 36, 0.75);
          pointer-events: none;
          z-index: 4;
        }
        .center-ticker::before,
        .center-ticker::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
        }
        .center-ticker::before {
          top: -1px;
          border-top: 12px solid #fbbf24;
          filter: drop-shadow(0 2px 4px rgba(251, 191, 36, 0.6));
        }
        .center-ticker::after {
          bottom: -1px;
          border-bottom: 12px solid #fbbf24;
          filter: drop-shadow(0 -2px 4px rgba(251, 191, 36, 0.6));
        }
        .roulette-empty {
          padding: 46px 20px;
          text-align: center;
          color: rgba(247, 244, 238, 0.65);
          font-size: 14px;
        }
        .winner-block {
          position: relative;
          width: 100%;
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: fadeUp 0.45s var(--ease);
        }
        .winner-block::before {
          content: '';
          position: absolute;
          top: -28px;
          left: 50%;
          transform: translateX(-50%);
          width: min(100%, 420px);
          height: 220px;
          background: radial-gradient(
            ellipse at top,
            rgba(251, 191, 36, 0.22),
            transparent 68%
          );
          pointer-events: none;
          z-index: 0;
        }
        .winner-congrats,
        .winner-card,
        .rnd-actions {
          position: relative;
          z-index: 1;
        }
        .winner-congrats {
          font-size: 13px;
          font-weight: 700;
          color: var(--primary-strong);
          text-align: center;
          margin-bottom: 10px;
        }
        .winner-card {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px;
          border-radius: var(--r-lg);
          background: var(--surface);
          border: 1px solid rgba(234, 179, 8, 0.7);
          box-shadow: 0 0 30px rgba(234, 179, 8, 0.5), var(--shadow-md);
          animation: popIn 0.45s var(--ease);
        }
        .winner-media {
          position: relative;
          flex: 0 0 auto;
          width: 96px;
          height: 96px;
          border-radius: 12px;
          overflow: hidden;
          background: var(--surface-2);
        }
        .winner-img {
          object-fit: cover;
        }
        .winner-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .winner-name {
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .winner-place {
          font-size: 13px;
          color: var(--text-soft);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .winner-rating {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          margin-top: 8px;
        }
        .rnd-actions {
          display: flex;
          gap: 8px;
          width: 100%;
          margin-top: 14px;
        }
        .act {
          flex: 1;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 44px;
          padding: 0 8px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text-soft);
          font-size: 12.5px;
          font-weight: 700;
          text-align: center;
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
          opacity: 0.65;
          cursor: default;
        }
        .spin-ico {
          animation: spin 0.9s linear infinite;
        }
        @media (max-width: 639px) {
          .roulette-card {
            width: 140px;
          }
          .roulette-fade {
            width: 52px;
          }
          .winner-media {
            width: 82px;
            height: 82px;
          }
          .rnd-actions {
            flex-wrap: wrap;
          }
          .act {
            flex: 1 1 calc(50% - 4px);
            font-size: 12px;
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
