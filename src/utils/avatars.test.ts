import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Avatar Library Verification', () => {
  it('contains at least 40-50 anime characters with valid URLs and categories', () => {
    const profilePath = path.resolve(process.cwd(), 'src/components/ProfileView.tsx');
    const content = fs.readFileSync(profilePath, 'utf-8');

    // Extract RICH_ANIME_AVATARS array
    const match = content.match(/const RICH_ANIME_AVATARS:\s*AnimeAvatarOption\[\]\s*=\s*\[([\s\S]*?)\];/);
    assert.ok(match, 'RICH_ANIME_AVATARS array must exist in ProfileView.tsx');

    const avatarsRaw = match[1];
    const characterEntries = [...avatarsRaw.matchAll(/\{\s*name:\s*['"]([^'"]+)['"],\s*category:\s*['"]([^'"]+)['"],\s*url:\s*['"]([^'"]+)['"]\s*\}/g)];

    assert.ok(characterEntries.length >= 40, `Avatar count must be at least 40 (found ${characterEntries.length})`);
    assert.ok(characterEntries.length <= 65, `Avatar count should be reasonable (found ${characterEntries.length})`);

    const names = characterEntries.map(e => e[1]);
    const categories = new Set(characterEntries.map(e => e[2]));
    const urls = characterEntries.map(e => e[3]);

    // Check key required characters
    const requiredCharacters = [
      'Sung Jin-woo',
      'Cha Hae-in',
      'Roronoa Zoro',
      'Sanji',
      'Itachi Uchiha',
      'Kakashi Hatake',
      'Madara Uchiha',
      'Levi Ackerman',
      'Eren Yeager',
      'Mikasa Ackerman',
      'Nezuko Kamado',
      'Zenitsu Agatsuma',
      'Kyojuro Rengoku',
      'Tengen Uzui',
      'Yuji Itadori',
      'Sukuna',
      'Toji Fushiguro',
      'Saitama',
      'Garou',
      'Light Yagami',
      'L Lawliet',
      'Goku',
      'Vegeta',
      'Ichigo Kurosaki',
      'Sosuke Aizen'
    ];

    for (const reqChar of requiredCharacters) {
      assert.ok(
        names.includes(reqChar),
        `Character "${reqChar}" must be present in the avatar library`
      );
    }

    // Check categories
    const validCategories = new Set(['Shonen', 'Villains', 'Swordsmen', 'Hunters', 'Ninjas']);
    for (const cat of categories) {
      assert.ok(validCategories.has(cat), `Category "${cat}" must be one of the specified categories`);
    }

    // Verify all URLs are secure https and start with valid CDN
    for (const url of urls) {
      assert.ok(url.startsWith('https://'), `URL "${url}" must be secure HTTPS`);
      assert.ok(url.includes('anilist.co'), `URL "${url}" should use reliable CDN`);
    }

    // Check AVATAR_CATEGORIES array has the exact tabs
    const catMatch = content.match(/const AVATAR_CATEGORIES\s*=\s*\[([\s\S]*?)\](?:\s*as\s+const)?;/);
    assert.ok(catMatch, 'AVATAR_CATEGORIES must exist');
    const tabs = [...catMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
    assert.deepStrictEqual(tabs, ['All', 'Shonen', 'Villains', 'Swordsmen', 'Hunters', 'Ninjas']);
  });
});
