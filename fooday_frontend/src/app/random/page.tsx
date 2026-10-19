'use client';

import RandomView from '@/components/RandomView';
import { useAppNav } from '@/components/AppShell';

export default function RandomPage() {
  const { navigateToChat } = useAppNav();
  return <RandomView onNavigateToChat={navigateToChat} />;
}
