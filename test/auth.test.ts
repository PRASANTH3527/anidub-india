import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  isAuthorizedClerkAdmin,
  getAuthorizedAdminEmail,
  extractClerkJwtFromRequest,
  getAuth,
} from '../src/utils/auth.js';
import { onRequest } from '../functions/api/[[route]].ts';

function signClerkTestJwt(claims: Record<string, any>, privateKeyPem: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', cat: 'cl_B7d4PD111AAA' })
  ).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user_clerk_test_1',
      sid: 'sess_test_1',
      iat: nowSec - 10,
      nbf: nowSec - 10,
      exp: nowSec + 300,
      ...claims,
    })
  ).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKeyPem).toString('base64url');
  return `${unsigned}.${sig}`;
}

test('isAuthorizedClerkAdmin strictly validates against process.env.ADMIN_EMAIL with no fallback', () => {
  const prev = process.env.ADMIN_EMAIL;
  try {
    delete process.env.ADMIN_EMAIL;
    assert.equal(getAuthorizedAdminEmail(), '');
    assert.equal(isAuthorizedClerkAdmin('any@example.com'), false);

    process.env.ADMIN_EMAIL = 'admin@anidub.in';
    assert.equal(getAuthorizedAdminEmail(), 'admin@anidub.in');
    assert.equal(isAuthorizedClerkAdmin('admin@anidub.in'), true);
    assert.equal(isAuthorizedClerkAdmin('fan@anidub.in'), false);
    assert.equal(isAuthorizedClerkAdmin(''), false);
    assert.equal(isAuthorizedClerkAdmin(undefined), false);
  } finally {
    if (prev === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = prev;
  }
});

test('extractClerkJwtFromRequest extracts only well-formed 3-part JWTs from Authorization Bearer or __session cookie', () => {
  assert.equal(extractClerkJwtFromRequest({ headers: {} }), null);
  assert.equal(extractClerkJwtFromRequest({ headers: { authorization: 'Bearer not-a-jwt' } }), null);
  assert.equal(extractClerkJwtFromRequest({ headers: { authorization: 'Bearer a.b.c' } }), 'a.b.c');
  assert.equal(extractClerkJwtFromRequest({ headers: { cookie: 'foo=bar; __session=header.payload.sig; theme=dark' } }), 'header.payload.sig');
});

test('getAuth rejects forged or unsigned tokens and ignores spoofed client body/headers', async () => {
  const forgedJwt = [
    Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: 'user_123', email: 'admin@anidub.in' })).toString('base64url'),
    'forged_signature',
  ].join('.');

  const result = await getAuth({
    headers: {
      authorization: `Bearer ${forgedJwt}`,
      'x-clerk-user-id': 'user_123',
      'x-clerk-user-email': 'admin@anidub.in',
    },
    body: {
      userId: 'user_123',
      email: 'admin@anidub.in',
    },
  });

  assert.equal(result.authenticated, false);
  assert.equal(result.userId, null);
  assert.equal(result.isAdmin, false);
});

test('getAuth and /api/admin/verify enforce Clerk authorizedParties (azp) and verified primary email (email_verified === true)', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicKey,
    DB: null as any,
  };

  // 1. Token from another app (unapproved azp) MUST be rejected
  const foreignAppJwt = signClerkTestJwt(
    {
      email: 'admin@anidub.in',
      email_verified: true,
      azp: 'https://unrelated-clerk-app.com',
    },
    privateKey
  );
  const foreignAuth = await getAuth(
    new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${foreignAppJwt}` },
    }),
    env
  );
  assert.equal(foreignAuth.authenticated, false);
  assert.equal(foreignAuth.isAdmin, false);

  const foreignRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${foreignAppJwt}` },
    }),
    env,
  });
  assert.equal(foreignRes.status, 401);

  // 2. Token missing azp MUST be rejected
  const missingAzpJwt = signClerkTestJwt(
    {
      email: 'admin@anidub.in',
      email_verified: true,
    },
    privateKey
  );
  const missingAzpAuth = await getAuth(
    new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${missingAzpJwt}` },
    }),
    env
  );
  assert.equal(missingAzpAuth.authenticated, false);
  assert.equal(missingAzpAuth.isAdmin, false);

  // 3. Token with approved azp + matching admin email BUT email_verified: false MUST be denied admin access
  const unverifiedFalseJwt = signClerkTestJwt(
    {
      email: 'admin@anidub.in',
      email_verified: false,
      azp: 'https://anidub.in',
    },
    privateKey
  );
  const unverifiedFalseAuth = await getAuth(
    new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${unverifiedFalseJwt}` },
    }),
    env
  );
  assert.equal(unverifiedFalseAuth.authenticated, true);
  assert.equal(unverifiedFalseAuth.isAdmin, false);
  assert.match(unverifiedFalseAuth.error || '', /not verified/i);

  const unverifiedFalseRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${unverifiedFalseJwt}` },
    }),
    env,
  });
  assert.equal(unverifiedFalseRes.status, 403);

  // 4. Token with approved azp + matching admin email + omitted email_verified MUST be denied admin access
  const omittedVerifiedJwt = signClerkTestJwt(
    {
      email: 'admin@anidub.in',
      azp: 'https://anidub.in',
    },
    privateKey
  );
  const omittedVerifiedAuth = await getAuth(
    new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${omittedVerifiedJwt}` },
    }),
    env
  );
  assert.equal(omittedVerifiedAuth.authenticated, true);
  assert.equal(omittedVerifiedAuth.isAdmin, false);

  // 5. Token with approved azp + matching admin email + email_verified: true MUST succeed (200 OK)
  const validAdminJwt = signClerkTestJwt(
    {
      email: 'ADMIN@anidub.in',
      email_verified: true,
      azp: 'https://anidub.in',
    },
    privateKey
  );
  const validRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${validAdminJwt}` },
    }),
    env,
  });
  assert.equal(validRes.status, 200);
  const validJson: any = await validRes.json();
  assert.equal(validJson.ok, true);
  assert.equal(validJson.isAdmin, true);
});

test('/api/admin/verify and /api/admin/login never leak ADMIN_EMAIL in error responses', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const secretAdminEmail = 'top-secret-founder@anidub.in';
  const env = {
    ADMIN_EMAIL: secretAdminEmail,
    CLERK_JWT_KEY: publicKey,
    DB: null as any,
  };

  const nonAdminJwt = signClerkTestJwt(
    {
      sub: 'user_regular_viewer',
      email: 'viewer@example.com',
      email_verified: true,
      azp: 'https://anidub.in',
    },
    privateKey
  );

  for (const endpoint of ['/api/admin/verify', '/api/admin/login']) {
    const res = await onRequest({
      request: new Request(`https://anidub.in${endpoint}`, {
        method: endpoint === '/api/admin/login' ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${nonAdminJwt}` },
      }),
      env,
    });
    assert.equal(res.status, 403);
    const bodyText = await res.text();
    const json = JSON.parse(bodyText);
    assert.equal(json.isAdmin, false);
    assert.match(json.error, /Forbidden|Unauthorized/i);
    assert.equal(bodyText.includes(secretAdminEmail), false, `${endpoint} leaked ADMIN_EMAIL`);
    assert.equal(bodyText.includes('Email mismatch'), false, `${endpoint} leaked Email mismatch`);
  }
});

test('GET /api/anime/:id hides unpublished rows from public/non-admins and allows admins', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const rows = [
    { id: 10, slug: 'solo-leveling', title: 'Solo Leveling', is_published: 1 },
    { id: 99, slug: 'secret-pending-dub', title: 'Secret Pending Dub', is_published: 0 },
  ];
  const executedSql: string[] = [];

  const mockDb = {
    prepare(sql: string) {
      executedSql.push(sql);
      let bindings: any[] = [];
      return {
        bind(...args: any[]) {
          bindings = args;
          return this;
        },
        async first() {
          if (sql.startsWith('SELECT * FROM anime WHERE')) {
            const requiresPublished = sql.includes('is_published = 1');
            const target = String(bindings[0]);
            return (
              rows.find(
                (r) =>
                  (String(r.id) === target || r.slug === target) &&
                  (!requiresPublished || r.is_published === 1)
              ) || null
            );
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };

  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicKey,
    DB: mockDb,
  };

  // 1. Public request for unpublished anime by ID and by slug -> 404
  const pubPendingById = await onRequest({
    request: new Request('https://anidub.in/api/anime/99'),
    env,
  });
  assert.equal(pubPendingById.status, 404);

  const pubPendingBySlug = await onRequest({
    request: new Request('https://anidub.in/api/anime/secret-pending-dub'),
    env,
  });
  assert.equal(pubPendingBySlug.status, 404);
  assert.ok(
    executedSql.some((s) => s.includes('WHERE (id = ? OR slug = ?) AND is_published = 1')),
    'Public GET /api/anime/:id SQL must wrap OR in parentheses and filter AND is_published = 1'
  );

  // 2. Non-admin authenticated user also gets 404 for unpublished row
  const userJwt = signClerkTestJwt(
    { sub: 'user_viewer', email: 'viewer@example.com', email_verified: true, azp: 'https://anidub.in' },
    privateKey
  );
  const nonAdminPending = await onRequest({
    request: new Request('https://anidub.in/api/anime/99', {
      headers: { Authorization: `Bearer ${userJwt}` },
    }),
    env,
  });
  assert.equal(nonAdminPending.status, 404);

  // 3. Public request for published anime -> 200
  const pubPublished = await onRequest({
    request: new Request('https://anidub.in/api/anime/10'),
    env,
  });
  assert.equal(pubPublished.status, 200);

  // 4. Verified Admin request for unpublished anime -> 200
  const adminJwt = signClerkTestJwt(
    { sub: 'user_admin', email: 'admin@anidub.in', email_verified: true, azp: 'https://anidub.in' },
    privateKey
  );
  const adminPending = await onRequest({
    request: new Request('https://anidub.in/api/anime/secret-pending-dub', {
      headers: { Authorization: `Bearer ${adminJwt}` },
    }),
    env,
  });
  assert.equal(adminPending.status, 200);
  const adminJson: any = await adminPending.json();
  assert.equal(adminJson.title, 'Secret Pending Dub');
});

test('POST /api/admin/reset-db requires strict { confirm: "DELETE ALL" } and AdminDashboard enforces prompt()', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const deletedTables: string[] = [];
  const mockDb = {
    prepare(sql: string) {
      return {
        async run() {
          deletedTables.push(sql);
          return { success: true };
        },
      };
    },
  };

  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicKey,
    DB: mockDb,
  };

  const adminJwt = signClerkTestJwt(
    { sub: 'user_admin', email: 'admin@anidub.in', email_verified: true, azp: 'https://anidub.in' },
    privateKey
  );

  // 1. Missing body -> 400 and no DELETE executed
  const missingBodyRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/reset-db', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminJwt}` },
    }),
    env,
  });
  assert.equal(missingBodyRes.status, 400);
  assert.equal(deletedTables.length, 0);

  // 2. Wrong confirmation string -> 400 and no DELETE executed
  for (const wrongPayload of [{}, { confirm: '' }, { confirm: 'delete all' }, { confirm: 'YES' }]) {
    const wrongRes = await onRequest({
      request: new Request('https://anidub.in/api/admin/reset-db', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wrongPayload),
      }),
      env,
    });
    assert.equal(wrongRes.status, 400);
    assert.equal(deletedTables.length, 0);
  }

  // 3. Exact { confirm: "DELETE ALL" } -> 200 and deletes executed
  const confirmRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/reset-db', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirm: 'DELETE ALL' }),
    }),
    env,
  });
  assert.equal(confirmRes.status, 200);
  assert.ok(deletedTables.some((s) => s.includes('DELETE FROM anime')));

  // 4. Frontend AdminDashboard.tsx requires window.prompt() matching "DELETE ALL"
  const dashboardCode = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf-8');
  assert.ok(dashboardCode.includes('window.prompt('));
  assert.ok(dashboardCode.includes("typedConfirmation !== 'DELETE ALL'"));
});

test('Security headers (_headers), .gitignore, SEO assets, and non-sensitive reviews SQL projection', () => {
  const headersContent = fs.readFileSync(path.join(process.cwd(), 'public/_headers'), 'utf-8');
  assert.ok(headersContent.includes('X-Frame-Options: DENY'));
  assert.ok(headersContent.includes('X-Content-Type-Options: nosniff'));
  assert.ok(headersContent.includes('Referrer-Policy: strict-origin-when-cross-origin'));
  assert.ok(headersContent.includes('Strict-Transport-Security:'));
  assert.ok(headersContent.includes('Content-Security-Policy:'));
  assert.ok(
    headersContent.includes("img-src 'self' data: blob: https://i.ibb.co https://cdn.myanimelist.net https://img.clerk.com"),
    'img-src must explicitly whitelist CDNs instead of wildcard https:'
  );
  assert.equal(/img-src[^;]*\bhttps:\s*;/.test(headersContent), false);
  assert.ok(headersContent.includes('wss://anidub.in'));
  assert.match(headersContent, /script-src[^;]*'unsafe-inline'[^;]*'unsafe-eval'/);
  assert.match(headersContent, /script-src[^;]*https:\/\/\*\.clerk\.com[^;]*https:\/\/\*\.clerk\.accounts\.dev/);
  assert.match(headersContent, /connect-src[^;]*https:\/\/\*\.clerk\.com[^;]*https:\/\/\*\.clerk\.accounts\.dev[^;]*wss:/);
  assert.match(headersContent, /frame-src[^;]*https:\/\/\*\.clerk\.com[^;]*https:\/\/\*\.clerk\.accounts\.dev/);
  assert.match(headersContent, /worker-src[^;]*https:\/\/\*\.clerk\.com[^;]*https:\/\/\*\.clerk\.accounts\.dev/);

  const gitignoreContent = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf-8');
  assert.ok(gitignoreContent.includes('.wrangler/'));
  assert.ok(gitignoreContent.includes('.wrangler/state'));

  const robotsContent = fs.readFileSync(path.join(process.cwd(), 'public/robots.txt'), 'utf-8');
  assert.ok(robotsContent.includes('Sitemap: https://anidub.in/sitemap.xml'));
  assert.ok(robotsContent.includes('Disallow: /admin'));

  assert.equal(fs.existsSync(path.join(process.cwd(), 'public/sitemap.xml')), false);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'functions/sitemap.xml.ts')), true);

  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  assert.ok(indexHtml.includes('content="https://anidub.in/logo.png"'));
  assert.equal(indexHtml.includes('property="og:image" content="/logo.png"'), false);
  assert.equal(indexHtml.includes('images.unsplash.com'), false);
  assert.ok(
    indexHtml.includes(
      '<meta name="google-site-verification" content="svUhVIZSzl8_OJjRLTeLQPG2dAJJ-1KQMezuuVV_7B4" />'
    )
  );

  const readCombinedRouteCode = () => {
    const files: string[] = [path.join(process.cwd(), 'functions/api/[[route]].ts')];
    const routesDir = path.join(process.cwd(), 'src/server/routes');
    if (fs.existsSync(routesDir)) {
      for (const entry of fs.readdirSync(routesDir)) {
        if (entry.endsWith('.ts')) files.push(path.join(routesDir, entry));
      }
    }
    return files.map((filePath) => fs.readFileSync(filePath, 'utf-8')).join('\n');
  };

  const routeCode = readCombinedRouteCode();
  assert.equal(/SELECT\s+\*\s+FROM\s+reviews/i.test(routeCode), false);
  assert.ok(routeCode.includes('SELECT id, anime_id, user_id, user_name, user_avatar, rating, language, comment, created_at FROM reviews'));
});

test('Performance & code hygiene: no app/ Next.js leftovers, single animation lib, lazy Recharts, zero console.log, no ImgBB ?key= URLs', () => {
  // 1. Next.js app/ directory must be deleted
  assert.equal(fs.existsSync(path.join(process.cwd(), 'app')), false);

  // 2. Duplicate animation library removed from package.json and src/
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  assert.equal(Boolean(pkg.dependencies?.['framer-motion']), false);
  assert.ok(Boolean(pkg.dependencies?.motion));

  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  };

  const prodFiles = [
    ...walk(path.join(process.cwd(), 'src')),
    ...walk(path.join(process.cwd(), 'functions')),
  ];

  for (const file of prodFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = path.relative(process.cwd(), file);
    if (!rel.endsWith('.test.ts') && !rel.endsWith('.test.tsx')) {
      assert.equal(
        /\bconsole\.log\s*\(/.test(content),
        false,
        `Unexpected console.log in production file: ${rel}`
      );
      assert.equal(
        content.includes("from 'framer-motion'") || content.includes('from "framer-motion"'),
        false,
        `Unexpected framer-motion import in ${rel}`
      );
    }
  }

  // 3. Recharts is only imported inside the lazy-loaded AiringStatusPieChart component
  const ratioWidget = fs.readFileSync(path.join(process.cwd(), 'src/components/AiringStatusRatioWidget.tsx'), 'utf-8');
  assert.equal(ratioWidget.includes("from 'recharts'"), false);
  assert.ok(ratioWidget.includes("lazy(() =>"));
  assert.ok(ratioWidget.includes('./AiringStatusPieChart'));

  const adminDash = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf-8');
  assert.ok(adminDash.includes("lazy(() =>"));
  assert.ok(adminDash.includes('./AnalyticsDashboard'));

  // 4. ImgBB key is never appended as a URL query parameter (?key=)
  const routeFiles = [
    path.join(process.cwd(), 'functions/api/[[route]].ts'),
    ...fs
      .readdirSync(path.join(process.cwd(), 'src/server/routes'))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => path.join(process.cwd(), 'src/server/routes', name)),
  ];
  const combinedRouteCode = routeFiles.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');
  assert.equal(combinedRouteCode.includes('api.imgbb.com/1/upload?key='), false);
});

test('Code maintainability & refactoring: modular AdminDashboard tabs, modular API routes, and consolidated components', () => {
  // 1. AdminDashboard.tsx refactored into src/components/admin/* modules (down from >3600 lines)
  const adminDashCode = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf-8');
  assert.ok(adminDashCode.split('\n').length < 2200, 'AdminDashboard.tsx should remain significantly reduced');
  assert.ok(adminDashCode.includes('./admin/AdminOverviewTab'));
  assert.ok(adminDashCode.includes('./admin/AdminCatalogTab'));
  assert.ok(adminDashCode.includes('./admin/AdminSettingsTab'));

  // 2. functions/api/[[route]].ts delegates to src/server/routes/*
  const routerEntry = fs.readFileSync(path.join(process.cwd(), 'functions/api/[[route]].ts'), 'utf-8');
  assert.ok(routerEntry.split('\n').length < 250, 'functions/api/[[route]].ts should be a concise modular router');
  assert.ok(routerEntry.includes('handleAdminRoutes'));
  assert.ok(routerEntry.includes('handleAnimeRoutes'));
  assert.ok(routerEntry.includes('handleUserRoutes'));
  assert.ok(routerEntry.includes('handleCommunityRoutes'));
  assert.ok(routerEntry.includes('handleAnalyticsRoutes'));

  // 3. Duplicate components consolidated
  assert.equal(fs.existsSync(path.join(process.cwd(), 'src/components/AnimeModal.tsx')), false);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'src/components/AnimeDetailModal.tsx')), false);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'src/components/Profile.tsx')), false);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'src/components/CreateCollectionUI.tsx')), false);

  const animeDetailCode = fs.readFileSync(path.join(process.cwd(), 'src/components/AnimeDetailPage.tsx'), 'utf-8');
  assert.ok(animeDetailCode.includes('export const AnimeDetailPage'));
  assert.ok(animeDetailCode.includes('export const AnimeDetailModal'));

  const profileCode = fs.readFileSync(path.join(process.cwd(), 'src/components/ProfileView.tsx'), 'utf-8');
  assert.ok(profileCode.includes('export function ProfileView'));
  assert.ok(profileCode.includes('export { ProfileView as Profile }'));

  const collectionCode = fs.readFileSync(path.join(process.cwd(), 'src/components/CreateCollectionModal.tsx'), 'utf-8');
  assert.ok(collectionCode.includes('export const CreateCollectionModal'));
  assert.ok(collectionCode.includes('export const CreateCollectionUI'));
});


