import {
  verifyChatTokenDirect,
  extractExplicitChatToken,
  isApprovedOrigin,
  type EnvBindings,
} from './utils/auth';
import {
  buildVerifiedChatIdentity,
  validateChatSender,
  type VerifiedChatIdentity,
} from './utils/chatIdentity';

export interface ProcessWebSocketMessageResult {
  accepted: boolean;
  code?: string;
  error?: string;
  payload?: Record<string, any>;
}

/**
 * Cloudflare Durable Object class `ChatRoom` for real-time Live Chat & WebSockets.
 * Enforces strict Clerk identity verification, reserved name protection, and rejects
 * spoofed or mismatched usernames by returning an error event back through the WebSocket.
 */
export class ChatRoom {
  private state: any;
  private env: EnvBindings;
  private sessions: Set<any>;
  private socketIdentities: Map<any, VerifiedChatIdentity>;

  constructor(state: any, env: any) {
    this.state = state;
    this.env = env || {};
    this.sessions = new Set();
    this.socketIdentities = new Map();
  }

  private getCorsHeaders(request: Request, contentType?: string): Record<string, string> {
    const origin = request?.headers?.get?.('Origin') || request?.headers?.get?.('origin') || '';
    const resolvedOrigin =
      origin && isApprovedOrigin(origin, this.env)
        ? origin
        : 'https://anidub-india-a1y.pages.dev';

    return {
      ...(contentType ? { 'Content-Type': contentType } : {}),
      Vary: 'Origin',
      'Access-Control-Allow-Origin': resolvedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade, Connection, x-device-id',
      'Access-Control-Allow-Credentials': 'true',
    };
  }

  public attachVerifiedIdentity(ws: any, identity: VerifiedChatIdentity): void {
    this.socketIdentities.set(ws, identity);
    try {
      if (ws && typeof ws.serializeAttachment === 'function') {
        ws.serializeAttachment({ chatIdentity: identity });
      }
    } catch {
      // Non-hibernation environments don't support serializeAttachment
    }
  }

  public getVerifiedIdentity(ws: any): VerifiedChatIdentity | null {
    const inMemory = this.socketIdentities.get(ws);
    if (inMemory) return inMemory;
    try {
      if (ws && typeof ws.deserializeAttachment === 'function') {
        const attached = ws.deserializeAttachment();
        if (attached?.chatIdentity?.userId) {
          this.socketIdentities.set(ws, attached.chatIdentity);
          return attached.chatIdentity;
        }
      }
    } catch {
      // Ignore deserialize failures
    }
    return null;
  }

  private sendSocketError(
    ws: any,
    error: string,
    code: string = 'CHAT_REJECTED',
    messageId: string | number | null = null
  ): void {
    try {
      ws.send(
        JSON.stringify({
          type: 'error',
          code,
          error,
          messageId,
        })
      );
    } catch {
      // Ignore closed socket
    }
  }

  public processMessageForSocket(
    ws: any,
    rawMessage: string | ArrayBuffer
  ): ProcessWebSocketMessageResult {
    const identity = this.getVerifiedIdentity(ws);
    if (!identity || !identity.userId) {
      const errMsg = 'Unauthorized: Verified Clerk session is required to send chat messages.';
      this.sendSocketError(ws, errMsg, 'UNAUTHORIZED', null);
      return { accepted: false, code: 'UNAUTHORIZED', error: errMsg };
    }

    const rawText =
      typeof rawMessage === 'string'
        ? rawMessage
        : new TextDecoder().decode(rawMessage);

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const errMsg = 'Invalid WebSocket message format: JSON payload expected.';
      this.sendSocketError(ws, errMsg, 'INVALID_PAYLOAD', null);
      return { accepted: false, code: 'INVALID_PAYLOAD', error: errMsg };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const errMsg = 'Invalid WebSocket message payload.';
      this.sendSocketError(ws, errMsg, 'INVALID_PAYLOAD', null);
      return { accepted: false, code: 'INVALID_PAYLOAD', error: errMsg };
    }

    const messageText = String(parsed.text || parsed.comment || parsed.message || '').trim();
    if (!messageText) {
      const errMsg = 'Message text cannot be empty.';
      this.sendSocketError(ws, errMsg, 'EMPTY_MESSAGE', parsed.id ?? null);
      return { accepted: false, code: 'EMPTY_MESSAGE', error: errMsg };
    }

    const claimedUsername = parsed.user ?? parsed.username ?? parsed.user_name ?? '';
    const senderCheck = validateChatSender({
      claimedUsername,
      identity,
      env: this.env,
    });

    if (!senderCheck.ok || !senderCheck.verifiedUsername) {
      const errMsg = senderCheck.error || 'Username verification failed.';
      const code = senderCheck.code || 'USERNAME_MISMATCH';
      this.sendSocketError(ws, errMsg, code, parsed.id ?? null);
      return { accepted: false, code, error: errMsg };
    }

    const verifiedPayload: Record<string, any> = {
      id: parsed.id || `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user: senderCheck.verifiedUsername,
      text: messageText.slice(0, 1000),
      timestamp:
        typeof parsed.timestamp === 'string' && parsed.timestamp.trim()
          ? parsed.timestamp.trim()
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isReview: Boolean(parsed.isReview || parsed.is_review || parsed.rating),
      rating:
        parsed.rating !== undefined && parsed.rating !== null && !isNaN(Number(parsed.rating))
          ? Number(parsed.rating)
          : null,
      language: parsed.language ? String(parsed.language).slice(0, 30) : null,
      clerk_user_id: identity.userId,
    };

    this.broadcast(JSON.stringify(verifiedPayload));
    return { accepted: true, payload: verifiedPayload };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: this.getCorsHeaders(request),
      });
    }

    const jsonCorsHeaders = this.getCorsHeaders(request, 'application/json');
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      const explicitWsToken = extractExplicitChatToken(request);
      const session = await verifyChatTokenDirect(explicitWsToken, this.env);
      if (!session.userId) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: session.error || 'Unauthorized: Valid Clerk session required for WebSocket chat.',
          }),
          {
            status: 401,
            headers: jsonCorsHeaders,
          }
        );
      }

      const identity = buildVerifiedChatIdentity({
        userId: session.userId,
        username: session.username,
        email: session.email,
        isAdmin: session.isAdmin,
        claims: session.claims,
        clerkUser: session.clerkUser,
      });

      if (!identity) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Unable to resolve verified Clerk chat identity.' }),
          { status: 401, headers: jsonCorsHeaders }
        );
      }

      try {
        const reqUrl = new URL(request.url, 'http://localhost');
        const requestedUsername = reqUrl.searchParams.get('username') || reqUrl.searchParams.get('user');
        if (requestedUsername) {
          const handshakeCheck = validateChatSender({
            claimedUsername: requestedUsername,
            identity,
            env: this.env,
          });
          if (!handshakeCheck.ok) {
            return new Response(
              JSON.stringify({
                ok: false,
                code: handshakeCheck.code,
                error: handshakeCheck.error,
              }),
              {
                status: handshakeCheck.status,
                headers: jsonCorsHeaders,
              }
            );
          }
        }
      } catch {
        // Ignore malformed URLs
      }

      const WebSocketPairCtor = (globalThis as any).WebSocketPair;
      if (typeof WebSocketPairCtor === 'function') {
        const pair = new WebSocketPairCtor();
        const client = pair[0];
        const server = pair[1];

        if (this.state && typeof this.state.acceptWebSocket === 'function') {
          this.state.acceptWebSocket(server, [identity.userId]);
          this.attachVerifiedIdentity(server, identity);
        } else if (server && typeof server.accept === 'function') {
          server.accept();
          this.sessions.add(server);
          this.attachVerifiedIdentity(server, identity);

          server.addEventListener('message', (event: any) => {
            this.processMessageForSocket(server, event.data);
          });

          const cleanup = () => {
            this.sessions.delete(server);
            this.socketIdentities.delete(server);
          };
          server.addEventListener('close', cleanup);
          server.addEventListener('error', cleanup);
        }

        return new Response(null, {
          status: 101,
          webSocket: client,
          headers: this.getCorsHeaders(request),
        } as any);
      }
    }

    if (request.method === 'POST') {
      try {
        const rawPayload = await request.text();
        let parsed: any;
        try {
          parsed = JSON.parse(rawPayload);
        } catch {
          return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }), {
            status: 400,
            headers: jsonCorsHeaders,
          });
        }

        const explicitPostToken = extractExplicitChatToken(request, parsed);
        const session = await verifyChatTokenDirect(explicitPostToken, this.env);
        if (!session.userId) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: session.error || 'Unauthorized: Valid Clerk session required to broadcast.',
            }),
            { status: 401, headers: jsonCorsHeaders }
          );
        }

        const identity = buildVerifiedChatIdentity({
          userId: session.userId,
          username: session.username,
          email: session.email,
          isAdmin: session.isAdmin,
          claims: session.claims,
          clerkUser: session.clerkUser,
        });

        const claimedUsername = parsed?.user ?? parsed?.username ?? parsed?.user_name ?? '';
        const senderCheck = validateChatSender({
          claimedUsername,
          identity,
          env: this.env,
        });

        if (!senderCheck.ok || !senderCheck.verifiedUsername) {
          return new Response(
            JSON.stringify({ ok: false, code: senderCheck.code, error: senderCheck.error }),
            {
              status: senderCheck.status,
              headers: jsonCorsHeaders,
            }
          );
        }

        const sanitized = {
          ...parsed,
          user: senderCheck.verifiedUsername,
          clerk_user_id: identity!.userId,
        };
        this.broadcast(JSON.stringify(sanitized));
        return new Response(JSON.stringify({ ok: true, broadcasted: true }), {
          status: 200,
          headers: jsonCorsHeaders,
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ ok: false, error: err?.message || 'Broadcast failed' }), {
          status: 500,
          headers: jsonCorsHeaders,
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        durableObject: 'ChatRoom',
        status: 'active',
      }),
      {
        status: 200,
        headers: jsonCorsHeaders,
      }
    );
  }

  webSocketMessage(ws: any, message: string | ArrayBuffer) {
    this.processMessageForSocket(ws, message);
  }

  webSocketClose(ws: any, code: number, reason: string) {
    try {
      this.sessions.delete(ws);
      this.socketIdentities.delete(ws);
      ws.close(code, reason);
    } catch {}
  }

  webSocketError(ws: any) {
    try {
      this.sessions.delete(ws);
      this.socketIdentities.delete(ws);
    } catch {}
  }

  private broadcast(message: string) {
    const sockets: any[] =
      this.state && typeof this.state.getWebSockets === 'function'
        ? this.state.getWebSockets()
        : Array.from(this.sessions);

    for (const ws of sockets) {
      try {
        ws.send(message);
      } catch {
        this.sessions.delete(ws);
        this.socketIdentities.delete(ws);
      }
    }
  }
}
