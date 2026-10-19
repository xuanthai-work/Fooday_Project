'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatView from '@/components/ChatView';

function ChatRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('q') ?? '';

  return (
    <ChatView
      initialMessageToSend={initialMessage}
      onClearInitialMessage={() => router.replace('/chat')}
    />
  );
}

export default function ChatPage() {
  // useSearchParams() must sit under a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <ChatRoute />
    </Suspense>
  );
}
