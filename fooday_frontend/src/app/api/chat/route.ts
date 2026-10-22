import { NextRequest, NextResponse } from 'next/server';

function getBackendChatUrl(): string {
  const raw =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:2001/api/v1';
  const clean = raw.replace(/\/+$/, '');
  return clean.endsWith('/api/v1') ? `${clean}/chat` : `${clean}/api/v1/chat`;
}

export async function POST(req: NextRequest) {
  try {
    // The whole payload is forwarded untouched: the backend owns the shape of
    // the request (message, favorites, conversation history, GPS position).
    const body = await req.json();
    const targetUrl = getBackendChatUrl();
    const secret = process.env.INTERNAL_API_SECRET;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (secret) {
      headers['x-internal-secret'] = secret;
    }

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[BFF /api/chat error]:', error);
    return NextResponse.json(
      {
        reply: 'Không thể kết nối đến máy chủ AI lúc này.',
        fallback: 'error',
        suggested_dishes: [],
        suggested_cards: [],
      },
      { status: 502 },
    );
  }
}
