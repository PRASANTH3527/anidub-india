import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { onRequest } from '../functions/api/[[route]]';
import { ChatRoom } from '../src/chat-room';
import { getCloudflareWsUrl } from '../src/config/cloudflare';
import { buildVerifiedScheduleData } from '../src/utils/schedule';
import { clearChatRateLimitStores } from '../src/utils/rateLimiter';
import { clearSubmissionRateLimitStores } from '../src/utils/submissionValidation';

function createSignedJwt(payload: Record<string, any>, privateKeyPem: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', cat: 'cl_B7d4PD111AAA' })
  ).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = Buffer.from(
    JSON.stringify({
      iat: now - 5,
      nbf: now - 5,
      exp: now + 300,
      azp: 'https://anidub-india-a1y.pages.dev',
      ...payload,
    })
  ).toString('base64url');
  const unsigned = `${header}.${fullPayload}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKeyPem).toString('base64url');
  return `${unsigned}.${sig}`;
}

test('Step 2.1 WebSocket Security: client connects without URL token and sends { type: "auth", token } payload', () => {
  const wsUrl = getCloudflareWsUrl('/ws');
  assert.equal(wsUrl.includes('token='), false);
  assert.equal(wsUrl.includes('?'), false);

  for (const relPath of [
    'src/components/LiveChat.tsx',
    'src/components/AnimeDetailPage.tsx',
    'src/context/NotificationContext.tsx',
  ]) {
    const code = fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
    assert.equal(code.includes('?token='), false, `${relPath} must not pass ?token= in URL`);
    assert.ok(code.includes("type: 'auth'"), `${relPath} must send { type: 'auth', token } payload`);
  }
});

test('Step 2.2 API Error Handling: backend D1/handler failures and non-existent updates return proper HTTP error codes instead of empty 200', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const adminJwt = createSignedJwt(
    {
      sub: 'user_admin_err_check',
      sid: 'sess_err_check',
      username: 'Admin',
      email: 'admin@anidub.in',
      email_verified: true,
    },
    privateKey
  );

  // Failing D1 database on GET /api/anime must return HTTP 500 with error message (not HTTP 200)
  const failingDb = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          throw new Error('D1 connection lost');
        },
        async first() {
          throw new Error('D1 connection lost');
        },
        async run() {
          throw new Error('D1 connection lost');
        },
      };
    },
  };

  const getFailRes = await onRequest({
    request: new Request('https://anidub.in/api/anime'),
    env: { DB: failingDb },
  });
  assert.equal(getFailRes.status, 500);
  const getFailJson: any = await getFailRes.json();
  assert.equal(getFailJson.success, false);
  assert.ok(getFailJson.error.includes('D1 connection lost'));

  // DELETE on non-existent ID must return HTTP 404 (not 200)
  const emptyChangeDb = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          return { results: [] };
        },
        async first() {
          return null;
        },
        async run() {
          return { meta: { changes: 0 } };
        },
      };
    },
  };

  const deleteMissingRes = await onRequest({
    request: new Request('https://anidub.in/api/anime/999999', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminJwt}` },
    }),
    env: {
      DB: emptyChangeDb,
      CLERK_JWT_KEY: publicKey,
      ADMIN_EMAIL: 'admin@anidub.in',
    },
  });
  assert.equal(deleteMissingRes.status, 404);
  const deleteMissingJson: any = await deleteMissingRes.json();
  assert.equal(deleteMissingJson.success, false);
});

test('Step 2.3 CSP & Inline Script Hardening: _headers defines strict CSP and index.html has no inline onload handler', () => {
  const headersContent = fs.readFileSync(path.join(process.cwd(), 'public/_headers'), 'utf-8');
  assert.ok(headersContent.includes('Content-Security-Policy:'));
  assert.ok(headersContent.includes("script-src 'self'"));
  assert.ok(headersContent.includes('clerk.accounts.dev'));
  assert.ok(headersContent.includes("connect-src 'self' https: wss:"));
  assert.ok(headersContent.includes("object-src 'none'"));
  assert.ok(headersContent.includes("frame-ancestors 'none'"));

  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  assert.equal(indexHtml.includes('onload='), false);
});

test('Step 2.4 Schedule Data Model: persists verified broadcast_day & broadcast_time without fabricating 08:00 PM IST or modulo weekdays', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const adminJwt = createSignedJwt(
    {
      sub: 'user_admin_sched',
      sid: 'sess_sched',
      username: 'Admin',
      email: 'admin@anidub.in',
      email_verified: true,
    },
    privateKey
  );

  let insertedBindArgs: any[] = [];
  const mockDb = {
    prepare(sql: string) {
      return {
        bind(...args: any[]) {
          if (sql.includes('INSERT INTO anime')) {
            insertedBindArgs = args;
          }
          return this;
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { meta: { last_row_id: 77, changes: 1 } };
        },
      };
    },
  };

  const createRes = await onRequest({
    request: new Request('https://anidub.in/api/anime', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({
        title: 'Solo Leveling Season 2',
        status: 'Airing',
        broadcast_day: 'saturday',
        broadcast_time: '09:30 PM IST',
        languages: ['Hindi', 'Tamil'],
        platform: 'Crunchyroll',
      }),
    }),
    env: {
      DB: mockDb,
      CLERK_JWT_KEY: publicKey,
      ADMIN_EMAIL: 'admin@anidub.in',
    },
  });
  assert.equal(createRes.status, 201);
  const createJson: any = await createRes.json();
  assert.equal(createJson.broadcast_day, 'Saturday');
  assert.equal(createJson.broadcast_time, '09:30 PM IST');
  assert.ok(insertedBindArgs.includes('Saturday'));
  assert.ok(insertedBindArgs.includes('09:30 PM IST'));

  // Verify buildVerifiedScheduleData never fabricates modulo days or fake '08:00 PM IST'
  const schedule = buildVerifiedScheduleData([
    {
      id: 1,
      title: 'Dandadan',
      status: 'Airing',
      broadcast_day: 'Thursday',
      broadcast_time: '09:00 PM IST',
      platform: 'Muse India',
      languages: 'Hindi',
    },
    {
      id: 2,
      title: 'Ongoing Without Time',
      status: 'Ongoing',
      broadcast_day: 'Sunday',
      broadcast_time: null,
      platform: 'Crunchyroll',
      languages: 'Tamil',
    },
    {
      id: 3,
      title: 'Unscheduled Simulcast',
      status: 'Airing',
      broadcast_day: null,
      broadcast_time: null,
      platform: 'Netflix',
      languages: 'Hindi',
    },
    {
      id: 4,
      title: 'Finished Show',
      status: 'Completed',
      broadcast_day: null,
      broadcast_time: null,
      platform: 'Netflix',
      languages: 'Hindi',
    },
  ]);

  assert.equal(schedule.allSimulcasts.length, 3);
  assert.equal(schedule.scheduledItems.length, 2);
  assert.equal(schedule.unscheduledItems.length, 1);
  assert.equal(schedule.scheduledItems[0].broadcastDay, 'Thursday');
  assert.equal(schedule.scheduledItems[0].displayAirTime, '09:00 PM IST');
  assert.equal(schedule.scheduledItems[1].broadcastDay, 'Sunday');
  assert.equal(schedule.scheduledItems[1].displayAirTime, 'Time TBA');
  assert.equal(schedule.unscheduledItems[0].broadcastDay, null);
  assert.equal(schedule.unscheduledItems[0].displayAirTime, 'Time TBA');
});

test('Step 2.5 Rate Limiting: enforces throttling & 429 Retry-After headers on chat REST, ChatRoom WS, and community submission', async () => {
  clearChatRateLimitStores();
  clearSubmissionRateLimitStores();

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const userJwt = createSignedJwt(
    {
      sub: 'user_rl_test_1',
      sid: 'sess_rl_1',
      username: 'speed_chatter',
      email: 'speed@example.com',
      email_verified: true,
    },
    privateKey
  );

  // 1. Duplicate message spam cooldown on POST /api/chat
  const firstChat = await onRequest({
    request: new Request('https://anidub.in/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
        'CF-Connecting-IP': '198.51.100.42',
      },
      body: JSON.stringify({ user: 'speed_chatter', text: 'Duplicate spam test' }),
    }),
    env: { DB: null, CLERK_JWT_KEY: publicKey },
  });
  assert.equal(firstChat.status, 200);

  const dupChat = await onRequest({
    request: new Request('https://anidub.in/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
        'CF-Connecting-IP': '198.51.100.42',
      },
      body: JSON.stringify({ user: 'speed_chatter', text: 'Duplicate spam test' }),
    }),
    env: { DB: null, CLERK_JWT_KEY: publicKey },
  });
  assert.equal(dupChat.status, 429);
  assert.ok(dupChat.headers.get('Retry-After'));
  assert.ok(dupChat.headers.get('X-RateLimit-Limit'));

  // 2. ChatRoom WebSocket burst limit (>10 frames/15s) emits RATE_LIMITED
  const mockWs = {
    sent: [] as string[],
    send(msg: string) {
      this.sent.push(msg);
    },
    close() {},
  };
  const room = new ChatRoom({ getWebSockets: () => [mockWs] }, { CLERK_JWT_KEY: publicKey });
  await room.processMessageForSocket(
    mockWs,
    JSON.stringify({ type: 'auth', token: userJwt, username: 'speed_chatter' })
  );

  let rateLimitedSeen = false;
  for (let i = 0; i < 12; i++) {
    const r = await room.processMessageForSocket(
      mockWs,
      JSON.stringify({ id: `burst_${i}`, user: 'speed_chatter', text: `Burst line #${i}` })
    );
    if (!r.accepted && r.code === 'RATE_LIMITED') {
      rateLimitedSeen = true;
      break;
    }
  }
  assert.equal(rateLimitedSeen, true);

  // 3. Community submission cooldown returns 429 + Retry-After + X-RateLimit-Limit
  let loggedSubmissionCount = 0;
  const submissionCountingDb = {
    prepare(sql: string) {
      return {
        bind() {
          return this;
        },
        async first() {
          if (sql.includes('community_submission_logs')) {
            return { total: loggedSubmissionCount, oldest: Date.now() - 1000 };
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          if (sql.includes('community_submission_logs')) {
            loggedSubmissionCount += 1;
          }
          return { meta: { last_row_id: loggedSubmissionCount + 1, changes: 1 } };
        },
      };
    },
  };

  for (let idx = 1; idx <= 3; idx++) {
    const allowedSub = await onRequest({
      request: new Request('https://anidub.in/api/anime/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userJwt}`,
          'CF-Connecting-IP': '203.0.113.77',
        },
        body: JSON.stringify({
          title: `Rate Limit Anime ${idx}`,
          languages: ['Hindi'],
          platform: 'Crunchyroll',
          type: 'TV Series',
          status: 'Completed',
        }),
      }),
      env: { DB: submissionCountingDb, CLERK_JWT_KEY: publicKey },
    });
    assert.equal(allowedSub.status, 201);
  }

  const throttledSub = await onRequest({
    request: new Request('https://anidub.in/api/anime/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
        'CF-Connecting-IP': '203.0.113.77',
      },
      body: JSON.stringify({
        title: 'Rate Limit Anime Four',
        languages: ['Tamil'],
        platform: 'Netflix',
        type: 'TV Series',
        status: 'Completed',
      }),
    }),
    env: { DB: submissionCountingDb, CLERK_JWT_KEY: publicKey },
  });
  assert.equal(throttledSub.status, 429);
  assert.ok(throttledSub.headers.get('Retry-After'));
  assert.ok(throttledSub.headers.get('X-RateLimit-Limit'));
});
