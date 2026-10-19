'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Sparkles, User as UserIcon, Plus, Dices } from 'lucide-react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { FavoritesProvider } from '@/hooks/useFavorites';
import AuthScreen from '@/components/AuthScreen';
import AddDishModal from '@/components/AddDishModal';
import { LanguageProvider, useTranslation } from '@/i18n/LanguageContext';
import type { Translation } from '@/i18n/translations';

type TabType = 'home' | 'chat' | 'random' | 'profile';

const TABS: {
  id: TabType;
  labelKey: keyof Translation['nav'];
  href: string;
  icon: React.ElementType;
}[] = [
  { id: 'home', labelKey: 'home', href: '/', icon: Home },
  { id: 'chat', labelKey: 'chat', href: '/chat', icon: Sparkles },
  { id: 'random', labelKey: 'random', href: '/random', icon: Dices },
  { id: 'profile', labelKey: 'profile', href: '/profile', icon: UserIcon },
];

interface AppNav {
  navigateToChat: (query?: string) => void;
}

const AppNavContext = createContext<AppNav>({ navigateToChat: () => {} });

/** Navigate to the chat route, optionally prefilling the first message. */
export const useAppNav = () => useContext(AppNavContext);

function tabFromPathname(pathname: string): TabType {
  if (pathname === '/' || pathname === '') return 'home';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/random')) return 'random';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'home';
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { session, loading, user } = useAuth();
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const activeTab = tabFromPathname(pathname);

  const navigateToChat = useCallback(
    (query?: string) => {
      router.push(query ? `/chat?q=${encodeURIComponent(query)}` : '/chat');
    },
    [router],
  );

  const navValue = useMemo(() => ({ navigateToChat }), [navigateToChat]);

  if (loading) {
    return (
      <main className="auth-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="splash-logo animate-pulse">
          <Sparkles size={36} color="var(--primary-contrast)" />
        </div>
        <style jsx>{`
          .splash-logo {
            width: 80px;
            height: 80px;
            border-radius: var(--r-xl);
            background: var(--grad-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: var(--shadow-primary);
            animation: pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          @keyframes pulseRing {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(0.95); opacity: 0.8; }
          }
        `}</style>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <AuthScreen />
      </main>
    );
  }

  const isGuest = user?.is_anonymous ?? true;
  const handleAddClick = () => {
    if (isGuest) {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 2600);
      return;
    }
    setShowAdd(true);
  };

  return (
    <AppNavContext.Provider value={navValue}>
      <main className="app-shell app-shell--app animate-fade-in">
        <div className="app-content">{children}</div>

        {/* Navigation — bottom bar (center + FAB) on mobile, left sidebar on desktop */}
        <nav className="bottom-nav glass" aria-label="Primary">
          <div className="nav-brand" aria-hidden="true">
            <span className="nav-brand-badge">
              <Sparkles size={18} />
            </span>
            <span className="nav-brand-text">Fooday</span>
          </div>

          <div className="nav-cluster">
            {TABS.slice(0, 2).map(({ id, labelKey, href, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <Link
                  key={id}
                  href={href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                  <span className="nav-label">{t.nav[labelKey]}</span>
                </Link>
              );
            })}
          </div>

          <button
            className="nav-fab"
            onClick={handleAddClick}
            aria-label={t.nav.addDish}
            title={isGuest ? t.nav.addDishGuestTooltip : t.nav.addDishTooltip}
          >
            <Plus size={26} strokeWidth={2.4} />
            <span className="nav-fab-label">{t.nav.addDish}</span>
          </button>

          <div className="nav-cluster">
            {TABS.slice(2).map(({ id, labelKey, href, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <Link
                  key={id}
                  href={href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                  <span className="nav-label">{t.nav[labelKey]}</span>
                </Link>
              );
            })}
          </div>

          {showHint && <span className="nav-hint">{t.nav.guestHint}</span>}

          <style jsx>{`
            .bottom-nav {
              position: relative;
              display: flex;
              align-items: center;
              padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px));
              border-top: 1px solid var(--border);
              box-shadow: var(--shadow-nav);
              z-index: 30;
            }
            .nav-brand {
              display: none;
            }
            .nav-cluster {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: space-around;
            }
            /* next/link renders its own intrinsic <a>, so styled-jsx can't attach
               its scope class to it — these must be :global() to apply. */
            :global(.nav-item) {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              gap: 3px !important;
              height: 52px !important;
              padding: 0 8px !important;
              text-decoration: none !important;
              color: var(--text-faint);
              cursor: pointer;
              border-radius: var(--r-md);
              transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
            }
            :global(.nav-item svg) {
              flex-shrink: 0;
              transition: transform var(--dur) var(--ease);
            }
            :global(.nav-item:hover) {
              color: var(--text-soft);
            }
            :global(.nav-item:hover svg) {
              transform: translateY(-2px);
            }
            :global(.nav-item.active) {
              color: var(--primary-strong) !important;
              background: var(--primary-soft) !important;
            }
            .nav-fab {
              flex: 0 0 auto;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 52px;
              height: 52px;
              margin: 0 6px;
              border-radius: var(--r-full);
              border: none;
              background: var(--grad-primary);
              color: #fff;
              cursor: pointer;
              box-shadow: var(--shadow-primary);
              transition: transform var(--dur-fast) var(--ease);
            }
            .nav-fab:hover {
              transform: scale(1.06);
            }
            .nav-fab:active {
              transform: scale(0.94);
            }
            .nav-fab-label {
              display: none;
            }
            :global(.nav-label) {
              display: block !important;
              font-size: 11px !important;
              font-weight: 600 !important;
              letter-spacing: 0.01em;
              line-height: 1 !important;
              text-decoration: none !important;
              text-align: center;
            }
            .nav-hint {
              position: absolute;
              bottom: calc(100% + 8px);
              left: 50%;
              transform: translateX(-50%);
              white-space: nowrap;
              padding: 8px 14px;
              border-radius: var(--r-full);
              background: var(--text);
              color: var(--bg);
              font-size: 12.5px;
              font-weight: 600;
              box-shadow: var(--shadow-md);
              animation: fadeInUp 0.25s var(--ease-out) both;
              z-index: 40;
            }
          `}</style>
        </nav>

        {showAdd && <AddDishModal onClose={() => setShowAdd(false)} />}
      </main>
    </AppNavContext.Provider>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <FavoritesProvider>
          <ShellInner>{children}</ShellInner>
        </FavoritesProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
