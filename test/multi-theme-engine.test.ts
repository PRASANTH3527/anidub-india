import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CUSTOM_ACCENT_SWATCHES,
  CUSTOM_BG_PRESETS,
  DEFAULT_PERSISTED_THEME_STATE,
  THEME_BY_ID,
  THEME_REGISTRY,
} from '../src/themes/registry';
import {
  buildClerkAppearanceVariables,
  buildCustomCssVariableMap,
  computeContrastRatio,
  getAccessibleOnPrimary,
  normalizeHexColor,
  pickRandomThemeId,
  resolveEffectiveThemeId,
  resolveThemeBundle,
  sanitizePersistedThemeState,
  serializeThemeExport,
} from '../src/themes/utils';

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

test('Theme Engine 1: Registry defines all 12 exact original themes with WCAG AA >= 4.5:1 contrast', () => {
  assert.equal(THEME_REGISTRY.length, 12);

  const expectedIds = [
    'eclipse',
    'arctic-white',
    'amoled-black',
    'shadow-monarch',
    'crimson-flame',
    'infinity-void',
    'ocean-king',
    'black-grimoire',
    'shinobi-ember',
    'sakura-bloom',
    'emerald-spirit',
    'cyber-tokyo',
  ];

  assert.deepEqual(
    THEME_REGISTRY.map((t) => t.id),
    expectedIds
  );

  // Verify exact key palette tokens & WCAG AA >= 4.5:1 contrast for every theme
  for (const theme of THEME_REGISTRY) {
    const bodyOnCanvas = computeContrastRatio(theme.tokens.textPrimary, theme.tokens.bgCanvas);
    const bodyOnSurface = computeContrastRatio(theme.tokens.textPrimary, theme.tokens.bgSurface);
    const secondaryOnSurface = computeContrastRatio(
      theme.tokens.textSecondary,
      theme.tokens.bgSurface
    );
    const ctaContrast = computeContrastRatio(
      theme.tokens.accentOnPrimary,
      theme.tokens.accentPrimary
    );

    assert.ok(
      bodyOnCanvas >= 4.5,
      `${theme.id} textPrimary on bgCanvas contrast (${bodyOnCanvas.toFixed(2)}) must be >= 4.5`
    );
    assert.ok(
      bodyOnSurface >= 4.5,
      `${theme.id} textPrimary on bgSurface contrast (${bodyOnSurface.toFixed(2)}) must be >= 4.5`
    );
    assert.ok(
      secondaryOnSurface >= 4.5,
      `${theme.id} textSecondary on bgSurface contrast (${secondaryOnSurface.toFixed(2)}) must be >= 4.5`
    );
    assert.ok(
      ctaContrast >= 4.5,
      `${theme.id} accentOnPrimary on accentPrimary contrast (${ctaContrast.toFixed(2)}) must be >= 4.5`
    );
  }

  // Spot-check exact hex specs from design contract
  assert.equal(THEME_BY_ID['eclipse'].tokens.bgCanvas, '#0B0A10');
  assert.equal(THEME_BY_ID['eclipse'].tokens.accentPrimary, '#B49AF8');
  assert.equal(THEME_BY_ID['arctic-white'].tokens.bgCanvas, '#F8FAFC');
  assert.equal(THEME_BY_ID['arctic-white'].tokens.accentPrimary, '#6D28D9');
  assert.equal(THEME_BY_ID['arctic-white'].mode, 'light');
  assert.equal(THEME_BY_ID['amoled-black'].tokens.bgCanvas, '#000000');
  assert.equal(THEME_BY_ID['sakura-bloom'].tokens.bgCanvas, '#FFF5F7');
  assert.equal(THEME_BY_ID['sakura-bloom'].tokens.accentPrimary, '#DB2777');
  assert.equal(THEME_BY_ID['sakura-bloom'].mode, 'light');
  assert.equal(THEME_BY_ID['cyber-tokyo'].tokens.accentPrimary, '#22D3EE');
});

test('Theme Engine 2: Contrast calculator picks readable on-primary ink for any custom accent hex', () => {
  assert.equal(normalizeHexColor('b49af8'), '#B49AF8');
  assert.equal(normalizeHexColor('#fff'), '#FFFFFF');
  assert.equal(normalizeHexColor('invalid'), null);

  // Bright accents -> dark ink (#0B0A10)
  assert.equal(getAccessibleOnPrimary('#B49AF8'), '#0B0A10');
  assert.equal(getAccessibleOnPrimary('#EAB308'), '#0B0A10');
  assert.equal(getAccessibleOnPrimary('#22D3EE'), '#0B0A10');
  assert.equal(getAccessibleOnPrimary('#34D399'), '#0B0A10');

  // Deep saturated accents -> white ink (#FFFFFF)
  assert.equal(getAccessibleOnPrimary('#6D28D9'), '#FFFFFF');
  assert.equal(getAccessibleOnPrimary('#1D4ED8'), '#FFFFFF');
  assert.equal(getAccessibleOnPrimary('#991B1B'), '#FFFFFF');
});

test('Theme Engine 3: System mode resolution, Custom Studio overrides, sanitization, random picker, and JSON export', () => {
  // System mode follows prefers-color-scheme
  const sysState = {
    ...DEFAULT_PERSISTED_THEME_STATE,
    modePreference: 'system' as const,
    lastDarkThemeId: 'shadow-monarch' as const,
    lastLightThemeId: 'sakura-bloom' as const,
  };
  assert.equal(resolveEffectiveThemeId(sysState, true), 'shadow-monarch');
  assert.equal(resolveEffectiveThemeId(sysState, false), 'sakura-bloom');

  // Custom Studio overrides compute accessible accent ink, mode, and clamped radius
  const customState = sanitizePersistedThemeState({
    themeId: 'eclipse',
    modePreference: 'dark',
    custom: {
      enabled: true,
      bgPresetId: 'clean-light',
      accentColor: '#1D4ED8',
      radiusPx: 18,
      highContrast: true,
      reduceMotion: true,
    },
  });

  const bundle = resolveThemeBundle(customState, true);
  assert.equal(bundle.mode, 'light');
  assert.equal(bundle.tokens.bgCanvas, '#F8FAFC');
  assert.equal(bundle.tokens.accentPrimary, '#1D4ED8');
  assert.equal(bundle.tokens.accentOnPrimary, '#FFFFFF');
  assert.equal(bundle.tokens.radiusCard, '18px');
  assert.equal(bundle.tokens.radiusControl, '14px');

  const cssVars = buildCustomCssVariableMap(customState, true);
  assert.equal(cssVars['--bg-canvas'], '#F8FAFC');
  assert.equal(cssVars['--accent-primary'], '#1D4ED8');
  assert.equal(cssVars['--accent-on-primary'], '#FFFFFF');
  assert.equal(cssVars['--radius-card'], '18px');

  const exported = JSON.parse(serializeThemeExport(customState, true));
  assert.equal(exported.themeId, 'custom');
  assert.equal(exported.mode, 'light');
  assert.equal(exported.highContrast, true);
  assert.equal(exported.reduceMotion, true);

  // Random theme picker never returns the currently active theme
  const next = pickRandomThemeId('eclipse', () => 0);
  assert.notEqual(next, 'eclipse');

  // Dynamic Clerk appearance maps cleanly to active theme tokens
  const clerk = buildClerkAppearanceVariables(bundle.tokens, bundle.mode);
  assert.equal(clerk.variables.colorPrimary, '#1D4ED8');
  assert.equal(clerk.variables.colorBackground, '#FFFFFF');
  assert.equal(clerk.variables.colorText, '#0F172A');

  assert.equal(CUSTOM_BG_PRESETS.length, 7);
  assert.equal(CUSTOM_ACCENT_SWATCHES.length, 8);
});

test('Theme Engine 4: Zero-flash boot script, tokens.css 12 theme blocks, light-mode logo guard, and UI integration', () => {
  const tokensCss = read('src/styles/tokens.css');
  for (const theme of THEME_REGISTRY) {
    assert.ok(
      tokensCss.includes(`:root[data-theme="${theme.id}"]`),
      `tokens.css must define selector for ${theme.id}`
    );
  }
  assert.ok(tokensCss.includes(':root[data-high-contrast="true"]'));
  assert.ok(tokensCss.includes(':root[data-reduced-motion="true"]'));
  assert.ok(tokensCss.includes('.anidub-logo-wrap'));
  assert.ok(tokensCss.includes('background: #12141E;'));
  assert.ok(tokensCss.includes('padding: 4px 10px;'));

  const indexCss = read('src/index.css');
  assert.ok(indexCss.includes('@custom-variant dark'));
  assert.ok(indexCss.includes('@import "./styles/tokens.css";'));

  const indexHtml = read('index.html');
  assert.ok(indexHtml.includes('anidub_theme_state_v1'), 'index.html must include zero-flash boot script');
  assert.ok(indexHtml.includes('data-theme'), 'boot script must set data-theme before React renders');
  assert.ok(indexHtml.includes('var(--bg-canvas)'), 'body must bind to var(--bg-canvas)');

  const navbar = read('src/components/Navbar.tsx');
  assert.ok(navbar.includes('data-testid="navbar-appearance-trigger"'));
  assert.ok(navbar.includes('Palette'));

  const profile = read('src/components/ProfileView.tsx');
  assert.ok(profile.includes('data-testid="profile-appearance-card"'));
  assert.ok(
    profile.includes('Appearance &amp; Themes') || profile.includes('Appearance & Themes')
  );

  const logo = read('src/components/AniDubLogo.tsx');
  assert.ok(logo.includes('anidub-logo-wrap'));
  assert.ok(logo.includes('/logo.png?v=2'));
});
