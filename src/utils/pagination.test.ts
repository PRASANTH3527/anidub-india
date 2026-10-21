import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePagination, filterAndSortCatalog } from './pagination.ts';

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
