import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  validateServerImageUpload,
  validateExternalImageUrl,
  validateCommunitySubmissionAccount,
  checkAndRecordSubmissionRateLimit,
  validateAndSanitizeCommunitySubmission,
} from '../src/utils/submissionValidation.ts';
import { onRequest } from '../functions/api/[[route]].ts';

// Valid minimal image binary fixtures (magic bytes + padding >= 12 bytes)
const VALID_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const VALID_JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
]);
const VALID_WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function createSignedClerkJwt(sub: string, extraClaims: Record<string, any> = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', cat: 'cl_B7d4PD111AAA' })
  ).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      sid: `sess_${sub}`,
      azp: 'http://localhost:3000',
      exp: nowSec + 300,
      iat: nowSec - 10,
      nbf: nowSec - 10,
      ...extraClaims,
    })
  ).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
  return { token: `${unsigned}.${signature}`, publicPem: publicKey };
}

test('validateServerImageUpload accepts valid PNG, JPEG, and WebP images', () => {
  const png = validateServerImageUpload({
    image: `data:image/png;base64,${toBase64(VALID_PNG_BYTES)}`,
    filename: 'solo-leveling.png',
  });
  assert.equal(png.ok, true);
  assert.equal(png.mimeType, 'image/png');
  assert.equal(png.extension, 'png');
  assert.equal(png.sizeBytes, VALID_PNG_BYTES.length);

  const jpg = validateServerImageUpload({
    image: toBase64(VALID_JPEG_BYTES),
    mimeType: 'image/jpeg',
    filename: 'poster.jpg',
  });
  assert.equal(jpg.ok, true);
  assert.equal(jpg.mimeType, 'image/jpeg');
  assert.equal(jpg.extension, 'jpg');

  const webp = validateServerImageUpload({
    bytes: VALID_WEBP_BYTES,
    mimeType: 'image/webp',
    filename: 'banner.webp',
  });
  assert.equal(webp.ok, true);
  assert.equal(webp.mimeType, 'image/webp');
  assert.equal(webp.extension, 'webp');
});

test('validateServerImageUpload rejects SVG, HTML, mismatched extensions, oversized files, and spoofed magic bytes', () => {
  const svg = validateServerImageUpload({
    image: `data:image/svg+xml;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`,
    filename: 'xss.svg',
  });
  assert.equal(svg.ok, false);
  assert.equal(svg.status, 400);
  assert.match(svg.error || '', /Unsupported image MIME type/);

  const missingMime = validateServerImageUpload({
    image: toBase64(VALID_PNG_BYTES),
    filename: 'poster.png',
  });
  assert.equal(missingMime.ok, false);
  assert.equal(missingMime.status, 400);

  const badExt = validateServerImageUpload({
    image: `data:image/png;base64,${toBase64(VALID_PNG_BYTES)}`,
    filename: 'shell.php',
  });
  assert.equal(badExt.ok, false);
  assert.match(badExt.error || '', /Invalid image file extension/);

  const extMismatch = validateServerImageUpload({
    image: `data:image/jpeg;base64,${toBase64(VALID_JPEG_BYTES)}`,
    filename: 'cover.png',
  });
  assert.equal(extMismatch.ok, false);
  assert.match(extMismatch.error || '', /does not match image MIME type/);

  const spoofedMagic = validateServerImageUpload({
    image: `data:image/png;base64,${Buffer.from('%PDF-1.7 fake image bytes').toString('base64')}`,
    filename: 'document.png',
  });
  assert.equal(spoofedMagic.ok, false);
  assert.match(spoofedMagic.error || '', /binary signature does not match/);

  const oversized = validateServerImageUpload(
    {
      bytes: new Uint8Array(200),
      mimeType: 'image/png',
      filename: 'big.png',
    },
    { maxSizeBytes: 100 }
  );
  assert.equal(oversized.ok, false);
  assert.equal(oversized.status, 413);
});

test('validateExternalImageUrl allows safe HTTPS URLs and blocks HTTP, javascript:, SSRF, and SVG/HTML links', () => {
  assert.equal(
    validateExternalImageUrl('https://i.ibb.co/98W13PY/poster.jpg', { required: true }).ok,
    true
  );
  assert.equal(
    validateExternalImageUrl('https://cdn.myanimelist.net/images/anime/10/47347.jpg').ok,
    true
  );

  for (const badUrl of [
    'http://example.com/poster.jpg',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'https://localhost/poster.png',
    'https://127.0.0.1/poster.png',
    'https://169.254.169.254/latest/meta-data/',
    'https://192.168.0.10/admin.png',
    'https://metadata/secret.png',
    'https://user:pass@example.com/poster.png',
    'https://example.com/payload.svg',
    'https://example.com/index.html',
    'not-a-url',
  ]) {
    const res = validateExternalImageUrl(badUrl, { required: true });
    assert.equal(res.ok, false, `Expected URL to be rejected: ${badUrl}`);
  }
});

test('validateCommunitySubmissionAccount enforces verified email and minimum account age for non-admins', () => {
  const now = 1_700_000_000_000;

  const unverified = validateCommunitySubmissionAccount(
    {
      userId: 'user_1',
      email: 'new@example.com',
      isAdmin: false,
      clerkUser: {
        createdAt: now - 60 * 60 * 1000,
        emailAddresses: [{ emailAddress: 'new@example.com', verification: { status: 'unverified' } }],
      },
    },
    { now }
  );
  assert.equal(unverified.ok, false);
  assert.equal(unverified.status, 403);

  const tooNew = validateCommunitySubmissionAccount(
    {
      userId: 'user_2',
      email: 'fresh@example.com',
      isAdmin: false,
      clerkUser: {
        createdAt: now - 60 * 1000, // 1 min old (< 5 min minimum)
        emailAddresses: [{ emailAddress: 'fresh@example.com', verification: { status: 'verified' } }],
      },
    },
    { now }
  );
  assert.equal(tooNew.ok, false);
  assert.equal(tooNew.status, 403);
  assert.match(tooNew.error || '', /Account too new/);

  const valid = validateCommunitySubmissionAccount(
    {
      userId: 'user_3',
      email: 'aged@example.com',
      isAdmin: false,
      clerkUser: {
        createdAt: now - 10 * 60 * 1000,
        emailAddresses: [{ emailAddress: 'aged@example.com', verification: { status: 'verified' } }],
      },
    },
    { now }
  );
  assert.equal(valid.ok, true);
});

test('checkAndRecordSubmissionRateLimit blocks bursts per user and per IP', async () => {
  const userStore = new Map();
  const ipStore = new Map();
  const now = 1_700_000_000_000;

  for (let i = 1; i <= 3; i++) {
    const ok = await checkAndRecordSubmissionRateLimit({
      userId: 'user_burst',
      clientIp: '203.0.113.10',
      titleSlug: `anime-${i}`,
      now: now + i * 1000,
      userStore,
      ipStore,
    });
    assert.equal(ok.ok, true);
  }

  const blocked = await checkAndRecordSubmissionRateLimit({
    userId: 'user_burst',
    clientIp: '203.0.113.10',
    titleSlug: 'anime-4',
    now: now + 5000,
    userStore,
    ipStore,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 429);
  assert.ok((blocked.retryAfterSeconds || 0) > 0);
});

test('POST /api/upload enforces MIME/extension/magic-bytes and returns real ImgBB URL (never fake fallback)', async () => {
  const { token, publicPem } = createSignedClerkJwt('user_upload_1', { email: 'fan@example.com' });
  const env = {
    CLERK_JWT_KEY: publicPem,
    IMGBB_API_KEY: 'test_imgbb_key',
    ADMIN_EMAIL: 'admin@example.com',
    DB: null as any,
  };

  // 1. Reject disallowed SVG upload
  const badRes = await onRequest({
    request: new Request('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: `data:image/svg+xml;base64,${Buffer.from('<svg></svg>').toString('base64')}`,
        filename: 'evil.svg',
      }),
    }),
    env,
  });
  assert.equal(badRes.status, 400);

  // 2. Accept valid PNG upload & reject fake fallback when ImgBB errors
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      if (String(input).includes('api.imgbb.com')) {
        return new Response(
          JSON.stringify({
            success: true,
            status: 200,
            data: {
              url: 'https://i.ibb.co/w04Pq6b/poster.png',
              display_url: 'https://i.ibb.co/98W13PY/poster.png',
              thumb: { url: 'https://i.ibb.co/2ndCYJK/thumb.png' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected fetch: ${input}`);
    };

    const okRes = await onRequest({
      request: new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: `data:image/png;base64,${toBase64(VALID_PNG_BYTES)}`,
          filename: 'poster.png',
        }),
      }),
      env,
    });
    assert.equal(okRes.status, 200);
    const okJson: any = await okRes.json();
    assert.equal(okJson.success, true);
    assert.equal(okJson.url, 'https://i.ibb.co/w04Pq6b/poster.png');

    // ImgBB failure must return 502 instead of fake i.ibb.co URL
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: false, error: { message: 'Invalid API key' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

    const failRes = await onRequest({
      request: new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: `data:image/png;base64,${toBase64(VALID_PNG_BYTES)}`,
          filename: 'poster.png',
        }),
      }),
      env,
    });
    assert.equal(failRes.status, 502);
    const failJson: any = await failRes.json();
    assert.equal(failJson.success, false);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('POST /api/anime/submit enforces external URL validation, spam checks, duplicate guard, and rate limits', async () => {
  const { token, publicPem } = createSignedClerkJwt('user_submit_rate_test', {
    email: 'member@example.com',
    email_verified: true,
    user_created_at: Date.now() - 60 * 60 * 1000,
  });

  const insertedAnime: { title: string; slug: string }[] = [];
  const submissionLogs: { user_id: string; client_ip: string; title_slug: string; created_at_ms: number }[] = [];

  const mockDb = {
    prepare(sql: string) {
      let bindings: any[] = [];
      return {
        bind(...args: any[]) {
          bindings = args;
          return this;
        },
        async run() {
          if (sql.includes('INSERT INTO community_submission_logs')) {
            submissionLogs.push({
              user_id: bindings[0],
              client_ip: bindings[1],
              title_slug: bindings[2],
              created_at_ms: Number(bindings[3]),
            });
          } else if (sql.includes('INSERT INTO anime')) {
            insertedAnime.push({ title: bindings[0], slug: bindings[1] });
          }
          return { meta: { last_row_id: insertedAnime.length } };
        },
        async first() {
          if (sql.includes('FROM anime WHERE LOWER(title)')) {
            const match = insertedAnime.find(
              (a) => a.title.toLowerCase() === String(bindings[0]).toLowerCase() || a.slug === bindings[1]
            );
            return match ? { id: 1 } : null;
          }
          if (sql.includes('FROM community_submission_logs WHERE user_id')) {
            const matching = submissionLogs.filter(
              (l) => l.user_id === bindings[0] && l.created_at_ms >= Number(bindings[1])
            );
            return {
              total: matching.length,
              oldest: matching[0]?.created_at_ms || null,
            };
          }
          if (sql.includes('FROM community_submission_logs WHERE client_ip')) {
            const matching = submissionLogs.filter(
              (l) => l.client_ip === bindings[0] && l.created_at_ms >= Number(bindings[1])
            );
            return {
              total: matching.length,
              oldest: matching[0]?.created_at_ms || null,
            };
          }
          return null;
        },
      };
    },
  };

  const env = {
    CLERK_JWT_KEY: publicPem,
    ADMIN_EMAIL: 'admin@example.com',
    DB: mockDb,
  };

  // 1. Reject invalid external image URL (http / SSRF / javascript)
  const badUrlRes = await onRequest({
    request: new Request('http://localhost:3000/api/anime/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '198.51.100.42',
      },
      body: JSON.stringify({
        title: 'Valid Title',
        cover_image: 'http://127.0.0.1/ssrf.png',
      }),
    }),
    env,
  });
  assert.equal(badUrlRes.status, 400);

  // 2. Submit 3 valid entries -> all succeed (201)
  for (let i = 1; i <= 3; i++) {
    const res = await onRequest({
      request: new Request('http://localhost:3000/api/anime/submit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '198.51.100.42',
        },
        body: JSON.stringify({
          title: `Legit Regional Dub ${i}`,
          synopsis: 'Great official regional Hindi and Tamil dub release.',
          cover_image: 'https://i.ibb.co/98W13PY/poster.jpg',
          banner_image: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg',
        }),
      }),
      env,
    });
    assert.equal(res.status, 201);
  }

  // 3. Duplicate check -> 409
  const dupRes = await onRequest({
    request: new Request('http://localhost:3000/api/anime/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '198.51.100.42',
      },
      body: JSON.stringify({
        title: 'Legit Regional Dub 1',
        cover_image: 'https://i.ibb.co/98W13PY/poster.jpg',
      }),
    }),
    env,
  });
  assert.equal(dupRes.status, 409);

  // 4. 4th distinct submission within rate-limit window -> 429 Too Many Requests
  const rateLimitedRes = await onRequest({
    request: new Request('http://localhost:3000/api/anime/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '198.51.100.42',
      },
      body: JSON.stringify({
        title: 'Legit Regional Dub 4',
        cover_image: 'https://i.ibb.co/98W13PY/poster.jpg',
      }),
    }),
    env,
  });
  assert.equal(rateLimitedRes.status, 429);
  assert.ok(rateLimitedRes.headers.get('Retry-After'));
});

test('validateAndSanitizeCommunitySubmission blocks honeypots and script injection', () => {
  const bot = validateAndSanitizeCommunitySubmission({
    title: 'Bot Anime',
    website: 'https://spam-link.example.com',
  });
  assert.equal(bot.ok, false);

  const xss = validateAndSanitizeCommunitySubmission({
    title: '<script>alert(1)</script>Naruto',
  });
  assert.equal(xss.ok, false);
});
