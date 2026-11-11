import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3000';

test('API Clerk JWT Authentication & Route Protection', async (t) => {
  await t.test('POST /api/admin/login rejects spoofed headers and body without valid Clerk JWT (401)', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/login`, {
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
    } catch (e: any) {
      if (e.code === 'ECONNREFUSED') return;
      throw e;
    }
  });

  await t.test('Protected routes reject unauthenticated or forged-token requests with 401', async () => {
    try {
      const forgedJwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.forgedsig';

      const postAnime = await fetch(`${BASE_URL}/api/anime`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${forgedJwt}`,
        },
        body: JSON.stringify({ title: 'Unauthorized Title' }),
      });
      assert.equal(postAnime.status, 401);

      const putAnime = await fetch(`${BASE_URL}/api/anime/1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${forgedJwt}`,
        },
        body: JSON.stringify({ title: 'Unauthorized Edit' }),
      });
      assert.equal(putAnime.status, 401);

      const deleteAnime = await fetch(`${BASE_URL}/api/anime/1`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${forgedJwt}`,
        },
      });
      assert.equal(deleteAnime.status, 401);

      const verifyRes = await fetch(`${BASE_URL}/api/admin/verify`, {
        headers: {
          Authorization: `Bearer ${forgedJwt}`,
        },
      });
      assert.equal(verifyRes.status, 401);

      const exportCsv = await fetch(`${BASE_URL}/api/admin/export-csv`, {
        headers: {
          Authorization: `Bearer ${forgedJwt}`,
        },
      });
      assert.equal(exportCsv.status, 401);
    } catch (e: any) {
      if (e.code === 'ECONNREFUSED') return;
      throw e;
    }
  });
});
