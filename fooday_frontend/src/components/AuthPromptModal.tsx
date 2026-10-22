'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n/LanguageContext';

interface AuthPromptModalProps {
  /** Whether the prompt is visible. */
  open: boolean;
  /** Close the prompt without leaving guest mode. */
  onClose: () => void;
}

/**
 * Prompt shown when a guest (anonymous session) tries to favourite a dish.
 * The primary action drops the anonymous session, which sends the user back
 * to the auth screen where they can sign in or create an account.
 */
export default function AuthPromptModal({ open, onClose }: AuthPromptModalProps) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Portals need the DOM, so wait for the client mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-mount flag (SSR-safe)
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const handleSignIn = async () => {
    // Close first, then drop the anonymous session: that unmounts the app
    // shell and reveals the auth screen (sign in / sign up).
    onClose();
    await signOut();
  };

  return createPortal(
    <div className="prompt-backdrop" onClick={onClose}>
      <div
        className="prompt-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="prompt-heart" aria-hidden="true">
          <Heart size={30} fill="var(--heart)" color="var(--heart)" />
          <span className="prompt-spark prompt-spark-a">
            <Sparkles size={14} />
          </span>
          <span className="prompt-spark prompt-spark-b">
            <Sparkles size={12} />
          </span>
        </div>

        <h2 className="prompt-title" id="auth-prompt-title">
          {t.authPromptModal.title}
        </h2>
        <p className="prompt-desc">{t.authPromptModal.description}</p>

        <div className="prompt-actions">
          <button type="button" className="prompt-cta" onClick={handleSignIn}>
            {t.authPromptModal.signIn}
          </button>
          <button type="button" className="prompt-later" onClick={onClose}>
            {t.authPromptModal.later}
          </button>
        </div>

        <style jsx>{`
          .prompt-backdrop {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100dvh;
            z-index: 200;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(20, 14, 10, 0.58);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            animation: promptFade 0.2s ease both;
          }
          .prompt-card {
            width: 100%;
            max-width: 380px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 12px;
            padding: 28px 24px 22px;
            border-radius: var(--r-xl);
            background: var(--surface);
            border: 1px solid var(--border);
            box-shadow: var(--shadow-lg);
            animation: promptZoom 0.26s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .prompt-heart {
            position: relative;
            display: grid;
            place-items: center;
            width: 72px;
            height: 72px;
            border-radius: var(--r-full);
            background: var(--grad-primary-soft);
            border: 1px solid var(--primary-soft-2);
            box-shadow: 0 10px 26px rgba(232, 89, 36, 0.22);
            color: var(--heart);
            animation: promptBeat 0.5s var(--ease) both;
          }
          .prompt-spark {
            position: absolute;
            color: var(--primary);
            opacity: 0.9;
          }
          .prompt-spark-a {
            top: -4px;
            right: 2px;
            animation: promptFloat 2.4s ease-in-out infinite;
          }
          .prompt-spark-b {
            bottom: 2px;
            left: -2px;
            animation: promptFloat 2.4s ease-in-out infinite reverse;
          }
          .prompt-title {
            margin: 0;
            font-size: 1.1875rem;
            font-weight: 800;
            color: var(--text);
            line-height: 1.25;
          }
          .prompt-desc {
            margin: 0;
            font-size: 0.875rem;
            line-height: 1.55;
            color: var(--text-soft);
          }
          .prompt-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
            margin-top: 6px;
          }
          .prompt-cta {
            width: 100%;
            min-height: 46px;
            border: none;
            border-radius: var(--r-full);
            background: var(--grad-primary);
            color: var(--primary-contrast);
            font-size: 0.9375rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: var(--shadow-primary);
            transition: transform var(--dur-fast) var(--ease),
              box-shadow var(--dur-fast) var(--ease);
          }
          .prompt-cta:hover {
            transform: translateY(-2px);
            box-shadow: 0 16px 32px -8px rgba(232, 89, 36, 0.55);
          }
          .prompt-cta:active {
            transform: translateY(0);
          }
          .prompt-later {
            width: 100%;
            min-height: 42px;
            border: 1px solid var(--border-strong);
            border-radius: var(--r-full);
            background: var(--surface-2);
            color: var(--text-soft);
            font-size: 0.875rem;
            font-weight: 700;
            cursor: pointer;
            transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
          }
          .prompt-later:hover {
            background: var(--surface-3);
            color: var(--text);
          }
          @keyframes promptFade {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          @keyframes promptZoom {
            from {
              transform: scale(0.94) translateY(10px);
              opacity: 0;
            }
            to {
              transform: scale(1) translateY(0);
              opacity: 1;
            }
          }
          @keyframes promptBeat {
            0% {
              transform: scale(0.82);
            }
            60% {
              transform: scale(1.08);
            }
            100% {
              transform: scale(1);
            }
          }
          @keyframes promptFloat {
            0%,
            100% {
              transform: translateY(0) rotate(0deg);
            }
            50% {
              transform: translateY(-5px) rotate(12deg);
            }
          }
        `}</style>
      </div>
    </div>,
    document.body,
  );
}
