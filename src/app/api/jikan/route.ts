import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const limit = searchParams.get('limit') || '6';
  
  if (!q) {
    return NextResponse.json({ data: [] });
  }

  try {
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=${limit}&sfw=true`;
    
    // Throttle helper to respect Jikan's rate limits
    // We can't easily throttle across different users here without a global state, 
    // but moving to server-side already helps with some browser-specific fetch issues.
    const response = await fetch(url, {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }
      return NextResponse.json({ error: 'Failed to fetch from Jikan' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Jikan Proxy Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
