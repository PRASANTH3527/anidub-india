import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { onRequest as apiOnRequest } from '../functions/api/[[route]]';
import { resetDubRequestRateLimitBucketsForTest } from '../src/server/routes/radarRequestsRoutes';
import {
  DUB_RADAR_STAGES,
  buildCatalogFallbackRadarEntries,
  filterDubRadarEntries,
  getDubRadarStageIndex,
  validateDubRadarPayload,
} from '../src/utils/dubRadar';
import {
  DUB_REQUEST_LANGUAGES,
  normalizeRequestTitle,
  sortAndFilterDubRequests,
  validateDubRequestSubmission,
} from '../src/utils/dubRequests';
import { computePersonalAnimeStats } from '../src/utils/personalStats';

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
          return {
            meta: {
              changes: Number(res.changes || 0),
              last_row_id: Number(res.lastInsertRowid || 0),
            },
          };
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

test('Feature 1: Dub Release Radar stages, filtering, validation, and honest catalog fallback', () => {
  assert.deepEqual(DUB_RADAR_STAGES, [
    'Official Announcement',
    'Production Confirmed',
    'Release Scheduled',
    'Partially Available',
    'Fully Available',
  ]);
  assert.equal(getDubRadarStageIndex('Official Announcement'), 0);
  assert.equal(getDubRadarStageIndex('Release Scheduled'), 2);
  assert.equal(getDubRadarStageIndex('Fully Available'), 4);

  const valid = validateDubRadarPayload({
    anime_title: 'Solo Leveling Season 2',
    languages: ['Hindi', 'Tamil', 'Telugu'],
    platform: 'Crunchyroll',
    stage: 'Release Scheduled',
    release_date: 'Jan 2026',
    source_url: 'https://www.crunchyroll.com/news/solo-leveling',
  });
  assert.equal(valid.ok, true);

  const invalidStage = validateDubRadarPayload({
    anime_title: 'Test Anime',
    languages: ['Tamil'],
    stage: 'Rumor Only',
  });
  assert.equal(invalidStage.ok, false);

  const invalidLang = validateDubRadarPayload({
    anime_title: 'Test Anime',
    languages: ['Japanese'],
    stage: 'Official Announcement',
  });
  assert.equal(invalidLang.ok, false);

  // Honest catalog fallback never invents release dates
  const fallback = buildCatalogFallbackRadarEntries([
    {
      id: 11,
      title: 'Dandadan',
      status: 'Completed',
      airing_status: 'Airing',
      languages: 'Hindi, Tamil',
      platform: 'Netflix',
    },
    {
      id: 12,
      title: 'Finished Show',
      status: 'Completed',
      airing_status: 'Completed',
      languages: 'Hindi',
      platform: 'Crunchyroll',
    },
  ]);
  assert.equal(fallback.length, 1);
  assert.equal(fallback[0].stage, 'Partially Available');
  assert.equal(fallback[0].release_date, '');

  const filtered = filterDubRadarEntries(fallback, {
    language: 'Tamil',
    stage: 'Partially Available',
  });
  assert.equal(filtered.length, 1);
  assert.equal(
    filterDubRadarEntries(fallback, { language: 'Kannada', stage: 'All' }).length,
    0
  );
});

test('Feature 1 API: /api/dub-radar GET filtering and Admin Clerk auth guard on POST', async () => {
  const db = createMigratedSqliteDb();
  const env = { DB: createSqliteD1Wrapper(db) };

  // Seed 2 radar entries directly into migrated dub_radar table
  db.prepare(
    `INSERT INTO dub_radar (anime_title, languages, platform, stage, release_date, source_url, notes)
     VALUES ('Dandadan S2', 'Hindi, Tamil', 'Netflix', 'Production Confirmed', '', 'https://netflix.com/title/123', 'Studio casting confirmed'),
            ('Sakamoto Days', 'Hindi, Tamil, Telugu', 'Netflix', 'Release Scheduled', 'July 2026', 'https://netflix.com/title/456', 'Simuldub confirmed')`
  ).run();

  const getAllRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/dub-radar'),
    env,
  } as any);
  assert.equal(getAllRes.status, 200);
  const allJson = (await getAllRes.json()) as any;
  assert.equal(allJson.data.length, 2);

  const getFilteredRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/dub-radar?language=Telugu&stage=Release%20Scheduled'),
    env,
  } as any);
  assert.equal(getFilteredRes.status, 200);
  const filteredJson = (await getFilteredRes.json()) as any;
  assert.equal(filteredJson.data.length, 1);
  assert.equal(filteredJson.data[0].anime_title, 'Sakamoto Days');

  // Unauthenticated POST must be rejected with 401
  const unauthPost = await apiOnRequest({
    request: new Request('https://anidub.in/api/dub-radar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anime_title: 'Unauthorized Entry',
        languages: ['Tamil'],
        stage: 'Official Announcement',
      }),
    }),
    env,
  } as any);
  assert.equal(unauthPost.status, 401);

  db.close();
});

test('Feature 2: Dub Request Voting validation, honeypot spam trap, and live SQLite deduplication + ranking', async () => {
  resetDubRequestRateLimitBucketsForTest();
  assert.deepEqual(DUB_REQUEST_LANGUAGES, ['Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada']);
  assert.equal(normalizeRequestTitle('  Monster:  Remastered! '), 'monster remastered');

  // Honeypot rejection
  const spamCheck = validateDubRequestSubmission({
    animeTitle: 'Vinland Saga',
    language: 'Tamil',
    website: 'https://spam-bot.invalid',
  });
  assert.equal(spamCheck.ok, false);

  // URL in anime title rejected
  const urlTitleCheck = validateDubRequestSubmission({
    animeTitle: 'https://evil.example',
    language: 'Hindi',
  });
  assert.equal(urlTitleCheck.ok, false);

  const db = createMigratedSqliteDb();
  const env = { DB: createSqliteD1Wrapper(db) };

  // Voter 1 creates a new Tamil dub request for "Vinland Saga"
  const createRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/dub-requests/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '10.0.0.1',
        'User-Agent': 'VoterOne/1.0',
      },
      body: JSON.stringify({ animeTitle: 'Vinland Saga', language: 'Tamil' }),
    }),
    env,
  } as any);
  assert.equal(createRes.status, 201);
  const createdJson = (await createRes.json()) as any;
  assert.equal(createdJson.success, true);
  assert.equal(createdJson.created, true);
  assert.equal(createdJson.request.vote_count, 1);
  const vinlandId = createdJson.request.id;

  // Voter 1 tries to upvote the SAME request again -> 409 duplicate vote prevented
  const dupVoteRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/dub-requests/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '10.0.0.1',
        'User-Agent': 'VoterOne/1.0',
      },
      body: JSON.stringify({ requestId: vinlandId }),
    }),
    env,
  } as any);
  assert.equal(dupVoteRes.status, 409);
  const dupJson = (await dupVoteRes.json()) as any;
  assert.equal(dupJson.alreadyVoted, true);

  // Voter 2 upvotes existing Vinland Saga request -> vote_count becomes 2
  const upvoteRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/dub-requests/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '10.0.0.2',
        'User-Agent': 'VoterTwo/1.0',
      },
      body: JSON.stringify({ requestId: vinlandId }),
    }),
    env,
  } as any);
  assert.equal(upvoteRes.status, 200);
  const upvoteJson = (await upvoteRes.json()) as any;
  assert.equal(upvoteJson.request.vote_count, 2);

  // Voter 3 submits "vinland  saga!" in Tamil -> merges into existing row & increments to 3
  const mergeRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/dub-requests/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '10.0.0.3',
        'User-Agent': 'VoterThree/1.0',
      },
      body: JSON.stringify({ animeTitle: 'vinland  saga!', language: 'Tamil' }),
    }),
    env,
  } as any);
  assert.equal(mergeRes.status, 200);
  const mergeJson = (await mergeRes.json()) as any;
  assert.equal(mergeJson.mergedExisting, true);
  assert.equal(mergeJson.request.id, vinlandId);
  assert.equal(mergeJson.request.vote_count, 3);

  // Voter 2 creates a lower-ranked Hindi request for "Monster" (1 vote)
  const monsterRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/dub-requests/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '10.0.0.2',
        'User-Agent': 'VoterTwo/1.0',
      },
      body: JSON.stringify({ animeTitle: 'Monster', language: 'Hindi' }),
    }),
    env,
  } as any);
  assert.equal(monsterRes.status, 201);

  // GET /api/dub-requests returns highest demand first & marks Voter 1's votedRequestIds
  const listRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/dub-requests', {
      headers: {
        'CF-Connecting-IP': '10.0.0.1',
        'User-Agent': 'VoterOne/1.0',
      },
    }),
    env,
  } as any);
  assert.equal(listRes.status, 200);
  const listJson = (await listRes.json()) as any;
  assert.equal(listJson.data.length, 2);
  assert.equal(listJson.data[0].anime_title, 'Vinland Saga');
  assert.equal(listJson.data[0].vote_count, 3);
  assert.equal(listJson.data[0].hasVoted, true);
  assert.equal(listJson.data[1].anime_title, 'Monster');
  assert.equal(listJson.data[1].vote_count, 1);

  // Language filter works on GET /api/dub-requests?language=Hindi
  const hindiRes = await apiOnRequest({
    request: new Request('https://anidub.in/api/dub-requests?language=Hindi'),
    env,
  } as any);
  const hindiJson = (await hindiRes.json()) as any;
  assert.equal(hindiJson.data.length, 1);
  assert.equal(hindiJson.data[0].anime_title, 'Monster');

  // Client sort helper keeps descending order
  const sorted = sortAndFilterDubRequests(listJson.data, { language: 'All' });
  assert.equal(sorted[0].vote_count, 3);

  db.close();
});

test('Feature 3: Personal Anime Stats ("My Anime Journey") computes honest metrics and empty state', () => {
  // 1. Empty state when user has nothing logged
  const emptyStats = computePersonalAnimeStats({
    watchlistIds: [],
    catalogItems: [],
    progressMap: {},
    watchedIds: [],
  });
  assert.equal(emptyStats.hasLoggedActivity, false);
  assert.equal(emptyStats.completedCount, 0);
  assert.equal(emptyStats.episodesWatched, 0);
  assert.equal(emptyStats.watchingCount, 0);
  assert.equal(emptyStats.planToWatchCount, 0);

  // 2. Populated watchlist + logged episode progress
  const catalog = [
    { id: 1, title: 'Solo Leveling', episodes_count: 12, genres: 'Action, Fantasy', languages: 'Tamil, Hindi, Japanese' },
    { id: 2, title: 'Dandadan', episodes_count: 12, genres: 'Action, Sci-Fi', languages: 'Tamil, Telugu' },
    { id: 3, title: 'Spy x Family', episodes_count: 25, genres: 'Comedy, Action', languages: 'Tamil, English' },
    { id: 4, title: 'Frieren', episodes_count: 28, genres: 'Fantasy, Drama', languages: 'Hindi' },
  ];

  const stats = computePersonalAnimeStats({
    watchlistIds: [1, 2, 3, 4],
    catalogItems: catalog,
    progressMap: {
      1: { animeId: 1, season: 1, episode: 12, totalEpisodes: 12, completed: true, updatedAt: '2026-01-01T00:00:00Z' },
      2: { animeId: 2, season: 1, episode: 5, totalEpisodes: 12, completed: false, updatedAt: '2026-01-02T00:00:00Z' },
    },
    watchedIds: [3], // legacy completed flag
  });

  assert.equal(stats.hasLoggedActivity, true);
  assert.equal(stats.completedCount, 2); // #1 and #3
  assert.equal(stats.episodesWatched, 17); // 12 + 5 (never invents episodes for legacy watched #3)
  assert.equal(stats.watchingCount, 1); // #2
  assert.equal(stats.planToWatchCount, 1); // #4

  // Favorite genres: Action (3), Fantasy (2), ...
  assert.equal(stats.favoriteGenres[0].genre, 'Action');
  assert.equal(stats.favoriteGenres[0].count, 3);
  assert.equal(stats.favoriteGenres[0].percent, 100);

  // Preferred Indian dub languages (Japanese & English excluded; percentages sum to 100%)
  const langNames = stats.preferredLanguages.map((l) => l.language);
  assert.equal(langNames.includes('Japanese'), false);
  assert.equal(langNames.includes('English'), false);
  assert.equal(stats.preferredLanguages[0].language, 'Tamil'); // 3 mentions out of 6 = 50%
  assert.equal(stats.preferredLanguages[0].percent, 50);
  const sumPct = stats.preferredLanguages.reduce((sum, l) => sum + l.percent, 0);
  assert.equal(sumPct, 100);

  // Source honesty check: no fabricated watch-hours or OTT playback tracking claims
  const statsComponentSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/PersonalAnimeStats.tsx'),
    'utf8'
  );
  assert.ok(statsComponentSrc.includes('Anime Completed'));
  assert.ok(statsComponentSrc.includes('Episodes Watched'));
  assert.ok(statsComponentSrc.includes('Plan to Watch'));
  assert.equal(/hours watched|watch time/i.test(statsComponentSrc), false);
});
