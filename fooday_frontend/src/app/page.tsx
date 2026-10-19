'use client';

import HomeView from '@/components/HomeView';
import { useAppNav } from '@/components/AppShell';

export default function HomePage() {
  const { navigateToChat } = useAppNav();
  return <HomeView onNavigateToChat={navigateToChat} />;
}
