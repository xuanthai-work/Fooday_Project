'use client';

import React, { useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';

type Theme = 'light' | 'dark';
const THEME_EVENT = 'fooday-theme-change';

function getSnapshot(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    mq.removeEventListener('change', callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

interface ThemeToggleProps {
  /** 'plain' = bare icon button (light surfaces); 'onPrimary' = for the lavender banner */
  variant?: 'plain' | 'onPrimary';
}

export default function ThemeToggle({ variant = 'plain' }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'light' as Theme);
  const isDark = theme === 'dark';

  const toggle = () => {
    const next: Theme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('fooday-theme', next);
    } catch {
      /* storage may be unavailable */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button
      onClick={toggle}
      className={`theme-toggle ${variant}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className="icon-stack" data-dark={isDark}>
        <Sun size={19} className="icon sun" />
        <Moon size={19} className="icon moon" />
      </span>

      <style jsx>{`
        .theme-toggle {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: var(--r-full);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-soft);
          cursor: pointer;
          transition: background-color var(--dur-fast) var(--ease),
            color var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease),
            border-color var(--dur-fast) var(--ease);
        }
        .theme-toggle.onPrimary {
          background: rgba(255, 255, 255, 0.16);
          border-color: rgba(255, 255, 255, 0.28);
          color: #ffffff;
        }
        .theme-toggle:hover {
          transform: translateY(-2px);
          color: var(--primary-strong);
          border-color: var(--primary);
        }
        .theme-toggle.onPrimary:hover {
          background: rgba(255, 255, 255, 0.26);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.5);
        }
        .theme-toggle:active {
          transform: scale(0.94);
        }
        .icon-stack {
          position: relative;
          width: 19px;
          height: 19px;
        }
        .icon {
          position: absolute;
          inset: 0;
          transition: transform var(--dur) var(--ease), opacity var(--dur) var(--ease);
        }
        .sun {
          transform: rotate(0deg) scale(1);
          opacity: 1;
        }
        .moon {
          transform: rotate(-90deg) scale(0.4);
          opacity: 0;
        }
        .icon-stack[data-dark='true'] .sun {
          transform: rotate(90deg) scale(0.4);
          opacity: 0;
        }
        .icon-stack[data-dark='true'] .moon {
          transform: rotate(0deg) scale(1);
          opacity: 1;
        }
      `}</style>
    </button>
  );
}
