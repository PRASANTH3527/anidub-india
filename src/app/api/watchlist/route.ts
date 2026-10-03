import { NextRequest, NextResponse } from 'next/server';

/**
 * Route: POST /api/watchlist
 * Handles watchlist additions/removals and acts as the sync target for PWA Background Sync.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId = 'guest', animeId, action = 'add' } = body;

    if (!animeId) {
      return NextResponse.json(
        { error: 'Missing animeId', success: false },
        { status: 400 }
      );
    }

    // In a production backend, persist to Firestore / Database here.
    return NextResponse.json({
      success: true,
      action,
      animeId,
      userId,
      syncedAt: new Date().toISOString(),
      message: `Watchlist item ${action}ed successfully.`
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process watchlist action', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'online',
    service: 'AniDub Watchlist Sync Service',
    time: new Date().toISOString()
  });
}
