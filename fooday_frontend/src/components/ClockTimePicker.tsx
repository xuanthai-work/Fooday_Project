'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import {
  angleToClockTime,
  clockTimeToAngle,
  formatTimeAmPm,
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

/**
 * A compact 12-hour clock with a single hand: the hand angle sets both the hour
 * and the minutes (between 2 and 3 reads 2:30). Opening times are always AM,
 * closing times PM. Values are stored as 24h `HH:mm`.
 */
export default function ClockTimePicker({ hours, onSave, onClose }: ClockTimePickerProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('open');
  const [open, setOpen] = useState(hours.open || '08:00');
  const [close, setClose] = useState(hours.close || '22:00');
  const dialRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const activeTime = tab === 'open' ? open : close;
  const activeMeridiem: Meridiem = tab === 'open' ? 'AM' : 'PM';
  const handAngle = clockTimeToAngle(activeTime);

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

  const setActive = (next: string) => {
    if (tab === 'open') setOpen(next);
    else setClose(next);
  };

  const nudge = (delta: number) =>
    setActive(fromHalfDayMinutes(halfDayMinutes(activeTime) + delta, activeMeridiem));

  const angleFromPointer = (event: React.PointerEvent): number => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(event.clientX - cx, cy - event.clientY) * 180) / Math.PI;
  };

  const updateFromPointer = (event: React.PointerEvent) => {
    setActive(angleToClockTime(angleFromPointer(event), activeMeridiem));
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
          <button type="button" className="clock-close" onClick={onClose} aria-label={t.addDish.hoursCancel}>
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
            {t.addDish.hoursTabOpen} <span>AM</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'close'}
            className={`clock-tab ${tab === 'close' ? 'active' : ''}`}
            onClick={() => setTab('close')}
          >
            {t.addDish.hoursTabClose} <span>PM</span>
          </button>
        </div>

        <div
          className="clock-dial"
          tabIndex={0}
          role="slider"
          aria-label={tab === 'open' ? t.addDish.hoursTabOpen : t.addDish.hoursTabClose}
          aria-valuetext={formatTimeAmPm(activeTime)}
          aria-valuemin={0}
          aria-valuemax={719}
          aria-valuenow={halfDayMinutes(activeTime)}
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
            <circle cx={CENTER} cy={CENTER} r={CENTER - 2} className="dial-face" />
            <circle cx={CENTER} cy={CENTER} r={CENTER - 12} className="dial-ring" />
            {NUMBERS.map((number) => {
              const angle = (number % 12) * 30;
              const rad = (angle * Math.PI) / 180;
              const x = CENTER + NUMBER_RADIUS * Math.sin(rad);
              const y = CENTER - NUMBER_RADIUS * Math.cos(rad);
              return (
                <text key={number} x={x} y={y} className={`dial-number ${number === 12 ? 'top' : ''}`}>
                  {number}
                </text>
              );
            })}
            <line
              x1={CENTER}
              y1={CENTER}
              x2={CENTER + HAND_RADIUS * Math.sin((handAngle * Math.PI) / 180)}
              y2={CENTER - HAND_RADIUS * Math.cos((handAngle * Math.PI) / 180)}
              className="dial-hand"
            />
            <circle
              cx={CENTER + HAND_RADIUS * Math.sin((handAngle * Math.PI) / 180)}
              cy={CENTER - HAND_RADIUS * Math.cos((handAngle * Math.PI) / 180)}
              r={5}
              className="dial-knob"
            />
            <circle cx={CENTER} cy={CENTER} r={7} className="dial-hub" />
          </svg>
        </div>

        <div className="clock-preview">
          <strong>{formatTimeAmPm(activeTime)}</strong>
          <span>{t.addDish.hoursHint}</span>
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
            <button type="button" className="clock-done" onClick={() => onSave({ open, close })}>
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
          margin-bottom: 12px;
        }
        .clock-tab {
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border: none;
          border-radius: var(--r-full);
          background: transparent;
          color: var(--text-soft);
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .clock-tab span {
          font-size: 10px;
          font-weight: 800;
          opacity: 0.7;
        }
        .clock-tab.active {
          background: var(--grad-primary);
          color: var(--primary-contrast);
          box-shadow: var(--shadow-primary);
        }
        .clock-tab.active span {
          opacity: 0.9;
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
        }
        .dial-ring {
          fill: none;
          stroke: var(--border);
          stroke-width: 1;
          stroke-dasharray: 2 6;
        }
        .dial-number {
          fill: var(--text-soft);
          font-size: 12px;
          font-weight: 700;
          text-anchor: middle;
          dominant-baseline: central;
          pointer-events: none;
        }
        .dial-number.top {
          fill: var(--primary-strong);
        }
        .dial-hand {
          stroke: var(--primary);
          stroke-width: 4;
          stroke-linecap: round;
          pointer-events: none;
        }
        .dial-knob {
          fill: var(--primary);
          stroke: #fff;
          stroke-width: 2;
          pointer-events: none;
        }
        .dial-hub {
          fill: var(--primary-strong);
          stroke: #fff;
          stroke-width: 2;
          pointer-events: none;
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
