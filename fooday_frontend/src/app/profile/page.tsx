'use client';

import ProfileView from '@/components/ProfileView';
import { useAppNav } from '@/components/AppShell';

export default function ProfilePage() {
  const { navigateToChat } = useAppNav();
  return <ProfileView onNavigateToChat={navigateToChat} />;
}
