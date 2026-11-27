import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACTIVE_LANGUAGES,
  DEFAULT_LANGUAGE_CODE,
  I18N_NAMESPACES,
  LANGUAGE_BY_CODE,
  LANGUAGE_REGISTRY,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGE_CODES,
  formatLocaleDate,
  formatLocaleNumber,
  formatLocaleTime,
  isSupportedLanguage,
  normalizeRegionalSearchQuery,
  resolveDeviceLanguage,
  resolveEffectiveLanguage,
  sanitizeLanguagePreference,
  searchLanguages,
} from '../src/i18n/languageRegistry.ts';

const ROOT_DIR = process.cwd();
const LOCALES_DIR = path.join(ROOT_DIR, 'src', 'i18n', 'locales');

function flattenKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(value ?? '');
    }
  }
  return result;
}

function extractPlaceholders(value: string): string[] {
  const matches = value.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) || [];
  return matches.map((m) => m.replace(/\s+/g, '')).sort();
}

test('language registry exposes exactly 7 active Phase 1 languages plus future RTL-ready metadata', () => {
  assert.deepEqual(SUPPORTED_LANGUAGE_CODES, ['en', 'ta', 'hi', 'te', 'ml', 'kn', 'bn']);
  assert.equal(ACTIVE_LANGUAGES.length, 7);
  assert.equal(DEFAULT_LANGUAGE_CODE, 'en');
  assert.equal(LANGUAGE_STORAGE_KEY, 'anidub_ui_lang_v1');

  for (const code of SUPPORTED_LANGUAGE_CODES) {
    assert.ok(isSupportedLanguage(code));
    const meta = LANGUAGE_BY_CODE[code];
    assert.ok(meta, `Missing metadata for ${code}`);
    assert.equal(meta.enabled, true);
    assert.ok(meta.nativeName.length > 0);
    assert.ok(meta.englishName.length > 0);
    assert.ok(meta.bcp47.length >= 2);
    assert.equal(meta.dir, 'ltr');
  }

  // Verify future-ready RTL entries exist (Urdu / Arabic)
  const rtlEntries = LANGUAGE_REGISTRY.filter((l) => l.dir === 'rtl');
  assert.ok(rtlEntries.length >= 2, 'Expected RTL metadata entries for future expansion');
  assert.ok(rtlEntries.some((l) => l.code === 'ur'));
  assert.ok(rtlEntries.some((l) => l.code === 'ar'));
});

test('all 7 languages x 11 namespaces have 100% key parity, non-empty strings, and matching interpolation tokens', () => {
  assert.equal(I18N_NAMESPACES.length, 11);

  for (const ns of I18N_NAMESPACES) {
    const enPath = path.join(LOCALES_DIR, 'en', `${ns}.json`);
    assert.ok(fs.existsSync(enPath), `Missing English namespace file: ${enPath}`);
    const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const enFlat = flattenKeys(enJson);
    const enKeys = Object.keys(enFlat).sort();
    assert.ok(enKeys.length > 0, `English namespace ${ns} should not be empty`);

    for (const lang of SUPPORTED_LANGUAGE_CODES) {
      const langPath = path.join(LOCALES_DIR, lang, `${ns}.json`);
      assert.ok(fs.existsSync(langPath), `Missing ${lang} namespace file: ${langPath}`);
      const langJson = JSON.parse(fs.readFileSync(langPath, 'utf8'));
      const langFlat = flattenKeys(langJson);
      const langKeys = Object.keys(langFlat).sort();

      assert.deepEqual(
        langKeys,
        enKeys,
        `Key mismatch in ${lang}/${ns}.json compared to en/${ns}.json`
      );

      for (const key of enKeys) {
        assert.ok(
          langFlat[key].trim().length > 0,
          `Empty translation string at ${lang}/${ns}.json -> ${key}`
        );
        const expectedVars = extractPlaceholders(enFlat[key]);
        const actualVars = extractPlaceholders(langFlat[key]);
        assert.deepEqual(
          actualVars,
          expectedVars,
          `Placeholder mismatch at ${lang}/${ns}.json -> ${key}`
        );
      }
    }
  }
});

test('device language detection and preference sanitization resolve accurately with English fallback', () => {
  assert.equal(resolveDeviceLanguage(['ta-IN', 'en-IN']), 'ta');
  assert.equal(resolveDeviceLanguage(['fr-FR', 'hi_IN']), 'hi');
  assert.equal(resolveDeviceLanguage(['te-IN']), 'te');
  assert.equal(resolveDeviceLanguage(['ml']), 'ml');
  assert.equal(resolveDeviceLanguage(['kn-IN']), 'kn');
  assert.equal(resolveDeviceLanguage(['bn-BD']), 'bn');
  assert.equal(resolveDeviceLanguage(['de-DE', 'es-ES']), 'en');
  assert.equal(resolveDeviceLanguage([]), 'en');

  assert.equal(resolveEffectiveLanguage('auto', ['ta-IN']), 'ta');
  assert.equal(resolveEffectiveLanguage('auto', ['ja-JP']), 'en');
  assert.equal(resolveEffectiveLanguage('ml', ['ta-IN']), 'ml');

  assert.equal(sanitizeLanguagePreference('auto'), 'auto');
  assert.equal(sanitizeLanguagePreference('TA-IN'), 'ta');
  assert.equal(sanitizeLanguagePreference('hi'), 'hi');
  assert.equal(sanitizeLanguagePreference('unknown-lang'), 'en');
  assert.equal(sanitizeLanguagePreference(null), 'en');
});

test('language search matches English names, native scripts, ISO codes, and regions', () => {
  assert.equal(searchLanguages('').length, 7);
  assert.ok(searchLanguages('தமிழ்').some((l) => l.code === 'ta'));
  assert.ok(searchLanguages('telugu').some((l) => l.code === 'te'));
  assert.ok(searchLanguages('ಕನ್ನಡ').some((l) => l.code === 'kn'));
  assert.ok(searchLanguages('kerala').some((l) => l.code === 'ml'));
  assert.ok(searchLanguages('bn').some((l) => l.code === 'bn'));
  assert.equal(searchLanguages('klingon').length, 0);
});

test('Intl locale formatting helpers return non-empty formatted numbers, dates, and times safely', () => {
  const numEn = formatLocaleNumber(12450, 'en');
  const numTa = formatLocaleNumber(12450, 'ta');
  assert.ok(numEn.includes('12'));
  assert.ok(numTa.length > 0);
  assert.equal(formatLocaleNumber(Number.NaN, 'en'), '0');

  const dateTe = formatLocaleDate('2026-11-26T12:00:00Z', 'te');
  assert.ok(dateTe.length > 0);
  assert.equal(formatLocaleDate('not-a-date', 'en'), 'not-a-date');

  const timeHi = formatLocaleTime('2026-11-26T14:30:00Z', 'hi');
  assert.ok(timeHi.length > 0);
});

test('regional search query normalization converts native script queries and phonetic transliterations', () => {
  assert.equal(normalizeRegionalSearchQuery('தமிழ் நருடோ'), 'tamil naruto');
  assert.equal(normalizeRegionalSearchQuery('हिन्दी डीमन स्लेयर'), 'hindi demon slayer');
  assert.equal(normalizeRegionalSearchQuery('తెలుగు జుజుట్సు కైసెన్'), 'telugu jujutsu kaisen');
  assert.equal(normalizeRegionalSearchQuery('മലയാളം സോളോ ലെവലിംഗ്'), 'malayalam solo leveling');
  assert.equal(normalizeRegionalSearchQuery('tamizh one piece'), 'tamil one piece');
  assert.equal(normalizeRegionalSearchQuery('  Solo Leveling  '), 'Solo Leveling');
  assert.equal(normalizeRegionalSearchQuery('   '), '');
});

test('i18n architecture preserves strict isolation rules (no Google Translate widget, clean UI vs Dub filter separation)', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
  assert.ok(!indexHtml.includes('translate.google.com'), 'Must not include Google Translate widget');
  assert.ok(indexHtml.includes('Noto+Sans+Tamil'), 'index.html must load regional Noto Sans fonts');
  assert.ok(indexHtml.includes('display=swap'), 'Google Fonts must use display=swap');

  const languageSelectorSrc = fs.readFileSync(
    path.join(ROOT_DIR, 'src', 'components', 'i18n', 'LanguageSelector.tsx'),
    'utf8'
  );
  assert.ok(languageSelectorSrc.includes('data-testid="navbar-language-trigger"'));
  assert.ok(languageSelectorSrc.includes('data-testid="language-selector-modal"'));
  assert.ok(languageSelectorSrc.includes('data-testid="language-option-auto"'));

  const profileSrc = fs.readFileSync(
    path.join(ROOT_DIR, 'src', 'components', 'ProfileView.tsx'),
    'utf8'
  );
  assert.ok(profileSrc.includes('data-testid="profile-language-card"'));
  assert.ok(
    profileSrc.includes('anidub_preferred_lang') && profileSrc.includes('preferredDubTitle'),
    'Must preserve Preferred Dub Language separately from UI language'
  );
});
