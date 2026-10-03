import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Custom Analytics Tracker Middleware
 * 
 * Intercepts specific routes (/search and /anime) to track user intent and behavior
 * in a non-blocking, ultra-fast background process.
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Identify if the current path should be tracked
  const isSearch = pathname === '/search';
  const isAnime = pathname.startsWith('/anime');

  if (isSearch || isAnime) {
    // 2. Extract useful data from the request
    // Edge middleware has access to headers, URL, and search params
    const analyticsData = {
      timestamp: new Date().toISOString(),
      eventType: isSearch ? 'SEARCH' : 'ANIME_VIEW',
      pathname,
      // Extract all search parameters (e.g., ?q=naruto)
      queryParams: Object.fromEntries(searchParams.entries()),
      // Specifically capture the query if it's a search
      searchTerm: searchParams.get('q') || searchParams.get('query') || null,
      // User context
      ip: request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      referrer: request.headers.get('referer') || 'direct',
    };

    // 3. Structured background logging
    // console.log in Edge Middleware is handled asynchronously by the platform,
    // ensuring it doesn't delay the response to the user.
    // This structured data is ready to be ingested by a database like Firebase or Supabase.
    console.info(`[Analytics Tracker] ${analyticsData.eventType}:`, JSON.stringify(analyticsData, null, 2));
    
    // Note: In a production environment with a DB, you would use:
    // event.waitUntil(sendToDatabase(analyticsData));
  }

  // 4. Proceed with the request immediately to ensure zero delay
  return NextResponse.next();
}

/**
 * Middleware Configuration
 * 
 * We use a matcher to ensure this code ONLY runs for the specific routes we care about.
 * This keeps the middleware "ultra-fast" by bypassing it for static assets, images, etc.
 */
export const config = {
  matcher: [
    '/search',
    '/anime/:path*',
  ],
};
