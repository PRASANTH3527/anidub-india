import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  applySeoMetaWithHtmlRewriter,
  buildAnimeSeoMeta,
  buildLanguageSeoMeta,
  filterAnimeByLanguage,
  parseLanguageFromPath,
  type HTMLRewriterHandlerLike,
  type HTMLRewriterLike,
} from '../src/utils/seoMeta';
import { onRequest as onAnimePageRequest } from '../functions/anime/[id]';
import { onRequest as onLanguagePageRequest } from '../functions/dubbed-anime/[language]';
import edgeWorker from '../src/edge-entry';

const SAMPLE_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>ANIDUB INDIA | The Premier Destination for Anime Streaming & Dubbing in India</title>
    <meta name="description" content="Default description" />
    <link rel="canonical" href="https://anidub.in/" />
    <meta property="og:url" content="https://anidub.in/" />
    <meta property="og:title" content="ANIDUB INDIA | Anime Streaming & Dubbing" />
    <meta property="og:description" content="Default OG description" />
    <meta property="og:image" content="https://anidub.in/logo.png" />
    <meta property="og:type" content="website" />
    <meta name="twitter:title" content="ANIDUB INDIA | Anime Streaming & Dubbing" />
    <meta name="twitter:description" content="Default Twitter description" />
    <meta name="twitter:image" content="https://anidub.in/logo.png" />
    <script type="application/ld+json">{"@type":"WebSite"}</script>
  </head>
  <body><div id="root"></div></body>
</html>`;

/**
 * Lightweight deterministic HTMLRewriter test double simulating Cloudflare's HTMLRewriter API
 * for `title`, `meta[name|property="..."]`, and `link[rel="canonical"]`.
 */
class MockHTMLRewriter implements HTMLRewriterLike {
  private rules: Array<{ selector: string; handler: HTMLRewriterHandlerLike }> = [];

  on(selector: string, handler: HTMLRewriterHandlerLike): HTMLRewriterLike {
    this.rules.push({ selector, handler });
    return this;
  }

  transform(response: Response): Response {
    const rewritePromise = response.text().then((html) => {
      let output = html;

      for (const { selector, handler } of this.rules) {
        if (!handler.element) continue;

        if (selector === 'html') {
          output = output.replace(/<html\b[^>]*>/i, (tagHtml) => {
            let updatedTag = tagHtml;
            handler.element?.({
              setInnerContent() {},
              setAttribute(name: string, value: string) {
                const targetAttrRegex = new RegExp(`\\b${name}=["'][^"']*["']`, 'i');
                if (targetAttrRegex.test(updatedTag)) {
                  updatedTag = updatedTag.replace(targetAttrRegex, `${name}="${value}"`);
                } else {
                  updatedTag = updatedTag.replace(/>$/, ` ${name}="${value}">`);
                }
              },
            });
            return updatedTag;
          });
          continue;
        }

        if (selector === 'title') {
          output = output.replace(/<title>[\s\S]*?<\/title>/i, (full) => {
            let nextInner = '';
            handler.element?.({
              setInnerContent(content: string) {
                nextInner = content;
              },
              setAttribute() {},
            });
            return nextInner ? `<title>${nextInner}</title>` : full;
          });
          continue;
        }

        if (selector === 'script[type="application/ld+json"]') {
          output = output.replace(
            /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i,
            (full) => {
              let nextInner = '';
              handler.element?.({
                setInnerContent(content: string) {
                  nextInner = content;
                },
                setAttribute() {},
              });
              return nextInner
                ? `<script type="application/ld+json">${nextInner}</script>`
                : full;
            }
          );
          continue;
        }

        const attrMatch = selector.match(/^(meta|link)\[(name|property|rel)="([^"]+)"\]$/);
        if (attrMatch) {
          const [, tagName, attrKey, attrValue] = attrMatch;
          const escapedVal = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const tagRegex = new RegExp(
            `<${tagName}\\b[^>]*\\b${attrKey}=["']${escapedVal}["'][^>]*>`,
            'i'
          );

          output = output.replace(tagRegex, (tagHtml) => {
            let updatedTag = tagHtml;
            handler.element?.({
              setInnerContent() {},
              setAttribute(name: string, value: string) {
                const targetAttrRegex = new RegExp(`\\b${name}=["'][^"']*["']`, 'i');
                if (targetAttrRegex.test(updatedTag)) {
                  updatedTag = updatedTag.replace(targetAttrRegex, `${name}="${value}"`);
                } else {
                  updatedTag = updatedTag.replace(/\s*\/?>$/, ` ${name}="${value}" />`);
                }
              },
            });
            return updatedTag;
          });
        }
      }

      return output;
    });

    const stream = new ReadableStream({
      async start(controller) {
        const rewritten = await rewritePromise;
        controller.enqueue(new TextEncoder().encode(rewritten));
        controller.close();
      },
    });

    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
}

test('parseLanguageFromPath validates Indian regional language slugs and rejects invalid/excluded ones', () => {
  assert.deepEqual(parseLanguageFromPath('/dubbed-anime/hindi'), {
    slug: 'hindi',
    language: 'Hindi',
  });
  assert.deepEqual(parseLanguageFromPath('/dubbed-anime/Tamil/'), {
    slug: 'tamil',
    language: 'Tamil',
  });
  assert.deepEqual(parseLanguageFromPath('/dubbed-anime/telugu?sort=rating'), {
    slug: 'telugu',
    language: 'Telugu',
  });
  assert.deepEqual(parseLanguageFromPath('/dubbed-anime/malayalam'), {
    slug: 'malayalam',
    language: 'Malayalam',
  });
  assert.deepEqual(parseLanguageFromPath('/dubbed-anime/kannada'), {
    slug: 'kannada',
    language: 'Kannada',
  });

  // Excluded non-Indian languages & non-matching/unsafe paths
  assert.equal(parseLanguageFromPath('/dubbed-anime/japanese'), null);
  assert.equal(parseLanguageFromPath('/dubbed-anime/english'), null);
  assert.equal(parseLanguageFromPath('/dubbed-anime/%3Cscript%3E'), null);
  assert.equal(parseLanguageFromPath('/anime/solo-leveling'), null);
});

test('filterAnimeByLanguage handles comma, pipe, array, and short language code formats', () => {
  const catalog = [
    { id: 1, title: 'Solo Leveling', languages: 'Hindi, Tamil, Telugu' },
    { id: 2, title: 'Jujutsu Kaisen', languages: 'Hindi | Malayalam' },
    { id: 3, title: 'Naruto Shippuden', languages: ['TAM', 'KAN'] },
    { id: 4, title: 'Demon Slayer', languages: 'HIN,BEN' },
  ];

  assert.deepEqual(
    filterAnimeByLanguage(catalog, 'Hindi').map((a) => a.title),
    ['Solo Leveling', 'Jujutsu Kaisen', 'Demon Slayer']
  );
  assert.deepEqual(
    filterAnimeByLanguage(catalog, 'Tamil').map((a) => a.title),
    ['Solo Leveling', 'Naruto Shippuden']
  );
  assert.deepEqual(
    filterAnimeByLanguage(catalog, 'Kannada').map((a) => a.title),
    ['Naruto Shippuden']
  );
  assert.deepEqual(
    filterAnimeByLanguage(catalog, 'Bengali').map((a) => a.title),
    ['Demon Slayer']
  );
});

test('applySeoMetaWithHtmlRewriter injects anime and language tags into raw index.html', async () => {
  const baseRes = new Response(SAMPLE_INDEX_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });

  const animeMeta = buildAnimeSeoMeta(
    {
      id: 42,
      slug: 'solo-leveling',
      title: 'Solo Leveling',
      languages: 'Hindi, Tamil, Telugu',
      synopsis: 'Sung Jinwoo rises from the weakest hunter to the shadow monarch.',
      cover_image: 'https://cdn.anidub.in/posters/solo-leveling.jpg',
      type: 'TV Series',
    },
    'https://anidub.in'
  );

  const rewrittenAnime = applySeoMetaWithHtmlRewriter(
    baseRes,
    animeMeta,
    MockHTMLRewriter
  );
  const animeHtml = await rewrittenAnime.text();

  assert.ok(animeHtml.includes('<title>Solo Leveling (Hindi, Tamil, Telugu Dub) | ANIDUB INDIA</title>'));
  assert.ok(animeHtml.includes('property="og:title" content="Solo Leveling – Official Indian Dub | ANIDUB INDIA"'));
  assert.ok(animeHtml.includes('property="og:image" content="https://cdn.anidub.in/posters/solo-leveling.jpg"'));
  assert.ok(animeHtml.includes('<link rel="canonical" href="https://anidub.in/anime/solo-leveling" />'));
  assert.ok(animeHtml.includes('Sung Jinwoo rises from the weakest hunter'));

  const langRes = new Response(SAMPLE_INDEX_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });
  const langMeta = buildLanguageSeoMeta('Tamil', 'https://anidub.in');
  const rewrittenLang = applySeoMetaWithHtmlRewriter(
    langRes,
    langMeta,
    MockHTMLRewriter
  );
  const langHtml = await rewrittenLang.text();

  assert.ok(langHtml.includes('<html lang="ta">'));
  assert.ok(
    langHtml.includes('<title>தமிழ் டப் அனிமே - Best Tamil Dubbed Anime in India | ANIDUB INDIA</title>')
  );
  assert.ok(langHtml.includes('<link rel="canonical" href="https://anidub.in/dubbed-anime/tamil" />'));

  const mlMeta = buildLanguageSeoMeta('Malayalam', 'https://anidub.in');
  assert.equal(mlMeta.htmlLang, 'ml');
  assert.ok(mlMeta.title.includes('മലയാളം ഡബ്ബ് ആനിമേഷൻ'));

  const knMeta = buildLanguageSeoMeta('Kannada', 'https://anidub.in');
  assert.equal(knMeta.htmlLang, 'kn');
  assert.ok(knMeta.title.includes('ಕನ್ನಡ ಡಬ್ ಅನಿಮೆ'));
});

test('functions/anime/[id].ts injects published anime metadata from D1 and never leaks unpublished rows', async () => {
  const rows = [
    {
      id: 7,
      slug: 'jujutsu-kaisen',
      title: 'Jujutsu Kaisen',
      synopsis: 'Yuji Itadori enters a world of cursed spirits.',
      cover_image: 'https://cdn.anidub.in/posters/jjk.jpg',
      languages: 'Hindi, Tamil',
      type: 'TV',
      is_published: 1,
      status: 'approved',
    },
    {
      id: 88,
      slug: 'unreleased-dub',
      title: 'Top Secret Pending Anime',
      synopsis: 'Should not appear in public HTML meta.',
      cover_image: 'https://cdn.anidub.in/posters/secret.jpg',
      languages: 'Hindi',
      type: 'TV',
      is_published: 0,
      status: 'pending',
    },
  ];

  const executedQueries: string[] = [];
  const mockDb = {
    prepare(sql: string) {
      executedQueries.push(sql);
      let args: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          args = values;
          return this;
        },
        async first<T = Record<string, unknown>>() {
          const target = String(args[0] ?? '');
          const matched = rows.find(
            (r) =>
              (String(r.id) === target || r.slug === target) &&
              r.is_published === 1 &&
              r.status !== 'pending'
          );
          return (matched as T | undefined) ?? null;
        },
      };
    },
  };

  // 1. Published anime by slug -> dynamic tags injected
  const publishedRes = await onAnimePageRequest({
    request: new Request('https://anidub.in/anime/jujutsu-kaisen'),
    env: { DB: mockDb },
    params: { id: 'jujutsu-kaisen' },
    next: async () =>
      new Response(SAMPLE_INDEX_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      }),
    RewriterCtor: MockHTMLRewriter,
  });

  assert.equal(publishedRes.status, 200);
  const publishedHtml = await publishedRes.text();
  assert.ok(publishedHtml.includes('<title>Jujutsu Kaisen (Hindi, Tamil Dub) | ANIDUB INDIA</title>'));
  assert.ok(publishedHtml.includes('https://cdn.anidub.in/posters/jjk.jpg'));
  assert.ok(publishedHtml.includes('https://anidub.in/anime/jujutsu-kaisen'));
  const ldMatch = publishedHtml.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
  );
  assert.ok(ldMatch && ldMatch[1], 'HTMLRewriter must inject JSON-LD script');
  const parsedLd = JSON.parse(ldMatch[1]);
  assert.equal(parsedLd['@type'], 'TVSeries');
  assert.equal(parsedLd.name, 'Jujutsu Kaisen');
  assert.equal(parsedLd.image, 'https://cdn.anidub.in/posters/jjk.jpg');
  assert.deepEqual(parsedLd.inLanguage, ['Hindi', 'Tamil']);
  assert.ok(
    executedQueries.some(
      (sql) => sql.includes('is_published = 1') && sql.includes("status != 'pending'")
    )
  );

  // 2. Unpublished anime -> falls back to default metadata without leaking pending title/image
  const pendingRes = await onAnimePageRequest({
    request: new Request('https://anidub.in/anime/unreleased-dub'),
    env: { DB: mockDb },
    params: { id: 'unreleased-dub' },
    next: async () =>
      new Response(SAMPLE_INDEX_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      }),
    RewriterCtor: MockHTMLRewriter,
  });

  const pendingHtml = await pendingRes.text();
  assert.equal(pendingHtml.includes('Top Secret Pending Anime'), false);
  assert.equal(pendingHtml.includes('https://cdn.anidub.in/posters/secret.jpg'), false);
  assert.ok(pendingHtml.includes('ANIDUB INDIA | The Premier Destination'));
});

test('functions/dubbed-anime/[language].ts and src/edge-entry.ts rewrite language & anime pages via HTMLRewriter', async () => {
  // 1. Pages Function `/dubbed-anime/hindi`
  const hindiRes = await onLanguagePageRequest({
    request: new Request('https://anidub.in/dubbed-anime/hindi'),
    env: {},
    params: { language: 'hindi' },
    next: async () =>
      new Response(SAMPLE_INDEX_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      }),
    RewriterCtor: MockHTMLRewriter,
  });
  const hindiHtml = await hindiRes.text();
  assert.ok(hindiHtml.includes('<html lang="hi">'));
  assert.ok(
    hindiHtml.includes('<title>हिंदी डब एनीमे - Best Hindi Dubbed Anime in India | ANIDUB INDIA</title>')
  );
  assert.ok(hindiHtml.includes('https://anidub.in/dubbed-anime/hindi'));

  // 2. Unified Worker entry (`src/edge-entry.ts`) with global HTMLRewriter stub
  const prevRewriter = (globalThis as Record<string, unknown>).HTMLRewriter;
  (globalThis as Record<string, unknown>).HTMLRewriter = MockHTMLRewriter;
  try {
    const mockAssets = {
      async fetch() {
        return new Response(SAMPLE_INDEX_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
      },
    };

    const teluguWorkerRes = await edgeWorker.fetch(
      new Request('https://anidub.in/dubbed-anime/telugu'),
      { DB: null, ASSETS: mockAssets }
    );
    const teluguHtml = await teluguWorkerRes.text();
    assert.ok(teluguHtml.includes('<html lang="te">'));
    assert.ok(
      teluguHtml.includes('<title>తెలుగు డబ్ అనిమే - Best Telugu Dubbed Anime in India | ANIDUB INDIA</title>')
    );
    assert.ok(teluguHtml.includes('https://anidub.in/dubbed-anime/telugu'));
  } finally {
    if (prevRewriter === undefined) {
      delete (globalThis as Record<string, unknown>).HTMLRewriter;
    } else {
      (globalThis as Record<string, unknown>).HTMLRewriter = prevRewriter;
    }
  }
});

test('Dynamic sitemap.xml Pages Function and Footer regional links include all primary dubbed language pages and published anime', async () => {
  assert.equal(fs.existsSync(path.join(process.cwd(), 'public/sitemap.xml')), false);

  const { onRequest } = await import('../functions/sitemap.xml');
  const mockDb = {
    prepare(sql: string) {
      assert.ok(sql.includes('is_published = 1'));
      return {
        async all<T = Record<string, unknown>>() {
          return {
            results: [
              { id: 1, slug: 'naruto-shippuden-hindi', created_at: '2025-02-01T12:00:00Z' },
              { id: 2, slug: 'solo-leveling-tamil', created_at: '2025-02-05T00:00:00Z' },
            ] as unknown as T[],
          };
        },
      };
    },
  };

  const res = await onRequest({
    request: new Request('https://anidub.in/sitemap.xml'),
    env: { DB: mockDb },
  });
  assert.equal(res.status, 200);
  assert.ok((res.headers.get('Content-Type') || '').includes('application/xml'));
  const sitemap = await res.text();
  assert.ok(sitemap.includes('<loc>https://anidub.in/</loc>'));
  assert.ok(sitemap.includes('<loc>https://anidub.in/anime/naruto-shippuden-hindi</loc>'));
  assert.ok(sitemap.includes('<loc>https://anidub.in/anime/solo-leveling-tamil</loc>'));
  assert.ok(sitemap.includes('<lastmod>2025-02-01</lastmod>'));

  for (const slug of ['hindi', 'tamil', 'telugu', 'malayalam', 'kannada']) {
    assert.ok(
      sitemap.includes(`<loc>https://anidub.in/dubbed-anime/${slug}</loc>`),
      `sitemap.xml missing /dubbed-anime/${slug}`
    );
  }

  const navbar = fs.readFileSync(path.join(process.cwd(), 'src/components/Navbar.tsx'), 'utf-8');
  assert.ok(!navbar.includes('Browse Dubbed Anime by Language'));
  assert.ok(!navbar.includes('Indian Regional Dub Languages'));

  const footer = fs.readFileSync(
    path.join(process.cwd(), 'src/components/FeedbackSection.tsx'),
    'utf-8'
  );
  assert.ok(footer.includes('<footer'));
  assert.ok(footer.includes('Regional Dubbed Anime Languages'));
  assert.ok(footer.includes('/dubbed-anime/'));
});
