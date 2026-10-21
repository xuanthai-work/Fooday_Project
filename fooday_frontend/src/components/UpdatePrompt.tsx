'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

/** Commit SHA baked into the client bundle at build time. */
const CURRENT = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

/** How often the client asks the server whether a newer build exists. */
const CHECK_INTERVAL = 60_000;

export default function UpdatePrompt() {
  const { t } = useTranslation();
  const [stale, setStale] = useState(false);

  useEffect(() => {
    // Local development has no deployed version to compare against.
    if (CURRENT === 'dev') return;

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.version && data.version !== 'dev' && data.version !== CURRENT) {
          setStale(true);
        }
      } catch {
        // Offline or server hiccup — keep the current build running.
      }
    };

    check();
    const timer = window.setInterval(check, CHECK_INTERVAL);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  if (!stale) return null;

  const reload = () => {
    window.location.reload();
  };

  return (
    <div className="update-prompt" role="status" aria-live="polite">
      <span className="update-text">{t.update.available}</span>

      <button type="button" className="update-action" onClick={reload}>
        <RefreshCw size={15} strokeWidth={2.4} className="update-icon" />
        <span>{t.update.action}</span>
      </button>

      <style jsx>{`
        .update-prompt {
          position: fixed;
          left: 0;
          right: 0;
          bottom: calc(78px + env(safe-area-inset-bottom, 0px));
          margin: 0 auto;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 12px;
          width: calc(100vw - 24px);
          max-width: 520px;
          padding: 10px 10px 10px 16px;
          border-radius: var(--r-lg);
          border: 1px solid var(--border-strong);
          background: var(--glass-strong);
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          box-shadow: var(--shadow-lg);
          animation: fadeInUp var(--dur) var(--ease-out) both;
        }
        .update-text {
          flex: 1;
          min-width: 0;
          font-size: 13.5px;
          font-weight: 600;
          line-height: 1.35;
          color: var(--text);
        }
        .update-action {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 15px;
          border: none;
          border-radius: var(--r-full);
          background: var(--grad-primary);
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          box-shadow: var(--shadow-primary);
          transition: transform var(--dur-fast) var(--ease),
            box-shadow var(--dur-fast) var(--ease);
        }
        .update-action:hover {
          transform: translateY(-1px) scale(1.03);
          box-shadow: 0 14px 30px -8px rgba(232, 89, 36, 0.5);
        }
        .update-action:active {
          transform: scale(0.95);
        }
        .update-icon {
          transition: transform var(--dur) var(--ease);
        }
        .update-action:hover .update-icon {
          transform: rotate(180deg);
        }
        @media (min-width: 1024px) {
          .update-prompt {
            left: auto;
            right: 24px;
            bottom: 24px;
            margin: 0;
            width: auto;
            max-width: 420px;
          }
        }
      `}</style>
    </div>
  );
}
