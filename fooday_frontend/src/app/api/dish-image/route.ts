import { NextRequest, NextResponse } from 'next/server';

function getBackendDishImageUrl(q: string): string {
  const raw =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:2001/api/v1';
  const clean = raw.replace(/\/+$/, '');
  const base = clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  return `${base}/dish-image?q=${encodeURIComponent(q)}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    if (!q) {
      return NextResponse.json({ images: [] });
    }

    const secret = process.env.INTERNAL_API_SECRET;
    const headers: Record<string, string> = {};
    if (secret) {
      headers['x-internal-secret'] = secret;
    }

    const res = await fetch(getBackendDishImageUrl(q), { headers });
    const data = await res.json().catch(() => ({ images: [] }));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[BFF /api/dish-image error]:', error);
    return NextResponse.json({ images: [] }, { status: 502 });
  }
}
