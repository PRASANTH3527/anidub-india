/**
 * Cloudflare Durable Object class `ChatRoom` for real-time Live Chat & WebSockets.
 * Explicitly exported from `src/edge-entry.ts` so Cloudflare Workers Durable Object
 * bindings and existing Durable Object instances resolve `ChatRoom` without error 10064.
 */
export class ChatRoom {
  private state: any;
  private env: any;
  private sessions: Set<any>;

  constructor(state: any, env: any) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      const WebSocketPairCtor = (globalThis as any).WebSocketPair;
      if (typeof WebSocketPairCtor === 'function') {
        const pair = new WebSocketPairCtor();
        const client = pair[0];
        const server = pair[1];

        if (this.state && typeof this.state.acceptWebSocket === 'function') {
          this.state.acceptWebSocket(server);
        } else if (server && typeof server.accept === 'function') {
          server.accept();
          this.sessions.add(server);

          server.addEventListener('message', (event: any) => {
            this.broadcast(typeof event.data === 'string' ? event.data : JSON.stringify(event.data));
          });

          const cleanup = () => {
            this.sessions.delete(server);
          };
          server.addEventListener('close', cleanup);
          server.addEventListener('error', cleanup);
        }

        return new Response(null, {
          status: 101,
          webSocket: client,
        } as any);
      }
    }

    if (request.method === 'POST') {
      try {
        const payload = await request.text();
        this.broadcast(payload);
        return new Response(JSON.stringify({ ok: true, broadcasted: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ ok: false, error: err?.message || 'Broadcast failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  webSocketMessage(_ws: any, message: string | ArrayBuffer) {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    this.broadcast(text);
  }

  webSocketClose(ws: any, code: number, reason: string) {
    try {
      this.sessions.delete(ws);
      ws.close(code, reason);
    } catch {}
  }

  webSocketError(ws: any) {
    try {
      this.sessions.delete(ws);
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
      }
    }
  }
}
