import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildLanguageLikePatterns,
  buildPaginatedMeta,
  calculatePagination,
  filterAndSortCatalog,
  getVisiblePageNumbers,
  parsePaginationQuery,
} from './pagination';
import { onRequest } from '../../functions/api/[[route]]';

test('calculatePagination handles standard page count and offset', () => {
  const result = calculatePagination(25, 2, 8);
  assert.equal(result.total, 25);
  assert.equal(result.page, 2);
  assert.equal(result.limit, 8);
  assert.equal(result.totalPages, 4);
  assert.equal(result.offset, 8);
  assert.equal(result.hasNextPage, true);
  assert.equal(result.hasPrevPage, true);
  assert.deepEqual(result.pages, [1, 2, 3, 4]);
});

test('calculatePagination bounds page within valid range', () => {
  const underflow = calculatePagination(20, -5, 5);
  assert.equal(underflow.page, 1);
  assert.equal(underflow.offset, 0);

  const overflow = calculatePagination(20, 999, 5);
  assert.equal(overflow.page, 4);
  assert.equal(overflow.offset, 15);
  assert.equal(overflow.hasNextPage, false);
});

test('calculatePagination handles empty or zero total items', () => {
  const empty = calculatePagination(0, 1, 8);
  assert.equal(empty.total, 0);
  assert.equal(empty.totalPages, 1);
  assert.equal(empty.page, 1);
  assert.equal(empty.hasNextPage, false);
  assert.equal(empty.hasPrevPage, false);
});

test('parsePaginationQuery, buildPaginatedMeta, buildLanguageLikePatterns, and getVisiblePageNumbers work cleanly', () => {
  const parsed = parsePaginationQuery(new URLSearchParams('page=3&limit=12'));
  assert.deepEqual(parsed, { page: 3, limit: 12, offset: 24 });

  // Clamps excessive limits & invalid page values
  const clamped = parsePaginationQuery(new URLSearchParams('page=-2&limit=5000'), { defaultLimit: 12, maxLimit: 100 });
  assert.deepEqual(clamped, { page: 1, limit: 100, offset: 0 });

  const meta = buildPaginatedMeta(27, 2, 12);
  assert.deepEqual(meta, {
    currentPage: 2,
    totalPages: 3,
    totalItems: 27,
    limit: 12,
    hasNextPage: true,
    hasPrevPage: true,
  });

  assert.deepEqual(buildLanguageLikePatterns('Tamil'), ['%tamil%', '%tam%']);
  assert.deepEqual(buildLanguageLikePatterns('All'), []);
  assert.deepEqual(getVisiblePageNumbers(1, 10, 5), [1, 2, 3, 'ellipsis', 10]);
  assert.deepEqual(getVisiblePageNumbers(5, 10, 5), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  assert.deepEqual(getVisiblePageNumbers(2, 4, 5), [1, 2, 3, 4]);
});

test('filterAndSortCatalog filters by regional dub language (Tamil, Telugu, Hindi)', () => {
  const items = [
    { title: 'Cyberpunk Neon', synopsis: 'In 2077', genres: 'Action,Sci-Fi', status: 'Airing', rating: 9.2, popularity: 500, year: 2026, languages: 'HIN,TAM' },
    { title: 'Starlight Romance', synopsis: 'Love in stars', genres: 'Romance,Drama', status: 'Completed', rating: 8.5, popularity: 300, year: 2024, languages: 'HIN,TEL' },
    { title: 'Blade Warrior', synopsis: 'Sword fights', genres: 'Action,Fantasy', status: 'Airing', rating: 9.5, popularity: 900, year: 2025, languages: 'TAM,TEL' }
  ];

  const tamilTitles = filterAndSortCatalog(items, { language: 'Tamil' });
  assert.equal(tamilTitles.length, 2);
  assert.equal(tamilTitles[0].title, 'Blade Warrior');
  assert.equal(tamilTitles[1].title, 'Cyberpunk Neon');

  const teluguTitles = filterAndSortCatalog(items, { language: 'TEL' });
  assert.equal(teluguTitles.length, 2);

  const hindiTitles = filterAndSortCatalog(items, { language: 'Hindi' });
  assert.equal(hindiTitles.length, 2);
});

test('filterAndSortCatalog filters by genre and search query correctly', () => {
  const items = [
    { title: 'Cyberpunk Neon', synopsis: 'In 2077', genres: 'Action,Sci-Fi', status: 'Airing', rating: 9.2, popularity: 500, year: 2026 },
    { title: 'Starlight Romance', synopsis: 'Love in stars', genres: 'Romance,Drama', status: 'Completed', rating: 8.5, popularity: 300, year: 2024 },
    { title: 'Blade Warrior', synopsis: 'Sword fights', genres: 'Action,Fantasy', status: 'Airing', rating: 9.5, popularity: 900, year: 2025 }
  ];

  const actionOnly = filterAndSortCatalog(items, { genre: 'Action' });
  assert.equal(actionOnly.length, 2);
  assert.equal(actionOnly[0].title, 'Blade Warrior'); // Higher popularity first by default

  const searched = filterAndSortCatalog(items, { search: 'romance' });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].title, 'Starlight Romance');

  const ratingSorted = filterAndSortCatalog(items, { sort: 'rating' });
  assert.equal(ratingSorted[0].title, 'Blade Warrior');
  assert.equal(ratingSorted[2].title, 'Starlight Romance');
});

test('GET /api/anime executes parameterized LIMIT/OFFSET SQL query and returns { data, meta: { currentPage, totalPages, totalItems } }', async () => {
  const executedQueries: { sql: string; args: any[] }[] = [];
  const allRows = Array.from({ length: 13 }, (_, idx) => ({
    id: idx + 1,
    title: `Anime Title ${idx + 1}`,
    genres: 'Action',
    languages: 'HIN,TAM',
    status: 'Airing',
    popularity: 100 - idx,
    rating: 9.0,
    year: 2026,
    is_published: 1,
    submissionStatus: 'approved',
  }));

  const mockDb = {
    prepare(sql: string) {
      return {
        bind(...args: any[]) {
          executedQueries.push({ sql, args });
          return {
            async first() {
              if (sql.includes('SELECT COUNT(*) as total')) {
                return { total: allRows.length };
              }
              return { totalAnime: allRows.length, totalVotes: 500 };
            },
            async all() {
              if (sql.includes('LIMIT ? OFFSET ?')) {
                const limit = Number(args[args.length - 2]);
                const offset = Number(args[args.length - 1]);
                return { results: allRows.slice(offset, offset + limit) };
              }
              return { results: [] };
            },
          };
        },
        async first() {
          executedQueries.push({ sql, args: [] });
          return { totalAnime: allRows.length, totalVotes: 500 };
        },
        async all() {
          executedQueries.push({ sql, args: [] });
          if (sql.includes('SELECT languages FROM anime')) {
            return { results: allRows.map((r) => ({ languages: r.languages })) };
          }
          return { results: [] };
        },
      };
    },
  };

  const res = await onRequest({
    request: new Request('https://anidub.in/api/anime?page=2&limit=5&language=Tamil&genre=Action'),
    env: { DB: mockDb },
  });

  assert.equal(res.status, 200);
  const body: any = await res.json();
  assert.equal(body.data.length, 5);
  assert.equal(body.data[0].id, 6);
  assert.equal(body.data[4].id, 10);

  assert.equal(body.meta.currentPage, 2);
  assert.equal(body.meta.totalPages, 3);
  assert.equal(body.meta.totalItems, 13);
  assert.equal(body.meta.limit, 5);
  assert.equal(body.meta.hasNextPage, true);
  assert.equal(body.meta.hasPrevPage, true);

  const pagedQuery = executedQueries.find((q) => q.sql.includes('LIMIT ? OFFSET ?'));
  assert.ok(pagedQuery);
  assert.equal(pagedQuery.args[pagedQuery.args.length - 2], 5);
  assert.equal(pagedQuery.args[pagedQuery.args.length - 1], 5);
  assert.ok(pagedQuery.args.includes('%tamil%'));
  assert.ok(pagedQuery.args.includes('%action%'));
});

test('Frontend code no longer requests limit=5000 or limit=1000 and wires server-side pagination UI', () => {
  const filesToCheck = [
    'src/App.tsx',
    'src/components/CatalogView.tsx',
    'src/components/ScheduleView.tsx',
    'src/components/AdminDashboard.tsx',
    'src/services/databaseService.ts',
    'src/services/cloudflareApi.ts',
  ];

  for (const relPath of filesToCheck) {
    const code = fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
    assert.equal(code.includes('limit: 5000'), false, `${relPath} must not request limit: 5000`);
    assert.equal(code.includes('limit: 1000'), false, `${relPath} must not request limit: 1000`);
  }

  const catalogViewCode = fs.readFileSync(path.join(process.cwd(), 'src/components/CatalogView.tsx'), 'utf-8');
  assert.ok(catalogViewCode.includes('aria-label="Previous page"'));
  assert.ok(catalogViewCode.includes('aria-label="Next page"'));
  assert.ok(catalogViewCode.includes('paginationMeta.totalPages'));
  assert.ok(catalogViewCode.includes('paginationMeta.currentPage'));
});
