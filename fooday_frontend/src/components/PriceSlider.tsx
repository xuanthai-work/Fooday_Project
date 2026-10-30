'use client';

import React, { useRef } from 'react';

interface PriceSliderProps {
  /** Current value in VND. */
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  ariaValueText?: string;
}

/**
 * A custom price slider. The native `<input type="range">` puts half the thumb
 * outside the track on mobile browsers and centres it differently across
 * engines, so the thumb is positioned by hand — always inside the band.
 */
export default function PriceSlider({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
  ariaValueText,
}: PriceSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const clamped = Math.min(max, Math.max(min, value));
  const ratio = max === min ? 0 : (clamped - min) / (max - min);

  const updateFromX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const nextRatio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = min + nextRatio * (max - min);
    const stepped = Math.round(raw / step) * step;
    onChange(Math.min(max, Math.max(min, stepped)));
  };

  const onPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    draggingRef.current = true;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    updateFromX(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateFromX(event.clientX);
  };

  const stopDragging = (event: React.PointerEvent) => {
    draggingRef.current = false;
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(Math.min(max, clamped + step));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(Math.max(min, clamped - step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      onChange(min);
    } else if (event.key === 'End') {
      event.preventDefault();
      onChange(max);
    }
  };

  return (
    <div
      className="price-slider"
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={ariaValueText}
      aria-orientation="horizontal"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onKeyDown={onKeyDown}
    >
      <div className="price-slider-track" ref={trackRef} />
      <div
        className="price-slider-thumb"
        style={{ left: `calc(${ratio * 100}% + ${11 - ratio * 22}px)` }}
      />

      <style jsx>{`
        .price-slider {
          position: relative;
          height: 30px;
          margin: 2px 0 2px;
          cursor: pointer;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          outline: none;
        }
        .price-slider:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 4px;
          border-radius: var(--r-full);
        }
        /* The band: light orange on the left, deep orange on the right. */
        .price-slider-track {
          position: absolute;
          left: 11px;
          right: 11px;
          top: 50%;
          height: 8px;
          transform: translateY(-50%);
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            #ffc79e 0%,
            #ff9a5c 32%,
            #ff6b35 62%,
            #c2410c 84%,
            #8f2d05 100%
          );
        }
        .price-slider-thumb {
          position: absolute;
          top: 50%;
          width: 22px;
          height: 22px;
          box-sizing: border-box;
          border-radius: 50%;
          border: 3px solid var(--primary);
          background: #fff;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
