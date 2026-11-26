import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NATIVE_LANGUAGE_SCRIPT } from '../src/components/CatalogView';

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

test('Eclipse 1: index.css centralizes all exact AniDub Eclipse dark design tokens', () => {
  const css = read('src/index.css');
  const requiredTokens = [
    '#0B0A10', // Background
    '#12141E', // Surface
    '#191C29', // Elevated Surface
    '#B49AF8', // Primary Accent (Solid Soft Violet)
    '#CBB6FF', // Secondary Accent
    '#F4F3FA', // Main Text
    '#A1A5B5', // Muted Text
    '#292B39', // Border
    '#34D399', // Success
    '#F9C876', // Rating
    '#F87171', // Error
  ];

  for (const hex of requiredTokens) {
    assert.ok(css.includes(hex), `index.css must define Eclipse token ${hex}`);
  }
  assert.ok(css.includes('prefers-reduced-motion'), 'index.css must respect prefers-reduced-motion');
});

test('Eclipse 2: IconRegistry.tsx defines 24x24 signature SVG icons with 1.8px rounded strokes and outline/duotone active variants', () => {
  const registry = read('src/components/IconRegistry.tsx');
  assert.ok(registry.includes('viewBox="0 0 24 24"'), 'Icons must use 24x24 viewBox');
  assert.ok(registry.includes('strokeWidth="1.8"'), 'Icons must use 1.8px stroke width');
  assert.ok(registry.includes('strokeLinecap="round"'), 'Icons must use rounded stroke caps');
  assert.ok(registry.includes('ExploreIcon'), 'IconRegistry must export ExploreIcon');
  assert.ok(registry.includes('ScheduleIcon'), 'IconRegistry must export ScheduleIcon');
  assert.ok(registry.includes('LibraryIcon'), 'IconRegistry must export LibraryIcon');
  assert.ok(registry.includes('ProfileIcon'), 'IconRegistry must export ProfileIcon');
  assert.ok(registry.includes('SignatureNavIcon'), 'IconRegistry must export SignatureNavIcon');
  assert.ok(registry.includes("fill={active ? '#B49AF8' : 'none'}"), 'Active variant must include duotone fill');
});

test('Eclipse 3: Reusable Button system and 4-tab mobile navigation with Mobile Bottom Sheet and gated Admin link', () => {
  const buttonCode = read('src/components/ui/Button.tsx');
  assert.ok(buttonCode.includes('min-h-[44px]'), 'Button must support 44px height');
  assert.ok(buttonCode.includes('min-h-[48px]'), 'Button must support 48px height');
  assert.ok(buttonCode.includes('sm:min-h-[40px]'), 'Button must support 40px compact desktop height with 44px mobile touch target');
  assert.ok(buttonCode.includes('bg-[#B49AF8]'), 'Primary button must use #B49AF8 solid soft violet');

  const navbarCode = read('src/components/Navbar.tsx');
  assert.ok(navbarCode.includes('SignatureNavIcon'), 'Navbar must render SignatureNavIcon for the 4 primary tabs');
  assert.ok(navbarCode.includes('data-testid="mobile-more-bottom-sheet"'), 'Mobile More menu must use an accessible Mobile Bottom Sheet');
  assert.ok(navbarCode.includes('isAuthorizedAdminUser'), 'Navbar must gate Admin Dashboard link behind isAuthorizedAdminUser');
  assert.equal(navbarCode.includes("id: 'home'"), false, 'Removed Home tab must not be reintroduced');
});

test('Eclipse 4: Compact Explore layout with native script language pills and poster-first AnimeCard', () => {
  assert.equal(NATIVE_LANGUAGE_SCRIPT.tamil, 'தமிழ்');
  assert.equal(NATIVE_LANGUAGE_SCRIPT.hindi, 'हिन्दी');
  assert.equal(NATIVE_LANGUAGE_SCRIPT.telugu, 'తెలుగు');

  const catalogCode = read('src/components/CatalogView.tsx');
  assert.ok(catalogCode.includes('NATIVE_LANGUAGE_SCRIPT'), 'CatalogView must render native language script badges');
  assert.ok(catalogCode.includes('Find anime in your language'), 'CatalogView must keep compact heading');
  assert.equal(catalogCode.includes('🔥 Most Upvoted'), false, 'CatalogView sort options must not use random emoji icons');

  const cardCode = read('src/components/AnimeCard.tsx');
  assert.ok(cardCode.includes('bg-[#12141E]'), 'AnimeCard must use Eclipse surface #12141E');
  assert.ok(cardCode.includes('border-[#292B39]'), 'AnimeCard must use Eclipse border #292B39');
  assert.ok(cardCode.includes('line-clamp-2'), 'AnimeCard must enforce 2-line title clamp');
  assert.ok(cardCode.includes('w-11 h-11'), 'AnimeCard bookmark button must have a 44x44px touch target');
});
