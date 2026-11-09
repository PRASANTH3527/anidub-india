import test from 'node:test';
import assert from 'node:assert/strict';

// Test 1: Language distribution calculations
function calculateLanguageDistribution(catalog: Array<{ languages?: string }>) {
  const langStats = catalog.reduce((acc: any, anime) => {
    const langs = (anime.languages || '').split(',').map((l: string) => l.trim().toUpperCase());
    if (langs.length === 0 || (langs.length === 1 && langs[0] === '')) {
      acc.Hindi = (acc.Hindi || 0) + 1;
      acc.Tamil = (acc.Tamil || 0) + 1;
      acc.Telugu = (acc.Telugu || 0) + 1;
    } else {
      langs.forEach((l: string) => {
        if (l.includes('HIN')) acc.Hindi = (acc.Hindi || 0) + 1;
        else if (l.includes('TAM')) acc.Tamil = (acc.Tamil || 0) + 1;
        else if (l.includes('TEL')) acc.Telugu = (acc.Telugu || 0) + 1;
        else {
          acc.Hindi = (acc.Hindi || 0) + 1;
          acc.Tamil = (acc.Tamil || 0) + 1;
          acc.Telugu = (acc.Telugu || 0) + 1;
        }
      });
    }
    return acc;
  }, { Hindi: 0, Tamil: 0, Telugu: 0 });

  const totalLangs = (langStats.Hindi || 0) + (langStats.Tamil || 0) + (langStats.Telugu || 0);
  const hPct = totalLangs > 0 ? Math.round((langStats.Hindi / totalLangs) * 100) : 0;
  const tPct = totalLangs > 0 ? Math.round((langStats.Tamil / totalLangs) * 100) : 0;
  const tePct = totalLangs > 0 ? Math.max(100 - hPct - tPct, 0) : 0;

  return { hPct, tPct, tePct, totalLangs, langStats };
}

// Test 2: Pipe separated CSV row parser
function parseCsvRow(row: Record<string, string>) {
  const languages = typeof row['Languages'] === 'string'
    ? row['Languages'].split('|').map((l: string) => l.trim()).filter(Boolean)
    : [];
  const genres = typeof row['Genres'] === 'string'
    ? row['Genres'].split('|').map((g: string) => g.trim()).filter(Boolean)
    : [];
  const seasons = typeof row['Seasons'] === 'string'
    ? row['Seasons'].split('|').map((entry: string) => {
        const [name, eps] = entry.split(':');
        return {
          type: 'Season',
          name: name ? name.trim() : '',
          episodes: parseInt(eps) || null
        };
      }).filter((e: any) => e.name !== '')
    : [];

  return {
    title: row['Title'] || '',
    cover_image: row['Cover Image'] || '',
    year: parseInt(row['Release Year']) || null,
    languages,
    genres,
    studio: row['Studio'] || '',
    type: row['Type'] || 'TV Series',
    status: String(row['Status'] || '').toLowerCase().includes('complete') ? 'Completed' : 'Airing',
    episodes: parseInt(row['Episodes']) || null,
    platform: row['Platform'] || '',
    rating: parseFloat(row['Ratings']) || null,
    synopsis: row['Synopsis'] || '',
    mixed_entries: seasons
  };
}

test('Admin Dashboard - Language distribution calculation produces valid percentages without NaN', () => {
  // Empty catalog edge case
  const emptyRes = calculateLanguageDistribution([]);
  assert.equal(emptyRes.hPct, 0);
  assert.equal(emptyRes.tPct, 0);
  assert.equal(emptyRes.tePct, 0);

  // Populated catalog
  const catalog = [
    { languages: 'Hindi, Tamil' },
    { languages: 'Hindi' },
    { languages: 'Telugu' }
  ];
  const res = calculateLanguageDistribution(catalog);
  assert.equal(res.totalLangs, 4);
  assert.equal(res.hPct + res.tPct + res.tePct, 100);
});

test('Admin Dashboard - Strict 13-Column CSV row parsing with pipe delimiters', () => {
  const row = {
    'Title': 'Solo Leveling',
    'Cover Image': 'https://example.com/poster.jpg',
    'Release Year': '2024',
    'Languages': 'Tamil|Telugu|Hindi',
    'Genres': 'Action|Fantasy|Supernatural',
    'Studio': 'A-1 Pictures',
    'Type': 'TV Series',
    'Status': 'Completed',
    'Episodes': '12',
    'Platform': 'Crunchyroll',
    'Ratings': '8.5',
    'Synopsis': 'In a world where hunters battle deadly monsters...',
    'Seasons': 'Season 1:12|Season 2:13'
  };

  const parsed = parseCsvRow(row);
  assert.equal(parsed.title, 'Solo Leveling');
  assert.deepEqual(parsed.languages, ['Tamil', 'Telugu', 'Hindi']);
  assert.deepEqual(parsed.genres, ['Action', 'Fantasy', 'Supernatural']);
  assert.equal(parsed.status, 'Completed');
  assert.equal(parsed.mixed_entries.length, 2);
  assert.equal(parsed.mixed_entries[0].name, 'Season 1');
  assert.equal(parsed.mixed_entries[0].episodes, 12);
  assert.equal(parsed.mixed_entries[1].name, 'Season 2');
  assert.equal(parsed.mixed_entries[1].episodes, 13);
});

test('Admin Dashboard - Feedback item resolution removes resolved ticket by id', () => {
  const initialFeedback = [
    { id: 1, name_or_insta: 'NarutoFan', feedback_text: 'Please add Telugu dub for Bleach' },
    { id: 2, name_or_insta: 'Goku99', feedback_text: 'Crunchyroll link broken' }
  ];

  const targetId = 1;
  const filtered = initialFeedback.filter(f => f.id !== targetId);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 2);
});

test('Admin Dashboard - CSV Import deduplication rejects existing anime and keeps only new items for pending review', () => {
  const existingDatabaseAnime = [
    { title: 'Solo Leveling', status: 'approved' },
    { title: 'Demon Slayer: Kimetsu no Yaiba', status: 'approved' },
    { title: 'Naruto Shippuden', status: 'pending' }
  ];

  const normalize = (t: string) => t.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').replace(/["'“”‘’]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const simplify = (t: string) => normalize(t).replace(/[^a-z0-9]/g, '');

  const existingNormSet = new Set(existingDatabaseAnime.map(a => normalize(a.title)));
  const existingKeySet = new Set(existingDatabaseAnime.map(a => simplify(a.title)));

  const incomingCsvRows = [
    { title: 'Solo Leveling' }, // existing in DB (approved) -> must reject
    { title: 'solo leveling ' }, // case & trailing space duplicate -> must reject
    { title: 'Dr. Stone' }, // new -> must accept
    { title: 'Attack on Titan' }, // new -> must accept
    { title: 'Naruto Shippuden' }, // existing in DB (pending) -> must reject
    { title: 'Dr Stone' }, // duplicate of Dr. Stone in same batch -> must reject
    { title: 'Jujutsu Kaisen' } // new -> must accept
  ];

  const seenNorm = new Set<string>();
  const seenKey = new Set<string>();
  const acceptedForPending: any[] = [];
  const rejectedDuplicates: string[] = [];

  for (const row of incomingCsvRows) {
    const rawTitle = row.title;
    const norm = normalize(rawTitle);
    const key = simplify(rawTitle);

    if (existingNormSet.has(norm) || existingKeySet.has(key) || seenNorm.has(norm) || seenKey.has(key)) {
      rejectedDuplicates.push(rawTitle);
      continue;
    }

    seenNorm.add(norm);
    seenKey.add(key);
    acceptedForPending.push({ ...row, submissionStatus: 'pending' });
  }

  assert.equal(acceptedForPending.length, 3, 'Only 3 new titles should be accepted for pending');
  assert.equal(rejectedDuplicates.length, 4, '4 duplicate/existing titles should be rejected');
  assert.deepEqual(acceptedForPending.map(a => a.title), ['Dr. Stone', 'Attack on Titan', 'Jujutsu Kaisen']);
  assert.ok(acceptedForPending.every(a => a.submissionStatus === 'pending'));
});

