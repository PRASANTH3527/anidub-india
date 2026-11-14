import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { getAuthorizedAdminEmail, isAuthorizedClerkAdmin, extractClerkJwtFromRequest, getAuth } from './auth';

test('Security Audit 1: Mock auth removed & official @clerk/nextjs used without sessionStorage or hardcoded keys', () => {
  const clerkLibPath = path.join(process.cwd(), 'src/lib/clerk.tsx');
  const clerkLibContent = fs.readFileSync(clerkLibPath, 'utf-8');

  assert.equal(
    clerkLibContent.includes('sessionStorage'),
    false,
    'src/lib/clerk.tsx must not use sessionStorage for auth tokens'
  );
  assert.equal(
    clerkLibContent.includes('mock'),
    false,
    'src/lib/clerk.tsx must not contain mock auth implementations'
  );
  assert.ok(
    clerkLibContent.includes('@clerk/nextjs') || clerkLibContent.includes('@clerk/clerk-react'),
    'src/lib/clerk.tsx must integrate with official Clerk packages'
  );
});

test('Security Audit 2: Strict ADMIN_EMAIL validation with zero hardcoded fallbacks', () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  try {
    delete process.env.ADMIN_EMAIL;
    assert.equal(getAuthorizedAdminEmail(), '');

    assert.equal(isAuthorizedClerkAdmin(null), false);
    assert.equal(isAuthorizedClerkAdmin('viewer@anidub.in'), false);
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'user_regular123',
        primaryEmailAddress: { emailAddress: 'viewer@anidub.in' },
      }),
      false
    );

    process.env.ADMIN_EMAIL = 'configured-admin@example.com';
    assert.equal(getAuthorizedAdminEmail(), 'configured-admin@example.com');

    assert.equal(isAuthorizedClerkAdmin(null), false);
    assert.equal(isAuthorizedClerkAdmin('viewer@anidub.in'), false);
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'user_regular123',
        primaryEmailAddress: { emailAddress: 'viewer@anidub.in' },
      }),
      false
    );
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'guest',
        primaryEmailAddress: { emailAddress: 'configured-admin@example.com' },
      }),
      false
    );
    // Unverified or missing verification must be rejected even if email matches ADMIN_EMAIL
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'user_admin_clerk_unverified_missing',
        primaryEmailAddress: { emailAddress: 'configured-admin@example.com' },
      }),
      false
    );
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'user_admin_clerk_unverified',
        primaryEmailAddress: {
          emailAddress: 'configured-admin@example.com',
          verification: { status: 'unverified' },
        },
      }),
      false
    );
    // Verified secondary email cannot escalate when primary email is different
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'user_secondary_attempt',
        primaryEmailAddressId: 'email_1',
        emailAddresses: [
          { id: 'email_1', emailAddress: 'viewer@anidub.in', verification: { status: 'verified' } },
          { id: 'email_2', emailAddress: 'configured-admin@example.com', verification: { status: 'verified' } },
        ],
      }),
      false
    );
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'user_admin_clerk_1',
        primaryEmailAddress: {
          emailAddress: 'configured-admin@example.com',
          verification: { status: 'verified' },
        },
      }),
      true
    );
  } finally {
    if (originalAdminEmail === undefined) {
      delete process.env.ADMIN_EMAIL;
    } else {
      process.env.ADMIN_EMAIL = originalAdminEmail;
    }
  }
});

test('Security Audit 3: Backend getAuth() & auth() cryptographically verify JWTs and never trust client body or custom headers', async () => {
  process.env.ADMIN_EMAIL = 'configured-admin@example.com';

  const spoofedReq = {
    headers: {
      'x-clerk-user-id': 'user_admin_clerk_1',
      'x-clerk-user-email': 'configured-admin@example.com',
      'x-user-id': 'user_admin_clerk_1',
      'x-admin-token': 'local_admin_session',
    },
    body: {
      userId: 'user_admin_clerk_1',
      user_id: 'user_admin_clerk_1',
      clerk_user_id: 'user_admin_clerk_1',
      email: 'configured-admin@example.com',
      clerk_email: 'configured-admin@example.com',
    },
  };

  assert.equal(extractClerkJwtFromRequest(spoofedReq), null);
  const spoofedSession = await getAuth(spoofedReq);
  assert.equal(spoofedSession.authenticated, false);
  assert.equal(spoofedSession.userId, null);
  assert.equal(spoofedSession.isAdmin, false);
});

function readCombinedEdgeRouteCode(): string {
  const files: string[] = [path.join(process.cwd(), 'functions/api/[[route]].ts')];
  const routesDir = path.join(process.cwd(), 'src/server/routes');
  if (fs.existsSync(routesDir)) {
    for (const entry of fs.readdirSync(routesDir)) {
      if (entry.endsWith('.ts')) {
        files.push(path.join(routesDir, entry));
      }
    }
  }
  return files.map((filePath) => fs.readFileSync(filePath, 'utf-8')).join('\n');
}

test('Security Audit 4: ImgBB API key & hardcoded credentials are not exposed in source code, and routes enforce auth', () => {
  const routeModulesDir = path.join(process.cwd(), 'src/server/routes');
  const routeModuleFiles = fs.existsSync(routeModulesDir)
    ? fs
        .readdirSync(routeModulesDir)
        .filter((name) => name.endsWith('.ts'))
        .map((name) => path.join('src/server/routes', name))
    : [];

  const filesToScan = [
    'src/utils/imgbb.ts',
    'src/utils/auth.ts',
    'src/lib/clerk.tsx',
    'src/App.tsx',
    'src/components/Navbar.tsx',
    'src/components/AdminLoginModal.tsx',
    'src/services/cloudflareApi.ts',
    'functions/api/[[route]].ts',
    ...routeModuleFiles,
  ];

  for (const relPath of filesToScan) {
    const fullPath = path.join(process.cwd(), relPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    assert.equal(
      content.includes('Ee6b4e37ae9c228c29b8448483b6591b'),
      false,
      `Exposed ImgBB key found in ${relPath}`
    );
    assert.equal(
      content.includes('prasanth123'),
      false,
      `Hardcoded admin password found in ${relPath}`
    );
    assert.equal(
      content.includes('prasanth01236'),
      false,
      `Hardcoded fallback admin email found in ${relPath}`
    );
    assert.equal(
      content.includes('local_admin_session'),
      false,
      `Fake admin token found in ${relPath}`
    );
  }

  const edgeRouteCode = readCombinedEdgeRouteCode();
  assert.ok(edgeRouteCode.includes('env.IMGBB_API_KEY'));
  assert.ok(edgeRouteCode.includes('await getAuth(request, env)'));
  assert.ok(edgeRouteCode.includes("path === '/api/upload'"));
  assert.ok(edgeRouteCode.includes("path === '/api/anime'"));
});

test('Security Audit 5: D1 Database Security (No raw client SQL) & User Actions extract userId strictly from session', () => {
  const edgeRouteCode = readCombinedEdgeRouteCode();
  const apiClientCode = fs.readFileSync(path.join(process.cwd(), 'src/services/cloudflareApi.ts'), 'utf-8');

  assert.equal(
    edgeRouteCode.includes('env.DB.prepare(body.sql)'),
    false,
    'API routes must never execute raw client SQL via env.DB.prepare(body.sql)'
  );
  assert.equal(
    apiClientCode.includes('JSON.stringify({ sql })'),
    false,
    'cloudflareApi.ts must not send raw SQL strings to the backend'
  );
  assert.ok(
    edgeRouteCode.includes('if (body.sql !== undefined)'),
    'API D1 query endpoint must explicitly reject raw sql payloads'
  );
  assert.ok(edgeRouteCode.includes("getAuth(request, env)"));

  assert.equal(
    edgeRouteCode.includes("WHERE id = 'default_user'"),
    false,
    'API routes must not hardcode default_user for user profiles'
  );
  assert.equal(
    apiClientCode.includes("'x-user-id'"),
    false,
    'cloudflareApi.ts must not send spoofable x-user-id headers'
  );
  assert.equal(
    apiClientCode.includes("'x-clerk-user-id'"),
    false,
    'cloudflareApi.ts must not send spoofable x-clerk-user-id headers'
  );
});

test('Security Audit 6: Cloudflare Pages Functions, env bindings & Feedback Protection', async () => {
  const authCode = fs.readFileSync(path.join(process.cwd(), 'src/utils/auth.ts'), 'utf-8');
  const edgeRouteCode = readCombinedEdgeRouteCode();

  assert.equal(
    authCode.includes('process.env.'),
    false,
    'src/utils/auth.ts must use Cloudflare env bindings instead of direct process.env.* access'
  );
  assert.equal(
    edgeRouteCode.includes('process.env'),
    false,
    'API route handlers must use Cloudflare env bindings instead of process.env'
  );
  assert.equal(
    getAuthorizedAdminEmail({ ADMIN_EMAIL: 'cf-admin@anidub.in' }),
    'cf-admin@anidub.in'
  );
  assert.equal(
    isAuthorizedClerkAdmin({ email: 'cf-admin@anidub.in', email_verified: false }, { ADMIN_EMAIL: 'cf-admin@anidub.in' }),
    false
  );
  assert.equal(
    isAuthorizedClerkAdmin({ email: 'cf-admin@anidub.in', email_verified: true }, { ADMIN_EMAIL: 'cf-admin@anidub.in' }),
    true
  );

  const { validateAndRateLimitFeedback } = await import('./auth');
  const testStore = new Map();

  const shortRes = validateAndRateLimitFeedback({ name: 'Test', feedback: 'hi' }, '10.0.0.1', { store: testStore });
  assert.equal(shortRes.ok, false);
  assert.equal(shortRes.status, 400);

  const honeypotRes = validateAndRateLimitFeedback(
    { name: 'Bot', feedback: 'Valid length feedback message', website: 'http://spam.com' },
    '10.0.0.1',
    { store: testStore }
  );
  assert.equal(honeypotRes.ok, false);
  assert.equal(honeypotRes.status, 400);

  const linkSpamRes = validateAndRateLimitFeedback(
    { name: 'Spammer', feedback: 'Check https://a.com and https://b.com and https://c.com now!' },
    '10.0.0.1',
    { store: testStore }
  );
  assert.equal(linkSpamRes.ok, false);
  assert.equal(linkSpamRes.status, 400);

  const badEmailRes = validateAndRateLimitFeedback(
    { name: 'User', email: 'not-an-email', feedback: 'Please add Naruto Tamil dub episodes!' },
    '10.0.0.1',
    { store: testStore }
  );
  assert.equal(badEmailRes.ok, false);
  assert.equal(badEmailRes.status, 400);

  for (let i = 1; i <= 3; i++) {
    const okRes = validateAndRateLimitFeedback(
      { name: 'AnimeFan', email: 'fan@example.com', feedback: `Great Tamil dub quality on episode ${i}!` },
      '10.0.0.2',
      { store: testStore }
    );
    assert.equal(okRes.ok, true);
  }
  const rateLimitedRes = validateAndRateLimitFeedback(
    { name: 'AnimeFan', email: 'fan@example.com', feedback: 'Fourth message within window should be rate limited!' },
    '10.0.0.2',
    { store: testStore }
  );
  assert.equal(rateLimitedRes.ok, false);
  assert.equal(rateLimitedRes.status, 429);
});

test('Security Audit 7: Strict origin allowlist, authorizedParties, /api/config runtime Clerk key & /api/admin/verify enforcement', async () => {
  const { isApprovedOrigin, buildAuthorizedParties } = await import('./auth');

  assert.equal(isApprovedOrigin('http://localhost:3000'), true);
  assert.equal(isApprovedOrigin('https://anidub.in'), true);
  assert.equal(isApprovedOrigin('https://www.anidub.in'), true);
  assert.equal(isApprovedOrigin('https://anidub-india.pages.dev'), true);
  assert.equal(isApprovedOrigin('https://anidub-india.samayaprasanth0.workers.dev'), true);
  assert.equal(isApprovedOrigin('https://anidub-api.samayaprasanth0.workers.dev'), true);
  // Broad suffix wildcards MUST be rejected unless explicitly listed in env.ALLOWED_ORIGINS
  assert.equal(isApprovedOrigin('https://anidub-india.myaccount.workers.dev'), false);
  assert.equal(isApprovedOrigin('https://attacker.pages.dev'), false);
  assert.equal(isApprovedOrigin('https://evil.workers.dev'), false);
  assert.equal(isApprovedOrigin('https://evil.run.app'), false);
  assert.equal(isApprovedOrigin('https://sub.anidub.in'), false);
  assert.equal(isApprovedOrigin('https://evil.com'), false);
  assert.equal(isApprovedOrigin('https://pages.dev.evil.com'), false);
  assert.equal(isApprovedOrigin('https://anidub.in.evil.com'), false);
  assert.equal(
    isApprovedOrigin('https://staging.anidub.in', { ALLOWED_ORIGINS: 'https://staging.anidub.in' }),
    true
  );

  const parties = buildAuthorizedParties(
    { url: 'https://anidub-india.myaccount.workers.dev/api/config', headers: new Headers({ Origin: 'https://evil.com' }) },
    { ALLOWED_ORIGINS: 'https://staging.anidub.in' }
  );
  assert.equal(parties.includes('https://anidub-india.myaccount.workers.dev'), false);
  assert.ok(parties.includes('https://staging.anidub.in'));
  assert.ok(parties.includes('https://anidub.in'));
  assert.equal(parties.includes('https://evil.com'), false);

  const { onRequest } = await import('../../functions/api/[[route]]');
  const mockEnv = {
    DB: null,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Y2xlcmsuYW5pZHViLmluJA',
    CLERK_SECRET_KEY: 'sk_test_super_secret_should_never_leak',
    ADMIN_EMAIL: 'secret-admin@anidub.in',
    IMGBB_API_KEY: 'imgbb_secret_never_leak',
  };

  const configRes = await onRequest({
    request: new Request('https://anidub-india.samayaprasanth0.workers.dev/api/config', {
      headers: { Origin: 'https://anidub-india.samayaprasanth0.workers.dev' },
    }),
    env: mockEnv,
  });
  assert.equal(configRes.status, 200);
  assert.equal(configRes.headers.get('Access-Control-Allow-Origin'), 'https://anidub-india.samayaprasanth0.workers.dev');
  const configText = await configRes.text();
  const configJson = JSON.parse(configText);
  assert.equal(configJson.clerkPublishableKey, 'pk_test_Y2xlcmsuYW5pZHViLmluJA');
  assert.equal(configJson.authenticated, false);
  assert.equal(configJson.isAdmin, false);
  assert.equal(configText.includes('sk_test_super_secret_should_never_leak'), false);
  assert.equal(configText.includes('imgbb_secret_never_leak'), false);
  assert.equal(configText.includes('secret-admin@anidub.in'), false);

  const evilCorsRes = await onRequest({
    request: new Request('https://anidub.in/api/auth-config', {
      headers: { Origin: 'https://evil.com' },
    }),
    env: mockEnv,
  });
  assert.equal(evilCorsRes.headers.get('Access-Control-Allow-Origin'), 'https://anidub.in');

  const verifyUnauth = await onRequest({
    request: new Request('https://anidub.in/api/admin/verify'),
    env: mockEnv,
  });
  assert.equal(verifyUnauth.status, 401);

  const loginUnauth = await onRequest({
    request: new Request('https://anidub.in/api/admin/login', { method: 'POST' }),
    env: mockEnv,
  });
  assert.equal(loginUnauth.status, 401);

  const pendingLeakRes = await onRequest({
    request: new Request('https://anidub.in/api/anime?includePending=true'),
    env: mockEnv,
  });
  assert.equal(pendingLeakRes.status, 401);
});

test('Security Audit 8: Vite envPrefix, runtime /api/config Clerk fallback, unified edge entry-point, and self-building wrangler.toml', async () => {
  const viteConfig = fs.readFileSync(path.join(process.cwd(), 'vite.config.ts'), 'utf-8');
  assert.ok(viteConfig.includes("envPrefix: ['VITE_', 'NEXT_PUBLIC_']"));
  assert.ok(viteConfig.includes('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'));
  assert.ok(viteConfig.includes('VITE_CLERK_PUBLISHABLE_KEY'));

  const clerkLib = fs.readFileSync(path.join(process.cwd(), 'src/lib/clerk.tsx'), 'utf-8');
  assert.ok(clerkLib.includes('/api/config'));
  assert.ok(clerkLib.includes('/api/auth-config'));

  const wranglerToml = fs.readFileSync(path.join(process.cwd(), 'wrangler.toml'), 'utf-8');
  assert.equal(wranglerToml.includes('main ='), false);
  assert.equal(wranglerToml.includes('[assets]'), false);
  assert.equal(wranglerToml.includes('[build]'), false);
  assert.ok(wranglerToml.includes('compatibility_date = "2025-03-20"'));
  assert.ok(wranglerToml.includes('pages_build_output_dir = "dist"'));
  assert.ok(wranglerToml.includes('database_name = "anime-db"'));
  assert.ok(wranglerToml.includes('database_id = "75f053ab-5b44-4d48-abf8-b3a357a89426"'));

  const wranglerChatToml = fs.readFileSync(path.join(process.cwd(), 'wrangler.chat.toml'), 'utf-8');
  assert.ok(wranglerChatToml.includes('name = "anime-chat"'));
  assert.ok(wranglerChatToml.includes('main = "src/edge-entry.ts"'));
  assert.ok(wranglerChatToml.includes('name = "CHAT_ROOM"'));
  assert.ok(wranglerChatToml.includes('class_name = "ChatRoom"'));
  assert.ok(wranglerChatToml.includes('new_sqlite_classes = ["ChatRoom"]'));

  const wranglerApiToml = fs.readFileSync(path.join(process.cwd(), 'wrangler.api.toml'), 'utf-8');
  assert.ok(wranglerApiToml.includes('# Force update for anidub-apiii deployment'));
  assert.ok(wranglerApiToml.includes('name = "anidub-apiii"'));
  assert.ok(wranglerApiToml.includes('main = "src/edge-entry.ts"'));
  assert.ok(wranglerApiToml.includes('database_name = "anime-db"'));
  assert.ok(wranglerApiToml.includes('database_id = "75f053ab-5b44-4d48-abf8-b3a357a89426"'));

  const pkgJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  assert.equal(pkgJson.scripts.build, 'vite build');
  assert.equal(pkgJson.scripts.deploy, 'wrangler pages deploy dist');
  assert.equal(pkgJson.scripts['deploy:chat'], 'wrangler deploy -c wrangler.chat.toml');
  assert.equal(pkgJson.scripts['deploy:api'], 'wrangler deploy -c wrangler.api.toml');

  const edgeEntryModule = await import('../edge-entry');
  let assetsFetched = false;
  const assetRes = await edgeEntryModule.default.fetch(
    new Request('https://anidub.in/admin'),
    {
      DB: null,
      ASSETS: {
        fetch: async () => {
          assetsFetched = true;
          return new Response('<html>SPA</html>', { status: 200 });
        },
      },
    }
  );
  assert.equal(assetsFetched, true);
  assert.equal(assetRes.status, 200);

  const apiRes = await edgeEntryModule.default.fetch(
    new Request('https://anidub.in/api/config'),
    {
      DB: null,
      VITE_CLERK_PUBLISHABLE_KEY: 'pk_live_dGVzdC5hbmkuY29tJA',
    }
  );
  assert.equal(apiRes.status, 200);
  const apiJson: any = await apiRes.json();
  assert.equal(apiJson.clerkPublishableKey, 'pk_live_dGVzdC5hbmkuY29tJA');

  // Verify ChatRoom Durable Object class is explicitly exported from edge-entry.ts
  assert.equal(typeof edgeEntryModule.ChatRoom, 'function');
  const roomInstance = new edgeEntryModule.ChatRoom({}, {});
  const roomStatusRes = await roomInstance.fetch(new Request('https://anidub.in/ws'));
  assert.equal(roomStatusRes.status, 200);
  const roomStatusJson: any = await roomStatusRes.json();
  assert.equal(roomStatusJson.durableObject, 'ChatRoom');

  // Verify VITE_ADMIN_EMAIL and quoted ADMIN_EMAIL in env bindings are resolved
  assert.equal(getAuthorizedAdminEmail({ VITE_ADMIN_EMAIL: 'vite-admin@anidub.in' }), 'vite-admin@anidub.in');
  assert.equal(getAuthorizedAdminEmail({ ADMIN_EMAIL: '"quoted-admin@anidub.in"' }), 'quoted-admin@anidub.in');

  // Verify /api/admin/verify returns detailed error when CLERK_SECRET_KEY is missing in env bindings
  const missingKeyRes = await edgeEntryModule.default.fetch(
    new Request('https://anidub.in/api/admin/verify'),
    { DB: null }
  );
  assert.equal(missingKeyRes.status, 401);
  const missingKeyJson: any = await missingKeyRes.json();
  assert.ok(missingKeyJson.error.includes('Missing CLERK_SECRET_KEY in env bindings'));

  // Verify /api/admin/verify returns detailed error when token is missing
  const missingTokenRes = await edgeEntryModule.default.fetch(
    new Request('https://anidub.in/api/admin/verify'),
    {
      DB: null,
      CLERK_SECRET_KEY: 'sk_test_example',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Y2xlcmsuYW5pZHViLmluJA',
      ADMIN_EMAIL: 'admin@anidub.in',
    }
  );
  assert.equal(missingTokenRes.status, 401);
  const missingTokenJson: any = await missingTokenRes.json();
  assert.ok(missingTokenJson.error.includes('Missing Clerk session token'));

  // Verify App.tsx and AdminLoginModal.tsx fetch token via useAuth().getToken(), pass Authorization: Bearer ${token}, and display Backend Error: ${backendError}
  const appCode = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
  const modalCode = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminLoginModal.tsx'), 'utf-8');
  assert.ok(appCode.includes('const { getToken } = useAuth()'));
  assert.ok(appCode.includes('Authorization: `Bearer ${token}`'));
  assert.ok(appCode.includes('`Backend Error: ${backendError}`'));
  assert.equal(appCode.includes('Unauthorized: Valid Clerk Admin session required'), false);
  assert.ok(modalCode.includes('const { getToken } = useAuth()'));
  assert.ok(modalCode.includes('Authorization: `Bearer ${token}`'));
  assert.ok(modalCode.includes('`Backend Error: ${backendError}`'));
});

