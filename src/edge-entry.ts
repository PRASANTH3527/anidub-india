import { onRequest } from '../functions/api/[[route]]';

interface EdgeEnv {
  DB: any;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  [key: string]: any;
}

/**
 * Unified Cloudflare Worker entry-point for `wrangler deploy`.
 * Routes `/api/*` requests directly to the canonical Pages Function router in `functions/api/[[route]].ts`
 * and serves the Vite `./dist` static SPA bundle via `env.ASSETS`.
 */
export default {
  async fetch(request: Request, env: EdgeEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return onRequest({ request, env });
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Static assets binding (ASSETS) is not configured.', { status: 404 });
  },
};
