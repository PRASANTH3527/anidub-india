import { onRequest } from '../functions/api/[[route]]';
import { ChatRoom } from './chat-room';

export { ChatRoom };

interface EdgeEnv {
  DB: any;
  CHAT_ROOM?: any;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  [key: string]: any;
}

/**
 * Unified Cloudflare Worker entry-point for `wrangler deploy`.
 * Exports `ChatRoom` Durable Object and routes `/api/*` and `/ws*` requests
 * to `functions/api/[[route]].ts` while serving `./dist` via `env.ASSETS`.
 */
export default {
  async fetch(request: Request, env: EdgeEnv): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === '/api' ||
      url.pathname.startsWith('/api/') ||
      url.pathname === '/ws' ||
      url.pathname.startsWith('/ws/')
    ) {
      return onRequest({ request, env });
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Static assets binding (ASSETS) is not configured.', { status: 404 });
  },
};



