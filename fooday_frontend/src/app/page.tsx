'use client';

import React, { useState } from 'react';
import { Home, Sparkles, User as UserIcon, Plus, Dices } from 'lucide-react';
import HomeView from '@/components/HomeView';
import ChatView from '@/components/ChatView';
import ProfileView from '@/components/ProfileView';
import RandomView from '@/components/RandomView';
import AddDishModal from '@/components/AddDishModal';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import AuthScreen from '@/components/AuthScreen';

type TabType = 'home' | 'chat' | 'random' | 'profile';

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'chat', label: 'AI Chat', icon: Sparkles },
  { id: 'random', label: 'Random', icon: Dices },
  { id: 'profile', label: 'Profile', icon: UserIcon },
];

function AppContent() {
  const { session, loading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [chatQuery, setChatQuery] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [showHint, setShowHint] = useState(false);

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
    <main className="app-shell app-shell--app animate-fade-in">
      <div className="app-content" key={activeTab}>
        {activeTab === 'home' && <HomeView onNavigateToChat={handleNavigateToChat} />}
        {activeTab === 'chat' && (
          <ChatView
            initialMessageToSend={chatQuery}
            onClearInitialMessage={() => setChatQuery('')}
          />
        )}
        {activeTab === 'random' && <RandomView onNavigateToChat={handleNavigateToChat} />}
        {activeTab === 'profile' && (
          <ProfileView
            onNavigateToChat={handleNavigateToChat}
            onNavigate={setActiveTab}
            onAddDish={handleAddClick}
          />
        )}
      </div>

      {/* Navigation — bottom bar (center + FAB) on mobile, left sidebar on desktop */}
      <nav className="bottom-nav glass" aria-label="Primary">
        <div className="nav-brand" aria-hidden="true">
          <span className="nav-brand-badge">
            <Sparkles size={18} />
          </span>
          <span className="nav-brand-text">Fooday</span>
        </div>

        <div className="nav-cluster">
          {TABS.slice(0, 2).map(({ id, label, icon: Icon }) => (
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
        </div>

        <button
          className="nav-fab"
          onClick={handleAddClick}
          aria-label="Add dish"
          title={isGuest ? 'Sign up to add dishes' : 'Add a dish'}
        >
          <Plus size={26} strokeWidth={2.4} />
          <span className="nav-fab-label">Add dish</span>
        </button>

        <div className="nav-cluster">
          {TABS.slice(2).map(({ id, label, icon: Icon }) => (
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
        </div>

        {showHint && <span className="nav-hint">Sign up to add dishes ✨</span>}

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
          .nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            height: 52px;
            padding: 0 8px;
            background: none;
            border: none;
            outline: none;
            color: var(--text-faint);
            cursor: pointer;
            border-radius: var(--r-md);
            transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
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
            background: var(--primary-soft);
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
          .nav-label {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.01em;
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
