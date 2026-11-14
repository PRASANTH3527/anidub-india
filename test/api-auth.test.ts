import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[route]].ts';

const TEST_ENV = {
  ADMIN_EMAIL: 'admin@anidub.in',
  CLERK_SECRET_KEY: 'sk_test_mock_secret_key_for_unit_tests',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Y2xlcmsuYW5pZHViLmluJA',
  DB: null as any,
};

async function invokeApi(path: string, init: RequestInit = {}) {
  const url = `https://anidub.in${path}`;
  return onRequest({
    request: new Request(url, init),
    env: TEST_ENV,
  });
}

test('API Clerk JWT Authentication & Route Protection', async (t) => {
  await t.test('POST /api/admin/login rejects spoofed headers and body without valid Clerk JWT (401)', async () => {
    const res = await invokeApi('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-clerk-user-id': 'user_clerk_admin_1',
        'x-clerk-user-email': 'admin@anidub.in',
      },
      body: JSON.stringify({
        userId: 'user_clerk_admin_1',
        email: 'admin@anidub.in',
      }),
    });
    assert.equal(res.status, 401);
  });

  await t.test('Protected routes reject unauthenticated or forged-token requests with 401', async () => {
    const forgedJwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.forgedsig';

    const postAnime = await invokeApi('/api/anime', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${forgedJwt}`,
      },
      body: JSON.stringify({ title: 'Unauthorized Title' }),
    });
    assert.equal(postAnime.status, 401);

    const putAnime = await invokeApi('/api/anime/1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${forgedJwt}`,
      },
      body: JSON.stringify({ title: 'Unauthorized Edit' }),
    });
    assert.equal(putAnime.status, 401);

    const deleteAnime = await invokeApi('/api/anime/1', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${forgedJwt}`,
      },
    });
    assert.equal(deleteAnime.status, 401);

    const verifyRes = await invokeApi('/api/admin/verify', {
      headers: {
        Authorization: `Bearer ${forgedJwt}`,
      },
    });
    assert.equal(verifyRes.status, 401);

    const exportCsv = await invokeApi('/api/admin/export-csv', {
      headers: {
        Authorization: `Bearer ${forgedJwt}`,
      },
    });
    assert.equal(exportCsv.status, 401);

    const d1QueryRes = await invokeApi('/api/cloudflare/d1/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${forgedJwt}`,
      },
      body: JSON.stringify({ sql: 'DROP TABLE anime;' }),
    });
    assert.equal(d1QueryRes.status, 401);

    // User Actions (Profile, Chat, Rating) must reject spoofed user_id in body when JWT is invalid
    const profilePutRes = await invokeApi('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'spoofed_user_123',
      },
      body: JSON.stringify({ user_id: 'spoofed_user_123', username: 'Hacker' }),
    });
    assert.equal(profilePutRes.status, 401);

    const chatPostRes = await invokeApi('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-clerk-user-id': 'spoofed_user_123',
      },
      body: JSON.stringify({
        user_id: 'spoofed_user_123',
        clerk_user_id: 'spoofed_user_123',
        user: 'Hacker',
        text: 'Spoofed message',
      }),
    });
    assert.equal(chatPostRes.status, 401);

    const ratePostRes = await invokeApi('/api/rate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'spoofed_user_123',
      },
      body: JSON.stringify({ anime_id: 1, rating: 10, user_id: 'spoofed_user_123' }),
    });
    assert.equal(ratePostRes.status, 401);

    // WebSocket Chat stream routes reject unauthenticated / forged-token requests with 401
    const wsStreamRes = await invokeApi('/ws/api/chat/stream', {
      headers: {
        Authorization: `Bearer ${forgedJwt}`,
      },
    });
    assert.equal(wsStreamRes.status, 401);

    // Public Feedback POST route enforces input validation, spam prevention & IP rate-limiting
    const testIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;
    const badFeedbackRes = await invokeApi('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': testIp,
      },
      body: JSON.stringify({ name: 'Tester', feedback: 'hi' }),
    });
    assert.equal(badFeedbackRes.status, 400);

    const spamFeedbackRes = await invokeApi('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': testIp,
      },
      body: JSON.stringify({
        name: 'SpamBot',
        feedback: 'Valid length feedback message',
        website: 'https://malicious-bot.example.com',
      }),
    });
    assert.equal(spamFeedbackRes.status, 400);

    for (let i = 1; i <= 3; i++) {
      const validFeedbackRes = await invokeApi('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': testIp,
        },
        body: JSON.stringify({
          name: 'FanUser',
          email: 'fan@example.com',
          feedback: `Loving the new Hindi and Tamil dub catalog update #${i}!`,
        }),
      });
      assert.equal(validFeedbackRes.status, 201);
    }

    const rateLimitedFeedbackRes = await invokeApi('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': testIp,
      },
      body: JSON.stringify({
        name: 'FanUser',
        email: 'fan@example.com',
        feedback: 'This 4th feedback submission from the same IP must be rate-limited!',
      }),
    });
    assert.equal(rateLimitedFeedbackRes.status, 429);
  });
});
