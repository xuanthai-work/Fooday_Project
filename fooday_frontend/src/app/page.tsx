'use client';

import { Suspense } from 'react';
import HomeView from '@/components/HomeView';
import { useAppNav } from '@/components/AppShell';

export default function HomePage() {
  const { navigateToChat } = useAppNav();
  return (
    <Suspense fallback={null}>
      <HomeView onNavigateToChat={navigateToChat} />
    </Suspense>
  );
}
