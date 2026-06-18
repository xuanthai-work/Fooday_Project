'use client';

import React, { useState } from 'react';
import { Home, Sparkles, User as UserIcon } from 'lucide-react';
import HomeView from '@/components/HomeView';
import ChatView from '@/components/ChatView';
import ProfileView from '@/components/ProfileView';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import AuthScreen from '@/components/AuthScreen';

type TabType = 'home' | 'chat' | 'profile';

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'chat', label: 'AI Chat', icon: Sparkles },
  { id: 'profile', label: 'Profile', icon: UserIcon },
];

function AppContent() {
  const { session, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [chatQuery, setChatQuery] = useState<string>('');

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

  const handleNavigateToChat = (query?: string) => {
    if (query) setChatQuery(query);
    setActiveTab('chat');
  };

  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  return (
    <main className="app-shell app-shell--app animate-fade-in">
      <div className="app-content" key={activeTab}>
        {activeTab === 'home' && <HomeView onNavigateToChat={handleNavigateToChat} />}
        {activeTab === 'chat' && (
          <ChatView
            initialMessageToSend={chatQuery}
            onClearInitialMessage={() => setChatQuery('')}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileView onNavigateToChat={handleNavigateToChat} />
        )}
      </div>

      {/* Navigation — bottom bar on mobile, left sidebar on desktop */}
      <nav className="bottom-nav glass" aria-label="Primary">
        <div className="nav-brand" aria-hidden="true">
          <span className="nav-brand-badge">
            <Sparkles size={18} />
          </span>
          <span className="nav-brand-text">Fooday</span>
        </div>
        <span
          className="nav-indicator"
          style={{ ['--i' as string]: activeIndex } as React.CSSProperties}
          aria-hidden="true"
        />
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`nav-item ${activeTab === id ? 'active' : ''}`}
            aria-current={activeTab === id ? 'page' : undefined}
          >
            <Icon size={22} strokeWidth={activeTab === id ? 2.4 : 2} />
            <span className="nav-label">{label}</span>
          </button>
        ))}

        <style jsx>{`
          .bottom-nav {
            position: relative;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            align-items: stretch;
            padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));
            border-top: 1px solid var(--border);
            box-shadow: var(--shadow-nav);
            z-index: 30;
          }
          .nav-brand {
            display: none;
          }
          .nav-indicator {
            position: absolute;
            top: 8px;
            left: 12px;
            width: calc((100% - 24px) / 3);
            height: 52px;
            border-radius: var(--r-md);
            background: var(--primary-soft);
            transform: translateX(calc(var(--i, 0) * 100%));
            transition: transform var(--dur) var(--ease);
            z-index: 0;
          }
          .nav-item {
            position: relative;
            z-index: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            height: 52px;
            background: none;
            border: none;
            outline: none;
            color: var(--text-faint);
            cursor: pointer;
            border-radius: var(--r-md);
            transition: color var(--dur-fast) var(--ease);
          }
          .nav-item :global(svg) {
            transition: transform var(--dur) var(--ease);
          }
          .nav-item:hover {
            color: var(--text-soft);
          }
          .nav-item:hover :global(svg) {
            transform: translateY(-2px);
          }
          .nav-item.active {
            color: var(--primary-strong);
          }
          .nav-item.active :global(svg) {
            transform: translateY(-1px);
          }
          .nav-label {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.01em;
          }
        `}</style>
      </nav>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
