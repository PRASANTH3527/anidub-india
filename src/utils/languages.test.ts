import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLanguageName,
  extractUniqueLanguagesFromAnimeList,
  formatLanguagesBulletList,
  calculateCatalogStats
} from './languages.ts';

test('normalizeLanguageName maps codes and abbreviations to proper language names', () => {
  assert.equal(normalizeLanguageName('hin'), 'Hindi');
  assert.equal(normalizeLanguageName('HI'), 'Hindi');
  assert.equal(normalizeLanguageName('TAM'), 'Tamil');
  assert.equal(normalizeLanguageName('ta'), 'Tamil');
  assert.equal(normalizeLanguageName('tel'), 'Telugu');
  assert.equal(normalizeLanguageName('mal'), 'Malayalam');
  assert.equal(normalizeLanguageName('kan'), 'Kannada');
  assert.equal(normalizeLanguageName('eng'), 'English');
  assert.equal(normalizeLanguageName('  Hindi  '), 'Hindi');
  assert.equal(normalizeLanguageName('Tamil'), 'Tamil');
});

test('extractUniqueLanguagesFromAnimeList extracts unique languages from mixed anime records', () => {
  const sampleAnime = [
    { id: 1, title: 'Solo Leveling', languages: 'HIN,TAM,TEL' },
    { id: 2, title: 'Demon Slayer', languages: 'Hindi, Tamil' },
    { id: 3, title: 'Jujutsu Kaisen', languages: 'TAM, MAL' },
    { id: 4, title: 'Naruto', languages: ['Telugu', 'Kannada'] }
  ];

  const unique = extractUniqueLanguagesFromAnimeList(sampleAnime);
  assert.deepEqual(unique, ['Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada']);
  assert.equal(unique.length, 5);
});

test('extractUniqueLanguagesFromAnimeList handles empty or single language lists', () => {
  assert.deepEqual(extractUniqueLanguagesFromAnimeList([]), []);
  assert.deepEqual(extractUniqueLanguagesFromAnimeList([{ id: 1, languages: '' }]), []);
  assert.deepEqual(extractUniqueLanguagesFromAnimeList([{ id: 1, languages: 'Hindi' }]), ['Hindi']);
  assert.deepEqual(extractUniqueLanguagesFromAnimeList([{ id: 1, languages: 'Hindi, Tamil' }]), ['Hindi', 'Tamil']);
});

test('formatLanguagesBulletList joins languages with bullet separator', () => {
  assert.equal(formatLanguagesBulletList(['Hindi', 'Tamil']), 'Hindi • Tamil');
  assert.equal(formatLanguagesBulletList(['Hindi', 'Tamil', 'Telugu']), 'Hindi • Tamil • Telugu');
  assert.equal(formatLanguagesBulletList(['Hindi']), 'Hindi');
  assert.equal(formatLanguagesBulletList([]), 'None');
});

test('calculateCatalogStats computes accurate dynamic values', () => {
  const sampleAnime = [
    { id: 1, languages: 'HIN,TAM', popularity: 10, likesCount: 5 },
    { id: 2, languages: 'TAM,TEL', popularity: 20, likesCount: 15 }
  ];

  const stats = calculateCatalogStats(sampleAnime);
  assert.equal(stats.totalAnime, 2);
  assert.equal(stats.totalVotes, 50); // 10+5 + 20+15 = 50
  assert.equal(stats.totalLanguages, 3);
  assert.deepEqual(stats.languagesList, ['Hindi', 'Tamil', 'Telugu']);
  assert.equal(stats.languagesString, 'Hindi • Tamil • Telugu');
});

test('extractUniqueLanguagesFromAnimeList strictly filters out Japanese, English, Romaji, Korean, and Chinese', () => {
  const animeWithForeignLangs = [
    { id: 1, languages: 'Hindi, Japanese' },
    { id: 2, languages: 'English, Tamil, Romaji' },
    { id: 3, languages: ['Telugu', 'JPN', 'ENG'] },
    { id: 4, languages: 'Korean, Chinese, Malayalam' }
  ];

  const filtered = extractUniqueLanguagesFromAnimeList(animeWithForeignLangs);
  assert.deepEqual(filtered, ['Hindi', 'Tamil', 'Telugu', 'Malayalam']);
  assert.equal(filtered.length, 4);

  const stats = calculateCatalogStats(animeWithForeignLangs);
  assert.equal(stats.totalLanguages, 4);
  assert.equal(stats.languagesString, 'Hindi • Tamil • Telugu • Malayalam');
  assert.equal(stats.languagesList.includes('Japanese'), false);
  assert.equal(stats.languagesList.includes('English'), false);
  assert.equal(stats.languagesList.includes('Romaji'), false);
  assert.equal(stats.languagesList.includes('Korean'), false);
  assert.equal(stats.languagesList.includes('Chinese'), false);
});

