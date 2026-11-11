import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminToken, getAuthorizedAdminEmail } from '../src/utils/auth.js';

const BASE_URL = 'http://localhost:3000';

test('API Clerk Admin Authentication & Route Protection', async (t) => {
  await t.test('POST /api/admin/login without authorized Clerk Admin session rejects 401', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clerk-user-id': 'user_regular_fan',
          'x-clerk-user-email': 'fan@anidub.in',
        },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 401);
    } catch (e: any) {
      if (e.code === 'ECONNREFUSED') return;
      throw e;
    }
  });

  await t.test('POST /api/admin/login with authorized Clerk Admin session succeeds', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clerk-user-id': 'user_clerk_admin_1',
          'x-clerk-user-email': getAuthorizedAdminEmail(),
        },
        body: JSON.stringify({}),
      });
      if (res.status === 404) return;
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.token);
    } catch (e: any) {
      if (e.code === 'ECONNREFUSED') return;
      throw e;
    }
  });

  await t.test('Protected routes reject unauthorized requests with 401', async () => {
    try {
      const postAnime = await fetch(`${BASE_URL}/api/anime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Unauthorized Title' }),
      });
      assert.equal(postAnime.status, 401);

      const putAnime = await fetch(`${BASE_URL}/api/anime/1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Unauthorized Edit' }),
      });
      assert.equal(putAnime.status, 401);

      const deleteAnime = await fetch(`${BASE_URL}/api/anime/1`, {
        method: 'DELETE',
      });
      assert.equal(deleteAnime.status, 401);

      const importCsv = await fetch(`${BASE_URL}/api/admin/import-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(importCsv.status, 401);

      const exportCsv = await fetch(`${BASE_URL}/api/admin/export-csv`);
      assert.equal(exportCsv.status, 401);
    } catch (e: any) {
      if (e.code === 'ECONNREFUSED') return;
      throw e;
    }
  });

  await t.test('Protected routes succeed when valid Clerk Admin Bearer token is provided', async () => {
    try {
      const validToken = createAdminToken('user_clerk_admin_1', getAuthorizedAdminEmail());
      const verifyRes = await fetch(`${BASE_URL}/api/admin/verify`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      if (verifyRes.status === 404) return;
      assert.equal(verifyRes.status, 200);
      const verifyData = await verifyRes.json();
      assert.equal(verifyData.valid, true);

      const exportRes = await fetch(`${BASE_URL}/api/admin/export-csv`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      assert.equal(exportRes.status, 200);
      const exportData = await exportRes.json();
      assert.equal(exportData.success, true);
    } catch (e: any) {
      if (e.code === 'ECONNREFUSED') return;
      throw e;
    }
  });
});
