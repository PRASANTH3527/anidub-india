/**
 * Cloudflare Pages Function: /api/[[route]]
 * Native Edge Router for all API routes on Cloudflare Pages.
 * Delegates feature endpoints to modular handlers in src/server/routes/*.
 */

import { getAuth } from '../../src/utils/auth';
import { ChatRoom } from '../../src/chat-room';
import {
  type CloudflareEnv,
  type CloudflareEnvInput,
  type D1DatabaseLike,
  type PagesFunction,
  type RouteContext,
  createJsonResponder,
} from '../../src/server/routes/shared';
import { handleAdminRoutes } from '../../src/server/routes/adminRoutes';
import { handleCommunityRoutes } from '../../src/server/routes/communityRoutes';
import { handleUserRoutes } from '../../src/server/routes/userRoutes';
import { handleAnimeRoutes } from '../../src/server/routes/animeRoutes';
import { handleAnalyticsRoutes } from '../../src/server/routes/analyticsRoutes';

export { ChatRoom };

const ROUTE_HANDLERS = [
  handleAdminRoutes,
  handleCommunityRoutes,
  handleUserRoutes,
  handleAnimeRoutes,
  handleAnalyticsRoutes,
];

export const onRequest: PagesFunction<CloudflareEnvInput> = async (context) => {
  const { request } = context;
  const env: CloudflareEnv = {
    ...context.env,
    DB: (context.env?.DB ?? null) as D1DatabaseLike | null,
  };
  const jsonResponse = createJsonResponder(request, env);
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') {
    return jsonResponse({ ok: true }, 200, request);
  }

  // GET /api/config & /api/auth-config (Public runtime Clerk Publishable Key & safe session status)
  if ((path === '/api/config' || path === '/api/auth-config') && method === 'GET') {
    const clerkPublishableKey = String(
      env?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
        env?.VITE_CLERK_PUBLISHABLE_KEY ||
        ''
    ).trim();
    const session = await getAuth(request, env);
    return jsonResponse(
      {
        clerkPublishableKey,
        authenticated: session.authenticated,
        isAdmin: session.isAdmin,
        userId: session.userId,
      },
      200,
      request,
      { 'Cache-Control': 'no-store' }
    );
  }

  const routeContext: RouteContext = {
    request,
    env,
    url,
    path,
    method,
    jsonResponse,
  };

  for (const handler of ROUTE_HANDLERS) {
    const response = await handler(routeContext);
    if (response) {
      return response;
    }
  }

  return jsonResponse({ error: `Route ${path} not found` }, 404);
};
