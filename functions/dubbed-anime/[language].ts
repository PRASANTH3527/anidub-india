import {
  type HTMLRewriterConstructorLike,
  resolveLanguageSeoResponse,
} from '../../src/utils/seoMeta';

export interface PagesLanguageSeoContext {
  request: Request;
  env: {
    ASSETS?: { fetch: (request: Request) => Promise<Response> };
  };
  params?: { language?: string };
  next?: () => Promise<Response>;
  RewriterCtor?: HTMLRewriterConstructorLike;
}

export async function onRequest(context: PagesLanguageSeoContext): Promise<Response> {
  const { request, env, params, next, RewriterCtor } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (typeof next === 'function') return next();
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Method Not Allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const pathSegment = url.pathname.replace(/^\/dubbed-anime\//, '').split('/')[0] || '';
  const languageSlug = decodeURIComponent(String(params?.language || pathSegment)).trim();

  let baseHtmlResponse: Response | null = null;
  if (typeof next === 'function') {
    baseHtmlResponse = await next();
  } else if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
    baseHtmlResponse = await env.ASSETS.fetch(
      new Request(new URL('/index.html', url.origin), {
        method: 'GET',
        headers: request.headers,
      })
    );
  }

  if (!baseHtmlResponse) {
    return new Response('HTML entrypoint not found', { status: 404 });
  }

  return resolveLanguageSeoResponse({
    request,
    languageSlug,
    baseHtmlResponse,
    RewriterCtor,
  });
}
