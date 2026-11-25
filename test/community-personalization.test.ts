import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { onRequest as apiOnRequest } from '../functions/api/[[route]]';
import { resetDubRequestRateLimitBucketsForTest } from '../src/server/routes/radarRequestsRoutes';
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
  assert.equal(stats.episodesWatched, 17); // 12 + 5
  assert.equal(stats.watchingCount, 1); // #2
  assert.equal(stats.planToWatchCount, 1); // #4

  // Favorite genres: Action (3), Fantasy (2), ...
  assert.equal(stats.favoriteGenres[0].genre, 'Action');
  assert.equal(stats.favoriteGenres[0].count, 3);
  assert.equal(stats.favoriteGenres[0].percent, 100);

  // Preferred Indian dub languages
  const langNames = stats.preferredLanguages.map((l) => l.language);
  assert.equal(langNames.includes('Japanese'), false);
  assert.equal(langNames.includes('English'), false);
  assert.equal(stats.preferredLanguages[0].language, 'Tamil');
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
