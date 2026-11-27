import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  computeSourceHash,
  computeTranslationCoverage,
  isTranslationOutdated,
  mergePublishedTranslation,
  validateTranslationPayload,
  type AnimeTranslationRecord,
} from '../src/utils/animeTranslations';
import {
  buildAnimeJsonLd,
  buildAnimeSeoMeta,
  buildDynamicSitemapXml,
  buildHreflangAlternates,
  resolveAnimeSeoResponse,
  type HTMLRewriterElementLike,
  type HTMLRewriterHandlerLike,
  type HTMLRewriterLike,
} from '../src/utils/seoMeta';
import { onRequest as handleApiRequest } from '../functions/api/[[route]]';
import { onRequest as handleSitemapRequest } from '../functions/sitemap.xml';

const ROOT_DIR = process.cwd();

/**
 * Lightweight D1 adapter backed by Node's built-in in-memory SQLite (`node:sqlite`)
 * so we can run authentic end-to-end API, migration, and fallback tests.
 */
function createSqliteD1Adapter(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const bound: unknown[] = [];
      const stmt = db.prepare(sql);
      const runner = {
        bind(...values: unknown[]) {
          bound.length = 0;
          bound.push(...values);
          return runner;
        },
        async first<T = Record<string, unknown>>() {
          const row = stmt.get(...(bound as any[]));
          return (row ?? null) as T | null;
        },
        async all<T = Record<string, unknown>>() {
          const rows = stmt.all(...(bound as any[]));
          return { results: rows as T[] };
        },
        async run() {
          const info = stmt.run(...(bound as any[]));
          return {
            success: true,
            meta: {
              changes: Number(info.changes ?? 0),
              last_row_id: Number(info.lastInsertRowid ?? 0),
            },
          };
        },
      };
      return runner;
    },
  };
}

function createMigratedSqliteDb(options: { includeTranslationsMigration?: boolean } = {}) {
  const { includeTranslationsMigration = true } = options;
  const db = new DatabaseSync(':memory:');
  const migrationsDir = path.join(ROOT_DIR, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    if (!includeTranslationsMigration && file === '002_anime_translations.sql') continue;
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  return db;
}

function seedSampleAnime(db: DatabaseSync) {
  db.prepare(
    `INSERT INTO anime (id, title, slug, synopsis, cover_image, banner_image, languages, platform, year, rating, type, status, is_published, popularity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    101,
    'Demon Slayer: Kimetsu no Yaiba',
    'demon-slayer',
    'Tanjiro sets out to become a demon slayer after his family is slaughtered.',
    'https://cdn.anidub.in/demon-slayer.jpg',
    'https://cdn.anidub.in/demon-slayer-banner.jpg',
    'Hindi, Tamil, Telugu',
    'Crunchyroll',
    2019,
    8.7,
    'TV Series',
    'Completed',
    1,
    950
  );
  db.prepare(
    `INSERT INTO anime (id, title, slug, synopsis, cover_image, banner_image, languages, platform, year, rating, type, status, is_published, popularity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    102,
    'Unpublished Draft Anime',
    'draft-anime',
    'Internal unpublished entry.',
    'https://cdn.anidub.in/draft.jpg',
    'https://cdn.anidub.in/draft-banner.jpg',
    'Hindi',
    'Netflix',
    2026,
    7.0,
    'TV Series',
    'pending',
    0,
    10
  );
}

/**
 * Minimal MockHTMLRewriter supporting <head>.append() + standard SEO tags
 */
class HeadAwareMockHTMLRewriter implements HTMLRewriterLike {
  private handlers: Array<{ selector: string; handler: HTMLRewriterHandlerLike }> = [];

  on(selector: string, handler: HTMLRewriterHandlerLike): HTMLRewriterLike {
    this.handlers.push({ selector, handler });
    return this;
  }

  transform(response: Response): Response {
    const handlers = this.handlers;
    const stream = new ReadableStream({
      async start(controller) {
        let html = await response.text();
        for (const { selector, handler } of handlers) {
          if (!handler.element) continue;
          if (selector === 'html') {
            handler.element({
              setAttribute(name, value) {
                html = html.replace(/<html\b([^>]*)>/i, `<html$1 ${name}="${value}">`);
              },
              setInnerContent() {},
            });
          } else if (selector === 'title') {
            handler.element({
              setAttribute() {},
              setInnerContent(content) {
                html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${content}</title>`);
              },
            });
          } else if (selector === 'meta[name="description"]') {
            handler.element({
              setAttribute(_name, value) {
                html = html.replace(
                  /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
                  `<meta name="description" content="${value}" />`
                );
              },
              setInnerContent() {},
            });
          } else if (selector === 'link[rel="canonical"]') {
            handler.element({
              setAttribute(_name, value) {
                html = html.replace(
                  /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
                  `<link rel="canonical" href="${value}" />`
                );
              },
              setInnerContent() {},
            });
          } else if (selector === 'script[type="application/ld+json"]') {
            handler.element({
              setAttribute() {},
              setInnerContent(content) {
                html = html.replace(
                  /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
                  `<script type="application/ld+json">${content}</script>`
                );
              },
            });
          } else if (selector === 'head') {
            handler.element({
              setAttribute() {},
              setInnerContent() {},
              append(content) {
                html = html.replace(/<\/head>/i, `${content}</head>`);
              },
            } as HTMLRewriterElementLike);
          }
        }
        controller.enqueue(new TextEncoder().encode(html));
        controller.close();
      },
    });
    return new Response(stream, { status: response.status, headers: response.headers });
  }
}

test('002_anime_translations.sql is idempotent and enforces unique (anime_id, locale) & status CHECK constraints', () => {
  const db = createMigratedSqliteDb({ includeTranslationsMigration: true });
  const migrationSql = fs.readFileSync(
    path.join(ROOT_DIR, 'migrations', '002_anime_translations.sql'),
    'utf8'
  );
  // Running twice must not fail (IF NOT EXISTS idempotency)
  db.exec(migrationSql);

  // Verify indexes exist
  const indexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='anime_translations'")
    .all() as Array<{ name: string }>;
  const idxNames = indexes.map((r) => r.name);
  assert.ok(idxNames.includes('idx_anime_translations_locale_status'));
  assert.ok(idxNames.includes('idx_anime_translations_anime_id'));

  // Insert valid translation
  db.prepare(
    `INSERT INTO anime_translations (anime_id, locale, localized_title, synopsis, translation_status)
     VALUES (?, ?, ?, ?, ?)`
  ).run('101', 'ta', 'டீமன் ஸ்லேயர்', 'தமிழ் சுருக்கம்', 'draft');

  // Duplicate (anime_id, locale) must fail UNIQUE constraint
  assert.throws(() => {
    db.prepare(
      `INSERT INTO anime_translations (anime_id, locale, synopsis, translation_status)
       VALUES (?, ?, ?, ?)`
    ).run('101', 'ta', 'Duplicate row', 'draft');
  });

  // Invalid translation_status must fail CHECK constraint
  assert.throws(() => {
    db.prepare(
      `INSERT INTO anime_translations (anime_id, locale, synopsis, translation_status)
       VALUES (?, ?, ?, ?)`
    ).run('101', 'hi', 'Invalid status', 'archived');
  });

  db.close();
});

test('Pure translation helpers validate payloads, compute deterministic source hashes, and never leak drafts', () => {
  const hash1 = computeSourceHash('Naruto', 'A young ninja seeks recognition.');
  const hash2 = computeSourceHash('Naruto  ', 'A young ninja   seeks recognition.');
  const hash3 = computeSourceHash('Naruto', 'Updated English synopsis.');
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
  assert.equal(isTranslationOutdated(hash1, hash2), false);
  assert.equal(isTranslationOutdated(hash1, hash3), true);

  // Payload validation rejects 'en' or empty fields
  const badEn = validateTranslationPayload({ anime_id: '101', locale: 'en', synopsis: 'hello' });
  assert.equal(badEn.ok, false);
  const badEmpty = validateTranslationPayload({ anime_id: '101', locale: 'ta' });
  assert.equal(badEmpty.ok, false);

  const validRes = validateTranslationPayload({
    anime_id: '101',
    locale: 'TA',
    localized_title: 'டீமன் ஸ்லேயர்',
    synopsis: 'தமிழ் சுருக்கம்',
    translation_status: 'published',
  });
  assert.equal(validRes.ok, true);
  if (validRes.ok) {
    assert.equal(validRes.data.locale, 'ta');
  }

  // mergePublishedTranslation MUST NOT expose draft/reviewed rows and MUST keep English title/synopsis intact
  const baseAnime = {
    id: 101,
    title: 'Demon Slayer',
    synopsis: 'Original English synopsis',
  };
  const draftRow: AnimeTranslationRecord = {
    id: 1,
    anime_id: '101',
    locale: 'ta',
    localized_title: 'Draft Title',
    synopsis: 'Draft Synopsis',
    description: null,
    source_hash: hash1,
    translation_status: 'draft',
    updated_at: '',
  };
  const mergedDraft = mergePublishedTranslation(baseAnime, draftRow, 'ta');
  assert.equal(mergedDraft.has_published_translation, false);
  assert.equal(mergedDraft.localized_synopsis, null);
  assert.equal(mergedDraft.title, 'Demon Slayer');
  assert.equal(mergedDraft.synopsis, 'Original English synopsis');

  const publishedRow: AnimeTranslationRecord = { ...draftRow, translation_status: 'published' };
  const mergedPub = mergePublishedTranslation(baseAnime, publishedRow, 'ta');
  assert.equal(mergedPub.has_published_translation, true);
  assert.equal(mergedPub.localized_synopsis, 'Draft Synopsis');
  assert.equal(mergedPub.title, 'Demon Slayer');
  assert.equal(mergedPub.synopsis, 'Original English synopsis');

  // Coverage stats calculation
  const coverage = computeTranslationCoverage(
    [
      { id: '101', title: 'Naruto', synopsis: 'A young ninja seeks recognition.' },
      { id: '102', title: 'Naruto', synopsis: 'Updated English synopsis.' },
    ],
    [
      {
        anime_id: '101',
        locale: 'ta',
        localized_title: null,
        synopsis: 'தமிழ் சுருக்கம்',
        description: null,
        translation_status: 'published',
        source_hash: hash1,
      },
      {
        anime_id: '102',
        locale: 'ta',
        localized_title: null,
        synopsis: 'டிராஃப்ட்',
        description: null,
        translation_status: 'draft',
        source_hash: hash1,
      },
    ]
  );
  const taStat = coverage.find((c) => c.locale === 'ta');
  assert.ok(taStat);
  assert.equal(taStat.totalAnime, 2);
  assert.equal(taStat.published, 1);
  assert.equal(taStat.draft, 1);
  assert.equal(taStat.missing, 0);
  assert.equal(taStat.outdated, 1);
  assert.equal(taStat.percentPublished, 50);
});

test('API routes enforce admin auth, isolate English catalog data, and gracefully fall back when unmigrated', async () => {
  // 1. Unmigrated DB: public GET /api/anime?locale=ta & GET /api/anime/101/translations must gracefully fall back to English
  const unmigratedDb = createMigratedSqliteDb({ includeTranslationsMigration: false });
  seedSampleAnime(unmigratedDb);
  const unmigratedEnv = { DB: createSqliteD1Adapter(unmigratedDb) };

  const publicCatalogRes = await handleApiRequest({
    request: new Request('https://anidub.in/api/anime?locale=ta&limit=12'),
    env: unmigratedEnv,
  } as any);
  assert.equal(publicCatalogRes.status, 200);
  const publicCatalogJson = (await publicCatalogRes.json()) as any;
  assert.equal(publicCatalogJson.data.length, 1);
  assert.equal(publicCatalogJson.data[0].title, 'Demon Slayer: Kimetsu no Yaiba');
  assert.equal(publicCatalogJson.data[0].has_published_translation, false);

  const publicTrRes = await handleApiRequest({
    request: new Request('https://anidub.in/api/anime/101/translations?locale=ta'),
    env: unmigratedEnv,
  } as any);
  assert.equal(publicTrRes.status, 200);
  const publicTrJson = (await publicTrRes.json()) as any;
  assert.equal(publicTrJson.success, true);
  assert.equal(publicTrJson.translation, null);
  unmigratedDb.close();

  // 2. Migrated DB: test Admin auth guard (401 without token) and public published-only overlay
  const db = createMigratedSqliteDb({ includeTranslationsMigration: true });
  seedSampleAnime(db);
  const env = { DB: createSqliteD1Adapter(db) };

  const unauthAdminGet = await handleApiRequest({
    request: new Request('https://anidub.in/api/admin/translations'),
    env,
  } as any);
  assert.equal(unauthAdminGet.status, 401);

  const unauthAdminPut = await handleApiRequest({
    request: new Request('https://anidub.in/api/admin/translations/101/ta', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ synopsis: 'Unauthorized attempt' }),
    }),
    env,
  } as any);
  assert.equal(unauthAdminPut.status, 401);

  // Seed one draft (hi) and one published (ta) translation directly
  db.prepare(
    `INSERT INTO anime_translations (anime_id, locale, localized_title, synopsis, description, translation_status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('101', 'hi', 'डीमन स्लेयर', 'ड्राफ्ट हिंदी सारांश', null, 'draft');
  db.prepare(
    `INSERT INTO anime_translations (anime_id, locale, localized_title, synopsis, description, translation_status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('101', 'ta', 'டீமன் ஸ்லேயர்', 'தன்ஜிரோவின் தமிழ் சுருக்கம்.', 'தமிழ் மெட்டா விளக்கம்', 'published');

  // Public detail endpoint for Hindi (draft) MUST NOT leak draft
  const hiDetailRes = await handleApiRequest({
    request: new Request('https://anidub.in/api/anime/101?locale=hi'),
    env,
  } as any);
  assert.equal(hiDetailRes.status, 200);
  const hiDetailJson = (await hiDetailRes.json()) as any;
  assert.equal(hiDetailJson.has_published_translation, false);
  assert.equal(hiDetailJson.localized_synopsis, null);
  assert.equal(hiDetailJson.synopsis, 'Tanjiro sets out to become a demon slayer after his family is slaughtered.');

  // Public detail endpoint for Tamil (published) returns non-destructive overlay while keeping English intact
  const taDetailRes = await handleApiRequest({
    request: new Request('https://anidub.in/api/anime/101?locale=ta'),
    env,
  } as any);
  assert.equal(taDetailRes.status, 200);
  const taDetailJson = (await taDetailRes.json()) as any;
  assert.equal(taDetailJson.has_published_translation, true);
  assert.equal(taDetailJson.localized_title, 'டீமன் ஸ்லேயர்');
  assert.equal(taDetailJson.localized_synopsis, 'தன்ஜிரோவின் தமிழ் சுருக்கம்.');
  assert.equal(taDetailJson.title, 'Demon Slayer: Kimetsu no Yaiba');
  assert.equal(taDetailJson.synopsis, 'Tanjiro sets out to become a demon slayer after his family is slaughtered.');

  db.close();
});

test('Multilingual SEO builds hreflang alternates, localized SSR HTMLRewriter tags, JSON-LD alternateName, and xhtml:link sitemap', async () => {
  const alts = buildHreflangAlternates('https://anidub.in/anime/demon-slayer?lang=ta');
  assert.equal(alts[0].hreflang, 'x-default');
  assert.equal(alts[0].href, 'https://anidub.in/anime/demon-slayer');
  assert.ok(alts.some((a) => a.hreflang === 'en-IN' && a.href === 'https://anidub.in/anime/demon-slayer'));
  assert.ok(alts.some((a) => a.hreflang === 'ta-IN' && a.href === 'https://anidub.in/anime/demon-slayer?lang=ta'));
  assert.ok(alts.some((a) => a.hreflang === 'bn-IN' && a.href === 'https://anidub.in/anime/demon-slayer?lang=bn'));

  // JSON-LD preserves official English name and adds alternateName for published localized title
  const jsonLd = JSON.parse(
    buildAnimeJsonLd(
      {
        id: 101,
        slug: 'demon-slayer',
        title: 'Demon Slayer: Kimetsu no Yaiba',
        synopsis: 'English synopsis.',
        languages: 'Hindi, Tamil',
      },
      'https://anidub.in',
      'demon-slayer',
      {
        locale: 'ta',
        translation: {
          locale: 'ta',
          localized_title: 'டீமன் ஸ்லேயர்',
          synopsis: 'தமிழ் சுருக்கம்.',
          translation_status: 'published',
        },
      }
    )
  );
  assert.equal(jsonLd.name, 'Demon Slayer: Kimetsu no Yaiba');
  assert.equal(jsonLd.alternateName, 'டீமன் ஸ்லேயர்');
  assert.equal(jsonLd.description, 'தமிழ் சுருக்கம்.');
  assert.ok(Array.isArray(jsonLd.inLanguage) && jsonLd.inLanguage.includes('ta-IN'));

  // Edge SSR resolveAnimeSeoResponse with live SQLite DB and ?lang=ta
  const db = createMigratedSqliteDb({ includeTranslationsMigration: true });
  seedSampleAnime(db);
  db.prepare(
    `INSERT INTO anime_translations (anime_id, locale, localized_title, synopsis, description, translation_status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('101', 'ta', 'டீமன் ஸ்லேயர்', 'தமிழ் சுருக்கம்.', 'தமிழ் SEO விளக்கம்', 'published');

  const baseHtml = new Response(
    '<!doctype html><html><head><title>Default</title><meta name="description" content="Default" /><link rel="canonical" href="https://anidub.in/" /><script type="application/ld+json">{}</script></head><body></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
  );
  const ssrRes = await resolveAnimeSeoResponse({
    request: new Request('https://anidub.in/anime/demon-slayer?lang=ta'),
    db: createSqliteD1Adapter(db),
    idOrSlug: 'demon-slayer',
    baseHtmlResponse: baseHtml,
    RewriterCtor: HeadAwareMockHTMLRewriter,
  });
  const html = await ssrRes.text();
  assert.match(html, /lang="ta"/);
  assert.match(html, /content="தமிழ் SEO விளக்கம்/);
  assert.match(html, /property="og:locale" content="ta_IN"/);
  assert.match(html, /rel="alternate" hreflang="x-default" href="https:\/\/anidub\.in\/anime\/demon-slayer"/);
  assert.match(html, /rel="alternate" hreflang="ta-IN" href="https:\/\/anidub\.in\/anime\/demon-slayer\?lang=ta"/);

  // Sitemap XML includes xmlns:xhtml and published Tamil alternate (excluding unpublished draft anime)
  const sitemapRes = await handleSitemapRequest({
    request: new Request('https://anidub.in/sitemap.xml'),
    env: { DB: createSqliteD1Adapter(db) },
  });
  assert.equal(sitemapRes.status, 200);
  const xml = await sitemapRes.text();
  assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.match(xml, /<xhtml:link rel="alternate" hreflang="ta-IN" href="https:\/\/anidub\.in\/anime\/demon-slayer\?lang=ta" \/>/);
  assert.doesNotMatch(xml, /draft-anime/);

  // buildAnimeSeoMeta with draft translation falls back to English
  const draftMeta = buildAnimeSeoMeta(
    { id: 101, slug: 'demon-slayer', title: 'Demon Slayer', synopsis: 'English summary' },
    'https://anidub.in',
    'demon-slayer',
    {
      locale: 'hi',
      translation: { locale: 'hi', synopsis: 'Draft Hindi', translation_status: 'draft' },
    }
  );
  assert.equal(draftMeta.htmlLang, 'en');
  assert.match(draftMeta.description, /English summary/);

  // Standalone buildDynamicSitemapXml without translations map still works cleanly
  const simpleXml = buildDynamicSitemapXml([{ id: 1, slug: 'naruto' }], 'https://anidub.in');
  assert.match(simpleXml, /https:\/\/anidub\.in\/anime\/naruto/);

  db.close();
});
