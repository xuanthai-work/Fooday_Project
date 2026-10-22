import { NextRequest, NextResponse } from 'next/server';

function getBackendParseMapUrl(url: string): string {
  const raw =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:2001/api/v1';
  const clean = raw.replace(/\/+$/, '');
  const base = clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  return `${base}/parse-map-link?url=${encodeURIComponent(url)}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url') || '';
    if (!url) {
      return NextResponse.json({
        restaurant_name: null,
        address: null,
        resolved_url: null,
        place_id: null,
      });
    }

    const secret = process.env.INTERNAL_API_SECRET;
    const headers: Record<string, string> = {};
    if (secret) {
      headers['x-internal-secret'] = secret;
    }

    const res = await fetch(getBackendParseMapUrl(url), { headers });
    const data = await res.json().catch(() => ({
      restaurant_name: null,
      address: null,
      resolved_url: null,
      place_id: null,
    }));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[BFF /api/parse-map-link error]:', error);
    return NextResponse.json(
      { restaurant_name: null, address: null, resolved_url: null, place_id: null },
      { status: 502 },
    );
  }
}
