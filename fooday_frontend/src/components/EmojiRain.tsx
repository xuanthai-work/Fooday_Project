'use client';

import React, { useSyncExternalStore } from 'react';
import type { RainBurst } from '@/hooks/useEmojiRain';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || !window.matchMedia) return null;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

function subscribeReducedMotion(callback: () => void): () => void {
  const query = reducedMotionQuery();
  if (!query) return () => {};
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function getReducedMotion(): boolean {
  return reducedMotionQuery()?.matches ?? false;
}

/**
 * A Messenger-style emoji rain layer.
 *
 * `chat` renders inside the chat area (absolute) and fades out halfway down;
 * `full` covers the whole viewport for the random-pick celebration.
 */
export default function EmojiRain({ bursts }: { bursts: RainBurst[] }) {
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );

  if (reduced || bursts.length === 0) return null;

  return (
    <>
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className={`rain-layer is-${burst.intensity}`}
          aria-hidden="true"
        >
          {burst.particles.map((particle) => (
            <span
              key={particle.id}
              className="rain-sway"
              style={{
                left: `${particle.x}%`,
                animationDuration: `${particle.dur}s`,
                animationDelay: `${particle.delay}s`,
              }}
            >
              <span
                className="rain-drop"
                style={{
                  fontSize: `${particle.size}px`,
                  '--drift': `${particle.drift}px`,
                  '--rot': `${particle.rot}deg`,
                  '--op': `${particle.opacity}`,
                  animationDuration: `${particle.dur}s`,
                  animationDelay: `${particle.delay}s`,
                } as React.CSSProperties}
              >
                {particle.char}
              </span>
            </span>
          ))}
        </div>
      ))}

      <style jsx>{`
        .rain-layer {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 4;
        }
        .rain-layer.is-full {
          position: fixed;
          z-index: 60;
        }
        .rain-sway {
          position: absolute;
          top: 0;
          display: block;
          animation-name: rainSway;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        .rain-drop {
          display: block;
          line-height: 1;
          transform-origin: 50% 50%;
          animation-name: rainFallChat;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }
        .is-full .rain-drop {
          animation-name: rainFall;
        }
        .is-mini .rain-drop {
          animation-name: rainFallMini;
        }
        @keyframes rainFall {
          0% {
            transform: translate3d(0, -8vh, 0) rotate(0deg) scale(0.4);
            opacity: 0;
          }
          8% {
            transform: translate3d(0, -3vh, 0) rotate(calc(var(--rot) * 0.3)) scale(1.12);
            opacity: var(--op);
          }
          70% {
            opacity: var(--op);
          }
          100% {
            transform: translate3d(var(--drift), 108vh, 0) rotate(var(--rot)) scale(0.85);
            opacity: 0;
          }
        }
        @keyframes rainFallChat {
          0% {
            transform: translate3d(0, -6vh, 0) rotate(0deg) scale(0.4);
            opacity: 0;
          }
          10% {
            transform: translate3d(0, -2vh, 0) rotate(calc(var(--rot) * 0.3)) scale(1.1);
            opacity: var(--op);
          }
          45% {
            opacity: var(--op);
          }
          100% {
            transform: translate3d(var(--drift), 42vh, 0) rotate(var(--rot)) scale(0.9);
            opacity: 0;
          }
        }
        @keyframes rainFallMini {
          0% {
            transform: translate3d(0, -5vh, 0) rotate(0deg) scale(0.4);
            opacity: 0;
          }
          12% {
            transform: translate3d(0, -1vh, 0) rotate(calc(var(--rot) * 0.3)) scale(1.05);
            opacity: var(--op);
          }
          40% {
            opacity: var(--op);
          }
          100% {
            transform: translate3d(var(--drift), 24vh, 0) rotate(var(--rot)) scale(0.9);
            opacity: 0;
          }
        }
        @keyframes rainSway {
          0% {
            transform: translateX(-6px);
          }
          50% {
            transform: translateX(6px);
          }
          100% {
            transform: translateX(-6px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .rain-layer {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
