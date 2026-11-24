import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { onRequest as apiOnRequest } from '../functions/api/[[route]]';
import {
  resolveCanonicalAnimeStatus,
  isCanonicalAiring,
  filterCatalogByStatus,
  normalizeAnimeStatusFields,
} from '../src/utils/animeStatus';
import { buildVerifiedScheduleData } from '../src/utils/schedule';
import { buildDubProgressBreakdown } from '../src/utils/dubProgress';
import {
  computeOttHubStats,
  matchesSelectedPlatforms,
  isFreeLegalStreaming,
  readMySubscriptions,
  writeMySubscriptions,
  readMySubscriptionsEnabled,
  writeMySubscriptionsEnabled,
} from '../src/utils/ottHub';
import {
  matchesEpisodeLengthBucket,
  isFullyDubbedInLanguage,
  applySmartFilters,
  buildActiveFilterChips,
} from '../src/utils/smartFilters';

function createSqliteD1Wrapper(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...params: unknown[]) {
          bound = params;
          return stmt;
        },
        async first<T = Record<string, unknown>>() {
          const row = db.prepare(sql).get(...(bound as any[]));
          return (row as T | undefined) ?? null;
        },
        async all<T = Record<string, unknown>>() {
          const rows = db.prepare(sql).all(...(bound as any[]));
          return { results: rows as T[] };
        },
        async run() {
          const res = db.prepare(sql).run(...(bound as any[]));
          return { meta: { changes: Number(res.changes || 0), last_row_id: Number(res.lastInsertRowid || 0) } };
        },
      };
      return stmt;
    },
  };
}

function createMigratedSqliteDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  return db;
}

test('P0-3 Canonical Airing Status utility and filterCatalogByStatus reconcile contradictory D1 rows', () => {
  const catalog = [
    { id: 1, title: 'Dandadan', status: 'Completed', airing_status: 'Airing' },
    { id: 2, title: 'Solo Leveling S2', status: 'Airing', airing_status: 'Airing' },
    { id: 3, title: 'Naruto Shippuden', status: 'Completed', airing_status: 'Completed' },
    { id: 4, title: 'Steel Ball Run', status: 'Completed', airing_status: 'Upcoming' },
    { id: 5, title: 'Pending Mod Row', status: 'pending', airing_status: 'Airing' },
  ];

  assert.equal(resolveCanonicalAnimeStatus(catalog[0]), 'Airing');
  assert.equal(isCanonicalAiring(catalog[0]), true);
  assert.equal(resolveCanonicalAnimeStatus(catalog[2]), 'Completed');
  assert.equal(resolveCanonicalAnimeStatus(catalog[3]), 'Upcoming');

  const normalized = normalizeAnimeStatusFields(catalog[0]);
  assert.equal(normalized.status, 'Airing');
  assert.equal(normalized.airing_status, 'Airing');

  assert.deepEqual(
    filterCatalogByStatus(catalog, 'Airing').map((a) => a.id),
    [1, 2]
  );
  assert.deepEqual(
    filterCatalogByStatus(catalog, 'Completed').map((a) => a.id),
    [3]
  );
  assert.deepEqual(
    filterCatalogByStatus(catalog, 'Upcoming').map((a) => a.id),
    [4]
  );
  assert.deepEqual(
    filterCatalogByStatus(catalog, 'All').map((a) => a.id),
    [1, 2, 3, 4]
  );
});

test('P0-3 SQL Migration 0009 reconciles status with airing_status while preserving pending rows', () => {
  const db = createMigratedSqliteDb();

  db.prepare(
    `INSERT INTO anime (id, title, slug, cover_image, banner_image, status, airing_status, is_published)
     VALUES (1, 'Contradictory Airing', 'contradictory-airing', 'https://cdn.anidub.in/1.jpg', 'https://cdn.anidub.in/1b.jpg', 'Completed', 'Airing', 1),
            (2, 'Upcoming Show', 'upcoming-show', 'https://cdn.anidub.in/2.jpg', 'https://cdn.anidub.in/2b.jpg', 'Completed', 'Upcoming', 1),
            (3, 'Pending Draft', 'pending-draft', 'https://cdn.anidub.in/3.jpg', 'https://cdn.anidub.in/3b.jpg', 'pending', 'Airing', 0)`
  ).run();

  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), 'migrations/0009_sync_canonical_airing_status.sql'),
    'utf8'
  );
  db.exec(migrationSql);

  const row1 = db.prepare('SELECT status, airing_status FROM anime WHERE id = 1').get() as any;
  const row2 = db.prepare('SELECT status, airing_status FROM anime WHERE id = 2').get() as any;
  const row3 = db.prepare('SELECT status, airing_status FROM anime WHERE id = 3').get() as any;

  assert.equal(row1.status, 'Airing');
  assert.equal(row1.airing_status, 'Airing');
  assert.equal(row2.status, 'Upcoming');
  assert.equal(row2.airing_status, 'Upcoming');
  assert.equal(row3.status, 'pending');

  db.close();
});

test('P0-3 Honest Weekly Schedule shows all airing titles and never invents Episode 1 or fake broadcast times', () => {
  const airingWithContradiction = [
    {
      id: 101,
      title: 'Verified Slot Anime',
      status: 'Completed',
      airing_status: 'Airing',
      broadcast_day: 'Sunday',
      broadcast_time: '09:00 PM IST',
      languages: 'Hindi, Tamil',
    },
    {
      id: 102,
      title: 'Unscheduled Airing Anime',
      status: 'Completed',
      airing_status: 'Airing',
      broadcast_day: null,
      broadcast_time: null,
      languages: 'Hindi',
    },
    {
      id: 103,
      title: 'Finished Anime',
      status: 'Completed',
      airing_status: 'Completed',
      languages: 'Hindi',
    },
  ];

  const schedule = buildVerifiedScheduleData(airingWithContradiction);
  assert.equal(schedule.allSimulcasts.length, 2);
  assert.equal(schedule.scheduledItems.length, 1);
  assert.equal(schedule.unscheduledItems.length, 1);
  assert.equal(schedule.unscheduledItems[0].displayAirTime, 'Time TBA');
  assert.equal(schedule.unscheduledItems[0].currentEpisode, null);
  assert.equal(schedule.scheduledItems[0].currentEpisode, null);
});

test('P0-1, P0-2, P0-3 & Discovery Smart Filters on live SQLite-backed /api/anime routes', async () => {
  const db = createMigratedSqliteDb();

  // Seed 30 published anime so items >24 test P0-1 & P0-2 beyond first page
  const insert = db.prepare(
    `INSERT INTO anime (
      id, title, slug, synopsis, cover_image, banner_image, rating, episodes_count,
      status, airing_status, year, genres, popularity, languages, platform, type, is_published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  for (let i = 1; i <= 26; i++) {
    insert.run(
      i,
      `Catalog Anime ${i}`,
      `catalog-anime-${i}`,
      'Action fantasy dubbed anime.',
      `https://cdn.anidub.in/p${i}.jpg`,
      `https://cdn.anidub.in/b${i}.jpg`,
      i === 26 ? 9.2 : 7.0,
      i === 26 ? 12 : 24,
      'Completed',
      i <= 3 ? 'Airing' : 'Completed',
      2025,
      'Action, Fantasy',
      100 - i,
      'Hindi, Tamil',
      i === 26 ? 'YouTube (Muse India)' : i % 2 === 0 ? 'Netflix' : 'Crunchyroll',
      'TV Series'
    );
  }
  // Add a 100+ episode shonen title on Prime Video & JioHotstar
  insert.run(
    27,
    'Naruto Shippuden',
    'naruto-shippuden',
    'Ninja adventure.',
    'https://cdn.anidub.in/naruto.jpg',
    'https://cdn.anidub.in/naruto-banner.jpg',
    8.7,
    500,
    'Completed',
    'Completed',
    2007,
    'Action, Adventure',
    500,
    'Hindi, Tamil, Telugu, Malayalam, Kannada',
    'JioHotstar | Prime Video',
    'TV Series'
  );

  const env = { DB: createSqliteD1Wrapper(db) };

  // 1. P0-2: GET /api/anime/index returns ALL 27 published titles with Cache-Control header
  const indexRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/anime/index'),
    env,
  } as any);
  assert.equal(indexRes.status, 200);
  assert.ok((indexRes.headers.get('Cache-Control') || '').includes('max-age=120'));
  const indexJson = (await indexRes.json()) as any;
  assert.equal(indexJson.data.length, 27);
  assert.equal(indexJson.total, 27);
  assert.ok(indexJson.data.some((a: any) => a.slug === 'naruto-shippuden'));

  // Also test ?mode=index
  const modeIndexRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/anime?mode=index'),
    env,
  } as any);
  assert.equal(modeIndexRes.status, 200);
  const modeIndexJson = (await modeIndexRes.json()) as any;
  assert.equal(modeIndexJson.data.length, 27);

  // 2. P0-1: GET /api/anime/:slug resolves deep-linked item outside first 24 (case-insensitive)
  const slugRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/anime/Catalog-Anime-26'),
    env,
  } as any);
  assert.equal(slugRes.status, 200);
  const slugJson = (await slugRes.json()) as any;
  assert.equal(slugJson.id, 26);
  assert.equal(slugJson.slug, 'catalog-anime-26');

  // Invalid slug returns 404
  const notFoundRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/anime/does-not-exist-9999'),
    env,
  } as any);
  assert.equal(notFoundRes.status, 404);

  // 3. P0-3: GET /api/anime?status=Airing returns all 3 rows whose airing_status='Airing' even with legacy status='Completed'
  const airingRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/anime?status=Airing'),
    env,
  } as any);
  assert.equal(airingRes.status, 200);
  const airingJson = (await airingRes.json()) as any;
  assert.equal(airingJson.meta.totalItems, 3);
  assert.equal(airingJson.summary.airingCount, 3);
  assert.ok(airingJson.data.every((item: any) => item.status === 'Airing'));

  // 4. Discovery Upgrade 3: Smart Filters on /api/anime (episodeLength, minRating, freeLegal, fullyDubbed, platforms)
  const smartRes = await apiOnRequest({
    request: new Request(
      'https://anidub.in/api/anime?episodeLength=1-13&minRating=8.5&freeLegal=true&fullyDubbed=true'
    ),
    env,
  } as any);
  assert.equal(smartRes.status, 200);
  const smartJson = (await smartRes.json()) as any;
  assert.equal(smartJson.meta.totalItems, 1);
  assert.equal(smartJson.data[0].slug, 'catalog-anime-26');

  const subsRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/anime?platforms=JioHotstar,Muse%20India&episodeLength=100%2B'),
    env,
  } as any);
  assert.equal(subsRes.status, 200);
  const subsJson = (await subsRes.json()) as any;
  assert.equal(subsJson.meta.totalItems, 1);
  assert.equal(subsJson.data[0].slug, 'naruto-shippuden');

  db.close();
});

test('Discovery Upgrade 1: Visual Dub Progress Bars obey strict honesty and support multi-season matrices', () => {
  // 1. Plain language names without verified episode counts -> NEVER invent numbers
  const plainRecord = {
    languages: 'Hindi, Tamil, Japanese, English',
    episodes_count: 12,
  };
  const plainResult = buildDubProgressBreakdown(plainRecord);
  assert.equal(plainResult.hasMultipleSeasons, false);
  const hindiPlain = plainResult.overall.languages.find((l) => l.language === 'Hindi')!;
  const teluguPlain = plainResult.overall.languages.find((l) => l.language === 'Telugu')!;
  assert.equal(hindiPlain.status, 'available');
  assert.equal(hindiPlain.episodesDubbed, null);
  assert.equal(hindiPlain.label, 'Available');
  assert.equal(teluguPlain.status, 'unavailable');
  assert.equal(teluguPlain.label, 'Unavailable');

  // 2. Verified dub_matrix with complete + partial counts + multi-season switching
  const multiSeasonRecord = {
    dub_matrix: [
      {
        season: 1,
        total_episodes: 12,
        languages: {
          Tamil: { episodes_dubbed: 12, total_episodes: 12 },
          Telugu: { episodes_dubbed: 8, total_episodes: 12 },
          Hindi: { episodes_dubbed: 12, total_episodes: 12 },
        },
      },
      {
        season: 2,
        total_episodes: 13,
        languages: {
          Hindi: { episodes_dubbed: 5, total_episodes: 13 },
        },
      },
    ],
  };
  const msResult = buildDubProgressBreakdown(multiSeasonRecord);
  assert.equal(msResult.hasMultipleSeasons, true);
  assert.equal(msResult.seasons.length, 2);
  const s1Tamil = msResult.seasons[0].languages.find((l) => l.language === 'Tamil')!;
  const s1Telugu = msResult.seasons[0].languages.find((l) => l.language === 'Telugu')!;
  assert.equal(s1Tamil.status, 'complete');
  assert.equal(s1Tamil.label, '12/12 episodes');
  assert.equal(s1Telugu.status, 'partial');
  assert.equal(s1Telugu.label, '8/12 episodes');
  assert.equal(s1Telugu.percent, 67);
});

test('Discovery Upgrades 2 & 3: OTT Hub stats, My Subscriptions localStorage, and Smart Filter Engine', () => {
  const sample = [
    { id: 1, title: 'Solo Leveling', platform: 'Crunchyroll', episodes_count: 12, rating: 8.6, status: 'Completed', languages: 'Hindi, Tamil' },
    { id: 2, title: 'Dandadan', platform: 'Netflix | Crunchyroll', episodes_count: 12, rating: 8.8, status: 'Airing', airing_status: 'Airing', languages: 'Hindi' },
    { id: 3, title: 'Spy x Family', platform: 'YouTube (Muse India)', episodes_count: 25, rating: 8.5, status: 'Completed', languages: 'Hindi, Tamil' },
    { id: 4, title: 'Naruto', platform: 'JioHotstar | Prime Video', episodes_count: 220, rating: 8.4, status: 'Completed', languages: 'Hindi, Tamil, Telugu' },
  ];

  const hubStats = computeOttHubStats(sample);
  const crStat = hubStats.find((s) => s.platform.id === 'Crunchyroll')!;
  const museStat = hubStats.find((s) => s.platform.id === 'Muse India')!;
  assert.equal(crStat.count, 2);
  assert.equal(crStat.exclusiveCount, 1);
  assert.equal(museStat.count, 1);

  assert.equal(isFreeLegalStreaming(sample[2]), true);
  assert.equal(isFreeLegalStreaming(sample[0]), false);
  assert.equal(matchesSelectedPlatforms(sample[2], ['Netflix', 'Muse India']), true);
  assert.equal(matchesSelectedPlatforms(sample[0], ['Netflix', 'Muse India']), false);

  assert.equal(matchesEpisodeLengthBucket(12, '1-13'), true);
  assert.equal(matchesEpisodeLengthBucket(25, '14-26'), true);
  assert.equal(matchesEpisodeLengthBucket(220, '100+'), true);
  assert.equal(isFullyDubbedInLanguage(sample[0], 'Tamil'), true);
  assert.equal(isFullyDubbedInLanguage(sample[1], 'Hindi'), false); // Airing

  const filtered = applySmartFilters(sample, {
    episodeLength: '14-26',
    minRating: 8.0,
    fullyDubbedOnly: true,
    freeLegalOnly: true,
    selectedLanguage: 'Hindi',
  });
  assert.deepEqual(filtered.map((a) => a.id), [3]);

  const chips = buildActiveFilterChips({
    episodeLength: '1-13',
    minRating: 7.5,
    fullyDubbedOnly: true,
    freeLegalOnly: true,
    mySubscriptionsEnabled: true,
    mySubscriptions: ['Netflix', 'Muse India'],
  });
  assert.equal(chips.length, 5);

  // My Subscriptions storage persistence
  const store = new Map<string, string>();
  const prevStorage = (globalThis as any).localStorage;
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  };
  try {
    writeMySubscriptions(['Netflix', 'Muse India']);
    writeMySubscriptionsEnabled(true);
    assert.deepEqual(readMySubscriptions(), ['Netflix', 'Muse India']);
    assert.equal(readMySubscriptionsEnabled(), true);
  } finally {
    (globalThis as any).localStorage = prevStorage;
  }
});

test('P1 High-Priority UI & Trust Quick Wins source assertions', () => {
  const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

  // P1-01: Trending badge threshold
  const animeCard = read('src/components/AnimeCard.tsx');
  assert.equal(animeCard.includes('isTrending = true'), false);
  assert.ok(animeCard.includes('TRENDING_VOTE_THRESHOLD'));
  // P1-05: Save Info Offline
  assert.equal(animeCard.includes('Download for offline'), false);
  assert.ok(animeCard.includes('Save Info Offline'));
  // P1-08: Movie tag instead of 1 Eps
  assert.ok(animeCard.includes("isMovie ? 'Movie' : animeType"));

  // P1-02 & P1-03: No hardcoded Dolby 5.1 / Stereo or generic Official Licensee in AnimeDetailPage
  const detailPage = read('src/components/AnimeDetailPage.tsx');
  assert.equal(detailPage.includes('Dolby 5.1 / Stereo'), false);
  assert.equal(detailPage.includes('Official Licensee'), false);
  assert.ok(detailPage.includes('buildDubProgressBreakdown'));

  // P1-04: Catalog Score instead of Official Rating
  const dualRating = read('src/components/DualRating.tsx');
  assert.equal(dualRating.includes('Official Rating'), false);
  assert.ok(dualRating.includes('Catalog Score'));

  // P1-06 & P1-09: Directory branding & honest footer
  const hero = read('src/components/Hero.tsx');
  const catalogView = read('src/components/CatalogView.tsx');
  const footer = read('src/components/FeedbackSection.tsx');
  assert.ok(hero.includes('Indian Dubbed Anime Discovery'));
  assert.ok(catalogView.includes('Indian Dubbed Anime Discovery'));
  assert.equal(footer.includes('Licensed under fair-use catalog guidelines'), false);
  assert.ok(footer.includes('Rights-holder'));

  // P1-07: Search placeholder excludes voice actor
  assert.equal(catalogView.includes('voice actor'), false);

  // P1-13: Mobile nav >= 44px touch targets
  const navbar = read('src/components/Navbar.tsx');
  assert.ok(navbar.includes('min-w-[44px]') && navbar.includes('min-h-[44px]'));
  assert.ok(navbar.includes('Mobile primary navigation'));

  // P1-17: Profile share button hidden
  const profile = read('src/components/ProfileView.tsx');
  assert.equal(profile.includes('Share Profile'), false);
});
