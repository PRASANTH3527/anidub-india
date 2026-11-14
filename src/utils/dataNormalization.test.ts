import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePlatformString,
  parseCsvMixedEntriesAndEpisodesPerSeason,
  parseOptionalEpisodesCount,
  parseOptionalSeason,
} from './dataNormalization.ts';

test('normalizePlatformString splits, trims, deduplicates, sorts alphabetically, and joins with pipe', () => {
  assert.equal(normalizePlatformString('JioHotstar|Crunchyroll'), 'Crunchyroll|JioHotstar');
  assert.equal(normalizePlatformString('  JioHotstar  | Crunchyroll |  Netflix '), 'Crunchyroll|JioHotstar|Netflix');
  assert.equal(normalizePlatformString('SonyLIV, Crunchyroll, crunchyroll, Prime Video'), 'Crunchyroll|Prime Video|SonyLIV');
  assert.equal(normalizePlatformString(['Netflix', ' Crunchyroll ', '']), 'Crunchyroll|Netflix');
  assert.equal(normalizePlatformString('Crunchyroll'), 'Crunchyroll');
  assert.equal(normalizePlatformString('   |  | '), '');
  assert.equal(normalizePlatformString(null), '');
  assert.equal(normalizePlatformString(undefined), '');
});

test('parseOptionalSeason parses explicit season values and returns null when omitted instead of Spring', () => {
  assert.equal(parseOptionalSeason({ Season: 'Fall' }), 'Fall');
  assert.equal(parseOptionalSeason({ release_season: '  Winter 2025  ' }), 'Winter 2025');
  assert.equal(parseOptionalSeason({ 'Release Season': 'Summer' }), 'Summer');
  assert.equal(parseOptionalSeason({ season: 'Spring' }), 'Spring');
  assert.equal(parseOptionalSeason({ season: '' }), null);
  assert.equal(parseOptionalSeason({ title: 'No Season Row' }), null);
  assert.equal(parseOptionalSeason(undefined), null);
  assert.equal(parseOptionalSeason(null), null);
});

test('parseOptionalEpisodesCount parses explicit counts or mixedEntries sum and returns null instead of 12 when omitted', () => {
  assert.equal(parseOptionalEpisodesCount({ Episodes: '24' }), 24);
  assert.equal(parseOptionalEpisodesCount({ episodes_count: 13 }), 13);
  assert.equal(parseOptionalEpisodesCount({ episodes: '  48 ' }), 48);
  assert.equal(parseOptionalEpisodesCount({ Episodes: '' }), null);
  assert.equal(parseOptionalEpisodesCount({ title: 'Unknown Episode Count' }), null);
  assert.equal(
    parseOptionalEpisodesCount({ Episodes: '' }, [
      { name: 'Season 1', episodes: 26 },
      { name: 'Season 2', episodes: 11 },
    ]),
    37
  );
  assert.equal(
    parseOptionalEpisodesCount({ title: 'No Episodes Anywhere' }, [
      { name: 'Season 1', episodes: null },
    ]),
    null
  );
});

test('parseCsvMixedEntriesAndEpisodesPerSeason never injects 12 when season episodes are missing', () => {
  const emptyRes = parseCsvMixedEntriesAndEpisodesPerSeason('', undefined, undefined);
  assert.deepEqual(emptyRes.mixedEntries, []);
  assert.equal(emptyRes.episodesPerSeason, '');

  const noEpRes = parseCsvMixedEntriesAndEpisodesPerSeason('Season 1|Season 2', undefined, undefined);
  assert.equal(noEpRes.mixedEntries.length, 2);
  assert.equal(noEpRes.mixedEntries[0].episodes, null);
  assert.equal(noEpRes.episodesPerSeason, '');

  const withEpRes = parseCsvMixedEntriesAndEpisodesPerSeason('Season 1:26|Season 2:11', undefined, undefined);
  assert.equal(withEpRes.mixedEntries.length, 2);
  assert.equal(withEpRes.episodesPerSeason, '26|11');
});
