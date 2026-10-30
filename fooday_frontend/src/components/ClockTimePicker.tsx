'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Moon, Sun, X } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import {
  angleToClockTime,
  clockTimeToAngle,
  formatTimeAmPm,
  meridiemOf,
  withMeridiem,
  type Meridiem,
  type OpeningHours,
} from '@/lib/openingHours';

interface ClockTimePickerProps {
  hours: OpeningHours;
  onSave: (hours: OpeningHours) => void;
  onClose: () => void;
}

type Tab = 'open' | 'close';

const SIZE = 200;
const CENTER = SIZE / 2;
const NUMBER_RADIUS = 74;
const HAND_RADIUS = 58;
const NUMBERS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const pad = (value: number) => String(value).padStart(2, '0');

/** 12-hour position (0…719 minutes) of an AM/PM time. */
function halfDayMinutes(time: string): number {
  const hour = Number(time.slice(0, 2)) % 12;
  const minute = Number(time.slice(3, 5)) || 0;
  return hour * 60 + minute;
}

function fromHalfDayMinutes(minutes: number, meridiem: Meridiem): string {
  const wrapped = ((minutes % 720) + 720) % 720;
  const hour12 = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const hour24 =
    meridiem === 'PM' ? (hour12 === 0 ? 12 : hour12 + 12) : hour12 === 0 ? 0 : hour12;
  return `${pad(hour24)}:${pad(minute)}`;
}

/** `08:30` → `8:30` — shown before the user picks day or night. */
function formatWithoutMeridiem(time: string): string {
  const hour = Number(time.slice(0, 2)) % 12 || 12;
  return `${hour}:${time.slice(3, 5)}`;
}

/**
 * A compact 12-hour clock with a single hand: the hand angle sets both the hour
 * and the minutes (between 2 and 3 reads 2:30). Day = AM, night = PM, chosen
 * per side — nothing is preselected, so overnight shops work too.
 */
export default function ClockTimePicker({ hours, onSave, onClose }: ClockTimePickerProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('open');
  const [open, setOpen] = useState(hours.open || '');
  const [close, setClose] = useState(hours.close || '');
  const [openMeridiem, setOpenMeridiem] = useState<Meridiem | null>(
    hours.open ? meridiemOf(hours.open) : null,
  );
  const [closeMeridiem, setCloseMeridiem] = useState<Meridiem | null>(
    hours.close ? meridiemOf(hours.close) : null,
  );
  const dialRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const activeTime = tab === 'open' ? open : close;
  const activeMeridiem = tab === 'open' ? openMeridiem : closeMeridiem;
  // Before a side is chosen, the hand still moves — the maths uses AM and the
  // preview hides the suffix until the user picks day or night.
  const mappingMeridiem: Meridiem = activeMeridiem ?? 'AM';
  const handAngle = activeTime ? clockTimeToAngle(activeTime) : 0;
  const preview = activeTime
    ? activeMeridiem
      ? formatTimeAmPm(activeTime)
      : formatWithoutMeridiem(activeTime)
    : '--:--';
  const canSave =
    (!open || openMeridiem !== null) && (!close || closeMeridiem !== null);
  const hasSomething = Boolean(open || close);

  // Escape closes, and the page behind never scrolls while the sheet is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const setActiveTime = (next: string) => {
    if (tab === 'open') setOpen(next);
    else setClose(next);
  };

  const chooseMeridiem = (next: Meridiem) => {
    if (tab === 'open') {
      setOpenMeridiem(next);
      if (open) setOpen(withMeridiem(open, next));
    } else {
      setCloseMeridiem(next);
      if (close) setClose(withMeridiem(close, next));
    }
  };

  const nudge = (delta: number) => {
    const base = activeTime || '00:00';
    setActiveTime(
      fromHalfDayMinutes(halfDayMinutes(base) + delta, mappingMeridiem),
    );
  };

  const angleFromPointer = (event: React.PointerEvent): number => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(event.clientX - cx, cy - event.clientY) * 180) / Math.PI;
  };

  const updateFromPointer = (event: React.PointerEvent) => {
    setActiveTime(angleToClockTime(angleFromPointer(event), mappingMeridiem));
  };

  const onPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    draggingRef.current = true;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    updateFromPointer(event);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateFromPointer(event);
  };

  const stopDragging = (event: React.PointerEvent) => {
    draggingRef.current = false;
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
  };

  const dialMode = activeMeridiem === 'AM' ? 'is-day' : activeMeridiem === 'PM' ? 'is-night' : 'is-neutral';

  return createPortal(
    <div className="clock-overlay" role="presentation" onClick={onClose}>
      <div
        className="clock-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clock-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="clock-head">
          <h3 id="clock-title">{t.addDish.hoursTitle}</h3>
          <button
            type="button"
            className="clock-close"
            onClick={onClose}
            aria-label={t.addDish.hoursCancel}
          >
            <X size={18} />
          </button>
        </header>

        <div className="clock-tabs" role="tablist" aria-label={t.addDish.hoursTitle}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'open'}
            className={`clock-tab ${tab === 'open' ? 'active' : ''}`}
            onClick={() => setTab('open')}
          >
            {t.addDish.hoursTabOpen}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'close'}
            className={`clock-tab ${tab === 'close' ? 'active' : ''}`}
            onClick={() => setTab('close')}
          >
            {t.addDish.hoursTabClose}
          </button>
        </div>

        <div className="clock-daynight" role="group" aria-label={t.addDish.hoursDayNight}>
          <button
            type="button"
            className={`clock-day ${activeMeridiem === 'AM' ? 'active' : ''}`}
            aria-pressed={activeMeridiem === 'AM'}
            onClick={() => chooseMeridiem('AM')}
          >
            <Sun size={15} /> {t.addDish.hoursDay}
          </button>
          <button
            type="button"
            className={`clock-night ${activeMeridiem === 'PM' ? 'active' : ''}`}
            aria-pressed={activeMeridiem === 'PM'}
            onClick={() => chooseMeridiem('PM')}
          >
            <Moon size={15} /> {t.addDish.hoursNight}
          </button>
        </div>

        <div
          className={`clock-dial ${dialMode}`}
          tabIndex={0}
          role="slider"
          aria-label={tab === 'open' ? t.addDish.hoursTabOpen : t.addDish.hoursTabClose}
          aria-valuetext={preview}
          aria-valuemin={0}
          aria-valuemax={719}
          aria-valuenow={activeTime ? halfDayMinutes(activeTime) : 0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault();
              nudge(5);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault();
              nudge(-5);
            }
          }}
        >
          <svg
            ref={dialRef}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width={SIZE}
            height={SIZE}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            <defs>
              <radialGradient id="clock-day-sky" cx="50%" cy="10%" r="95%">
                <stop offset="0%" stopColor="#fff9e8" />
                <stop offset="52%" stopColor="#ffe7bb" />
                <stop offset="100%" stopColor="#ffc98c" />
              </radialGradient>
              <radialGradient id="clock-night-sky" cx="50%" cy="10%" r="95%">
                <stop offset="0%" stopColor="#2c3869" />
                <stop offset="100%" stopColor="#141a33" />
              </radialGradient>
              <radialGradient id="clock-sun-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffd873" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#ffb02e" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="clock-moon-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#aebfff" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#5f74d6" stopOpacity="0" />
              </radialGradient>
              <filter id="clock-soft" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="1.4" />
              </filter>
            </defs>

            <circle
              cx={CENTER}
              cy={CENTER}
              r={CENTER - 2}
              className="dial-face"
              fill={
                activeMeridiem === 'AM'
                  ? 'url(#clock-day-sky)'
                  : activeMeridiem === 'PM'
                    ? 'url(#clock-night-sky)'
                    : undefined
              }
            />
            <circle cx={CENTER} cy={CENTER} r={CENTER - 12} className="dial-ring" />

            {activeMeridiem === 'AM' && (
              <g aria-hidden="true">
                <circle cx={CENTER} cy={58} r={26} fill="url(#clock-sun-glow)" />
                {Array.from({ length: 8 }).map((_, index) => {
                  const rad = (index * 45 * Math.PI) / 180;
                  const inner = 13;
                  const outer = 19;
                  return (
                    <line
                      key={index}
                      x1={CENTER + inner * Math.sin(rad)}
                      y1={58 - inner * Math.cos(rad)}
                      x2={CENTER + outer * Math.sin(rad)}
                      y2={58 - outer * Math.cos(rad)}
                      className="sun-ray"
                    />
                  );
                })}
                <circle cx={CENTER} cy={58} r={8.5} className="morning-sun" />
                <g className="cloud" filter="url(#clock-soft)">
                  <ellipse cx={70} cy={132} rx={18} ry={7} />
                  <circle cx={60} cy={128} r={6} />
                  <circle cx={72} cy={126} r={8} />
                </g>
                <g className="cloud" filter="url(#clock-soft)">
                  <ellipse cx={134} cy={140} rx={16} ry={6} />
                  <circle cx={126} cy={136} r={5.5} />
                  <circle cx={138} cy={134} r={7} />
                </g>
              </g>
            )}

            {activeMeridiem === 'PM' && (
              <g aria-hidden="true">
                <circle cx={CENTER} cy={58} r={24} fill="url(#clock-moon-glow)" />
                <path
                  d={`M ${CENTER + 6} 50 a 9 9 0 1 1 -12 0 a 7 7 0 1 0 12 0`}
                  className="night-moon"
                />
                {[
                  [64, 46],
                  [138, 62],
                  [70, 114],
                  [134, 118],
                  [100, 40],
                  [84, 78],
                ].map(([x, y]) => (
                  <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} className="night-star" />
                ))}
              </g>
            )}

            {NUMBERS.map((number) => {
              const angle = (number % 12) * 30;
              const rad = (angle * Math.PI) / 180;
              const x = CENTER + NUMBER_RADIUS * Math.sin(rad);
              const y = CENTER - NUMBER_RADIUS * Math.cos(rad);
              return (
                <text
                  key={number}
                  x={x}
                  y={y}
                  className={`dial-number ${number === 12 ? 'top' : ''}`}
                >
                  {number}
                </text>
              );
            })}

            <line
              x1={CENTER}
              y1={CENTER}
              x2={CENTER + HAND_RADIUS * Math.sin((handAngle * Math.PI) / 180)}
              y2={CENTER - HAND_RADIUS * Math.cos((handAngle * Math.PI) / 180)}
              className={`dial-hand ${activeTime ? '' : 'is-idle'}`}
            />
            <circle
              cx={CENTER + HAND_RADIUS * Math.sin((handAngle * Math.PI) / 180)}
              cy={CENTER - HAND_RADIUS * Math.cos((handAngle * Math.PI) / 180)}
              r={5}
              className={`dial-knob ${activeTime ? '' : 'is-idle'}`}
            />
            <circle cx={CENTER} cy={CENTER} r={7} className="dial-hub" />
          </svg>
        </div>

        <div className="clock-preview">
          <strong>{preview}</strong>
          <span>
            {hasSomething && !canSave
              ? t.addDish.hoursPickDayNight
              : t.addDish.hoursHint}
          </span>
        </div>

        <div className="clock-actions">
          <button
            type="button"
            className="clock-clear"
            onClick={() => onSave({ open: '', close: '' })}
          >
            {t.addDish.hoursClear}
          </button>
          <div className="clock-actions-right">
            <button type="button" className="clock-cancel" onClick={onClose}>
              {t.addDish.hoursCancel}
            </button>
            <button
              type="button"
              className="clock-done"
              disabled={!canSave || !hasSomething}
              onClick={() =>
                onSave({
                  open: openMeridiem !== null ? open : '',
                  close: closeMeridiem !== null ? close : '',
                })
              }
            >
              {t.addDish.hoursDone}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .clock-overlay {
          position: fixed;
          inset: 0;
          z-index: 160;
          display: grid;
          align-items: end;
          justify-items: center;
          padding: 0;
          background: rgba(12, 9, 7, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          animation: clockFade 0.16s var(--ease) both;
        }
        .clock-sheet {
          width: 100%;
          max-width: 420px;
          padding: 16px 18px calc(16px + env(safe-area-inset-bottom));
          border-radius: 22px 22px 0 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-bottom: none;
          box-shadow: var(--shadow-lg);
          color: var(--text);
          animation: clockUp 0.2s var(--ease-out) both;
        }
        .clock-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .clock-head h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 800;
        }
        .clock-close {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-soft);
          cursor: pointer;
        }
        .clock-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          padding: 4px;
          border-radius: var(--r-full);
          background: var(--surface-2);
          border: 1px solid var(--border);
          margin-bottom: 8px;
        }
        .clock-tab {
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: var(--r-full);
          background: transparent;
          color: var(--text-soft);
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .clock-tab.active {
          background: var(--grad-primary);
          color: var(--primary-contrast);
          box-shadow: var(--shadow-primary);
        }
        /* Day / night picker — no default is selected until tapped. */
        .clock-daynight {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-bottom: 8px;
        }
        .clock-day,
        .clock-night {
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-soft);
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
            border-color var(--dur-fast) var(--ease);
        }
        .clock-day.active {
          background: rgba(255, 170, 64, 0.18);
          border-color: #ffaa40;
          color: #ffb95e;
        }
        .clock-night.active {
          background: rgba(99, 130, 255, 0.18);
          border-color: #7c94ff;
          color: #a6b8ff;
        }
        .clock-dial {
          display: grid;
          place-items: center;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          outline: none;
        }
        .clock-dial:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 4px;
          border-radius: 50%;
        }
        .dial-face {
          fill: var(--surface-2);
          stroke: var(--border-strong);
          stroke-width: 2;
          transition: fill 0.2s ease;
        }
        /* Day: warm cream face. Night: deep navy. */
        .clock-dial.is-day .dial-face {
          stroke: #f0c48a;
        }
        .clock-dial.is-night .dial-face {
          stroke: #46557f;
        }
        .dial-ring {
          fill: none;
          stroke: var(--border);
          stroke-width: 1;
          stroke-dasharray: 2 6;
        }
        .clock-dial.is-day .dial-ring {
          stroke: rgba(196, 132, 52, 0.35);
        }
        .clock-dial.is-night .dial-ring {
          stroke: rgba(160, 180, 255, 0.35);
        }
        .dial-number {
          fill: var(--text-soft);
          font-size: 12px;
          font-weight: 700;
          text-anchor: middle;
          dominant-baseline: central;
          pointer-events: none;
        }
        .clock-dial.is-day .dial-number {
          fill: #8a5a1f;
        }
        .clock-dial.is-night .dial-number {
          fill: #b9c6ff;
        }
        .dial-number.top {
          fill: var(--primary-strong);
        }
        .clock-dial.is-day .dial-number.top {
          fill: #b06a0c;
        }
        .clock-dial.is-night .dial-number.top {
          fill: #dbe3ff;
        }
        .morning-sun {
          fill: #ffb02e;
          stroke: #fff8e3;
          stroke-width: 1.5;
        }
        .sun-ray {
          stroke: #f59e0b;
          stroke-width: 2;
          stroke-linecap: round;
          opacity: 0.55;
        }
        .cloud {
          fill: #ffffff;
          opacity: 0.62;
        }
        .night-moon {
          fill: #e6ebff;
        }
        .night-star {
          fill: #eef2ff;
          opacity: 0.75;
        }
        .dial-hand {
          stroke: var(--primary);
          stroke-width: 4;
          stroke-linecap: round;
          pointer-events: none;
        }
        .clock-dial.is-day .dial-hand {
          stroke: #e07b1f;
        }
        .clock-dial.is-night .dial-hand {
          stroke: #8ea6ff;
        }
        .dial-hand.is-idle {
          opacity: 0.35;
        }
        .dial-knob {
          fill: var(--primary);
          stroke: #fff;
          stroke-width: 2;
          pointer-events: none;
        }
        .clock-dial.is-day .dial-knob {
          fill: #e07b1f;
        }
        .clock-dial.is-night .dial-knob {
          fill: #8ea6ff;
        }
        .dial-knob.is-idle {
          opacity: 0.35;
        }
        .dial-hub {
          fill: var(--primary-strong);
          stroke: #fff;
          stroke-width: 2;
          pointer-events: none;
        }
        .clock-dial.is-night .dial-hub {
          fill: #cfd9ff;
        }
        .clock-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          margin: 6px 0 12px;
        }
        .clock-preview strong {
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--primary-strong);
          font-variant-numeric: tabular-nums;
        }
        .clock-preview span {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-faint);
          text-align: center;
        }
        .clock-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .clock-actions-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .clock-clear {
          border: none;
          background: none;
          padding: 8px 4px;
          color: var(--heart);
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .clock-cancel,
        .clock-done {
          height: 40px;
          padding: 0 18px;
          border-radius: var(--r-full);
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .clock-cancel {
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text-soft);
        }
        .clock-done {
          border: none;
          background: var(--grad-primary);
          color: var(--primary-contrast);
          box-shadow: var(--shadow-primary);
        }
        .clock-done:disabled {
          opacity: 0.45;
          cursor: default;
        }
        @media (min-width: 640px) {
          .clock-overlay {
            align-items: center;
          }
          .clock-sheet {
            border-radius: var(--r-lg);
            border-bottom: 1px solid var(--border);
          }
        }
        @keyframes clockFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes clockUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}
