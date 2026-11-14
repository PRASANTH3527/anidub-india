import { isApprovedOrigin } from '../../utils/auth';

export interface D1MetaLike {
  last_row_id?: number;
  changes?: number;
}

export interface D1AllResultLike<T = Record<string, unknown>> {
  results?: T[];
  success?: boolean;
}

export interface D1PreparedStatementLike {
  bind: (...values: unknown[]) => D1PreparedStatementLike;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<D1AllResultLike<T>>;
  run: () => Promise<{ success?: boolean; meta?: D1MetaLike }>;
}

export interface D1DatabaseLike {
  prepare: (sql: string) => D1PreparedStatementLike;
}

export interface D1PreparedStatementInputLike {
  bind?: (...values: unknown[]) => D1PreparedStatementInputLike;
  first?: () => Promise<unknown>;
  all?: () => Promise<unknown>;
  run?: () => Promise<unknown>;
}

export interface D1DatabaseInputLike {
  prepare: (sql: string) => D1PreparedStatementInputLike;
}

export interface DurableObjectNamespaceLike {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => { fetch: (request: Request) => Promise<Response> };
}

export interface CloudflareEnv {
  DB: D1DatabaseLike | null;
  CHAT_ROOM?: DurableObjectNamespaceLike;
  ADMIN_EMAIL?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_KEY?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  VITE_CLERK_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_ADMIN_EMAIL?: string;
  VITE_ADMIN_EMAIL?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  ALLOWED_ORIGINS?: string;
  IMGBB_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  ENVIRONMENT?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

export type CloudflareEnvInput = Omit<CloudflareEnv, 'DB'> & {
  DB?: D1DatabaseLike | D1DatabaseInputLike | null;
};

export type PagesFunction<T = CloudflareEnvInput> = (context: {
  request: Request;
  env: T;
  params?: Record<string, string>;
}) => Promise<Response> | Response;

export type JsonResponder = (
  data: unknown,
  status?: number,
  reqArg?: Request,
  extraHeaders?: Record<string, string>
) => Response;

export interface RouteContext {
  request: Request;
  env: CloudflareEnv;
  url: URL;
  path: string;
  method: string;
  jsonResponse: JsonResponder;
}

export const D1_DATABASE_ID = '75f053ab-5b44-4d48-abf8-b3a357a89426';

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function sendTelegramAlert(
  env: CloudflareEnv,
  text: string,
  photoUrl?: string
): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    if (photoUrl && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))) {
      const pRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: text.slice(0, 1024),
          parse_mode: 'HTML',
        }),
      });
      if (pRes.ok) return;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      const plainText = text.replace(/<[^>]*>/g, '');
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainText.slice(0, 4096),
        }),
      });
    }
  } catch (err) {
    console.error('Telegram notification error:', err);
  }
}

export function buildJsonResponse(
  data: unknown,
  status = 200,
  request?: Request,
  extraHeaders?: Record<string, string>,
  env?: CloudflareEnv
): Response {
  const origin = request ? request.headers.get('Origin') || request.headers.get('origin') || '' : '';
  const allowed = origin === '' || isApprovedOrigin(origin, env);

  const resolvedOrigin = allowed && origin ? origin : 'https://anidub.in';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-id',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': resolvedOrigin,
    ...(extraHeaders || {}),
  };

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

export function createJsonResponder(defaultRequest: Request, env: CloudflareEnv): JsonResponder {
  return (data, status = 200, reqArg, extraHeaders) =>
    buildJsonResponse(data, status, reqArg ?? defaultRequest, extraHeaders, env);
}
