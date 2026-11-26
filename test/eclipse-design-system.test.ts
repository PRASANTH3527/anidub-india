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

test('Eclipse 5: Reusable EmptyState, ErrorState, Modal, ConfirmDialog, and DynamicIsland Toast components use Eclipse tokens', () => {
  const eclipseStateCode = read('src/components/ui/EclipseState.tsx');
  assert.ok(eclipseStateCode.includes('export const EmptyState'), 'EclipseState must export EmptyState');
  assert.ok(eclipseStateCode.includes('export const ErrorState'), 'EclipseState must export ErrorState');
  assert.ok(eclipseStateCode.includes('export const Modal'), 'EclipseState must export Modal');
  assert.ok(eclipseStateCode.includes('export const ConfirmDialog'), 'EclipseState must export ConfirmDialog');
  assert.ok(eclipseStateCode.includes('bg-[#12141E]'), 'EclipseState components must use #12141E surface');
  assert.ok(eclipseStateCode.includes('border-[#292B39]'), 'EclipseState components must use #292B39 border');

  const toastCode = read('src/components/DynamicIsland.tsx');
  assert.ok(toastCode.includes('bg-[#12141E]'), 'DynamicIsland toast must use #12141E surface');
  assert.ok(toastCode.includes('border-[#292B39]'), 'DynamicIsland toast must use #292B39 border');
});

test('Eclipse 6: Page-specific Loading Skeletons replace generic spinners in App.tsx, ScheduleView, and CommunityChatView', () => {
  const skeletonCode = read('src/components/SkeletonGrid.tsx');
  const requiredSkeletons = [
    'DetailModalSkeleton',
    'SchedulePageSkeleton',
    'LibraryPageSkeleton',
    'ProfilePageSkeleton',
    'ChatPageSkeleton',
    'PageViewSkeleton',
  ];
  for (const name of requiredSkeletons) {
    assert.ok(skeletonCode.includes(name), `SkeletonGrid.tsx must export ${name}`);
  }
  assert.ok(skeletonCode.includes('bg-[#12141E]'), 'Skeletons must use #12141E surface');
  assert.ok(skeletonCode.includes('bg-[#191C29]'), 'Skeletons must use #191C29 elevated pulse');

  const appCode = read('src/App.tsx');
  assert.ok(appCode.includes('PageViewSkeleton'), 'App.tsx must use PageViewSkeleton for view loading fallback');
  assert.ok(appCode.includes('DetailModalSkeleton'), 'App.tsx must use DetailModalSkeleton for modal loading fallback');
  assert.ok(appCode.includes('duration: 0.16'), 'App.tsx must use subtle 160ms transitions');
});

test('Eclipse 7: All remaining pages adopt Eclipse Dark tokens (#12141E, #191C29, #292B39, #B49AF8) and standardized hierarchy', () => {
  const pagesToVerify = [
    'src/components/AnimeDetailPage.tsx',
    'src/components/WatchlistView.tsx',
    'src/components/CreateCollectionModal.tsx',
    'src/components/RecentlyViewedRow.tsx',
    'src/components/ProfileView.tsx',
    'src/components/AnimeDNAProfile.tsx',
    'src/components/PersonalAnimeStats.tsx',
    'src/components/ScheduleView.tsx',
    'src/components/RecommendationSystem.tsx',
    'src/components/CompareAnimeModal.tsx',
    'src/components/RouletteModal.tsx',
    'src/components/AnimeTierListMaker.tsx',
    'src/components/CommunityChatView.tsx',
    'src/components/FeedbackSection.tsx',
    'src/components/LegalPage.tsx',
    'src/components/ReportModal.tsx',
    'src/components/LiveChat.tsx',
    'src/components/DubInfoModal.tsx',
    'src/components/AdminDashboard.tsx',
  ];

  for (const relPath of pagesToVerify) {
    const code = read(relPath);
    assert.ok(code.includes('#12141E') || code.includes('#191C29'), `${relPath} must use Eclipse surface/elevated tokens`);
    assert.ok(code.includes('#292B39'), `${relPath} must use Eclipse border token #292B39`);
    assert.ok(code.includes('#B49AF8'), `${relPath} must use Eclipse primary accent #B49AF8`);
  }

  const detailCode = read('src/components/AnimeDetailPage.tsx');
  assert.ok(detailCode.includes('Where to Watch (India)'), 'AnimeDetailPage must keep prominent Where to Watch card');
  assert.ok(detailCode.includes("label: 'Overview'"), 'AnimeDetailPage must render Overview tab');
  assert.ok(detailCode.includes("label: 'Seasons & Dubs'"), 'AnimeDetailPage must render Seasons & Dubs tab');
  assert.ok(detailCode.includes("label: 'Watch Progress'"), 'AnimeDetailPage must render Watch Progress tab');
  assert.ok(detailCode.includes('Reviews ('), 'AnimeDetailPage must render Reviews tab');
});

test('Eclipse 8: Step 2 Explore Page layout has 44px/12px search, All/Tamil/Hindi/Telugu/More pills, Bottom Sheet filters, and collapsible OTT coverage strip', () => {
  const catalogCode = read('src/components/CatalogView.tsx');
  assert.ok(catalogCode.includes('h-[44px]') && catalogCode.includes('rounded-[12px]'), 'Search input must have 44px height and 12px border radius');
  assert.ok(catalogCode.includes('duration-180'), 'Language pills and filters must use 180ms transitions');
  assert.ok(catalogCode.includes("'all', 'tamil', 'hindi', 'telugu'"), 'Primary language pills must include All, Tamil, Hindi, Telugu');
  assert.ok(catalogCode.includes('More'), 'Language pills row must include More button for regional languages');
  assert.ok(catalogCode.includes('data-testid="active-filter-count-badge"'), 'Filters button must show active filter count badge');
  assert.ok(catalogCode.includes('data-testid="smart-filter-drawer"'), 'Filters must open the filter bottom sheet / panel');
  assert.ok(catalogCode.includes('Verified availability only'), 'Filter sheet must include Verified availability only toggle');
  assert.ok(catalogCode.includes('Fully dubbed seasons only'), 'Filter sheet must include Fully dubbed seasons only toggle');
  assert.ok(catalogCode.includes('Apply Filters'), 'Filter sheet must include Apply Filters action');
  assert.ok(catalogCode.includes('My Subscriptions &amp; OTT Coverage'), 'Explore page must include collapsible OTT coverage strip');
});

test('Eclipse 9: Step 3 AnimeCard uses 2:3 poster aspect ratio, 12px radius, single rating pill, 44x44px duotone bookmark button, elevated language chips, honest OTT footer, and Share/Compare/Report overflow menu', async () => {
  const { extractCompactLanguageCodes } = await import('../src/components/AnimeCard');
  assert.deepEqual(extractCompactLanguageCodes('Tamil, Hindi, Telugu'), ['TAM', 'HIN', 'TEL']);

  const cardCode = read('src/components/AnimeCard.tsx');
  assert.ok(cardCode.includes('aspect-[2/3]'), 'AnimeCard poster must use strict 2:3 aspect ratio');
  assert.ok(cardCode.includes('rounded-[12px]'), 'AnimeCard must use 12px rounded corners');
  assert.ok(cardCode.includes('bg-[#12141E]') && cardCode.includes('border-[#292B39]'), 'AnimeCard must use #12141E surface and 1px #292B39 border');
  assert.ok(cardCode.includes('w-11 h-11 min-w-[44px] min-h-[44px]'), 'Bookmark button must have 44x44px touch target');
  assert.ok(cardCode.includes('duration-180'), 'AnimeCard interactions must use 180ms transitions');
  assert.ok(cardCode.includes("fill={isBookmarked ? '#B49AF8' : 'none'}"), 'Bookmark icon must transition to duotone #B49AF8 fill when saved');
  assert.ok(cardCode.includes('line-clamp-2') && cardCode.includes('text-[#F4F3FA]'), 'Title must be #F4F3FA clamped to 2 lines');
  assert.ok(cardCode.includes('bg-[#191C29]'), 'Language badges must use #191C29 elevated chips');
  assert.ok(cardCode.includes("'Not verified'"), 'Missing platform must display Not verified instead of defaulting to Crunchyroll');
  assert.ok(cardCode.includes('<span>Share</span>'), 'Overflow menu must include Share');
  assert.ok(cardCode.includes('<span>Compare</span>'), 'Overflow menu must include Compare');
  assert.ok(cardCode.includes('<span>Report wrong info</span>'), 'Overflow menu must include Report wrong info');
});

test('Eclipse 10: Step 4 AnimeDetailPage features Where to Watch card, 4 real Eclipse tabs, Follow toggle, and explicit review delivery states', () => {
  const detailCode = read('src/components/AnimeDetailPage.tsx');
  assert.ok(detailCode.includes('data-testid="where-to-watch-card"'), 'AnimeDetailPage must render prominent Where to Watch card');
  assert.ok(detailCode.includes('data-testid="franchise-watch-order"'), 'AnimeDetailPage Overview must support Franchise Watch Order');
  assert.ok(detailCode.includes('DetailModalSkeleton'), 'AnimeDetailPage must render Eclipse DetailModalSkeleton while loading');
  assert.ok(detailCode.includes('Count not verified'), 'Seasons & Dubs tab must display Count not verified when episode counts are unknown');
  assert.ok(detailCode.includes('Posting…') && detailCode.includes('Failed — Retry'), 'Reviews tab must expose explicit Posting / Failed — Retry delivery states');
  assert.ok(detailCode.includes('Follow'), 'AnimeDetailPage header must include Follow button');
});

test('Eclipse 11: Step 5 ScheduleView enforces Eclipse Day Selector, data honesty, collapsed empty grids, and SchedulePageSkeleton', () => {
  const scheduleCode = read('src/components/ScheduleView.tsx');
  assert.ok(scheduleCode.includes('Release Schedule'), 'ScheduleView must display Release Schedule title');
  assert.ok(scheduleCode.includes('data-testid="schedule-empty-state"'), 'ScheduleView must collapse empty schedule grids into Eclipse EmptyState');
  assert.ok(scheduleCode.includes('Time not verified'), 'ScheduleView must show Time not verified instead of guessing broadcast times');
  assert.ok(scheduleCode.includes('SchedulePageSkeleton'), 'ScheduleView must use SchedulePageSkeleton for loading states');
});

test('Eclipse 12: Step 6 WatchlistView provides 6 status tabs, search/sort/CSV utility bar, +1 progress increment, ConfirmDialog removal, and LibraryPageSkeleton', () => {
  const libCode = read('src/components/WatchlistView.tsx');
  for (const label of ['Watching', 'Completed', 'Plan to Watch', 'On Hold', 'Dropped', 'Rewatching']) {
    assert.ok(libCode.includes(label), `WatchlistView must include status tab "${label}"`);
  }
  assert.ok(libCode.includes('Export Watchlist (CSV)'), 'WatchlistView must include one-click Export Watchlist (CSV)');
  assert.ok(libCode.includes('data-testid="library-anime-card"'), 'WatchlistView must render uniform 2:3 poster library cards');
  assert.ok(libCode.includes('ConfirmDialog'), 'WatchlistView must use ConfirmDialog before removing titles');
  assert.ok(libCode.includes('LibraryPageSkeleton'), 'WatchlistView must render LibraryPageSkeleton while loading');
});

test('Eclipse 13: Step 7 ProfileView enforces signed-out account isolation, Anime DNA, Settings & Support group, and strictly gated Admin link', () => {
  const profileCode = read('src/components/ProfileView.tsx');
  assert.ok(profileCode.includes('data-testid="profile-signed-out-card"'), 'ProfileView must render clean signed-out account isolation card');
  assert.ok(profileCode.includes('data-testid="profile-settings-support"'), 'ProfileView must render grouped Settings & Support card');
  assert.ok(profileCode.includes('isAuthorizedClerkAdmin'), 'ProfileView must gate Admin Dashboard link strictly behind isAuthorizedClerkAdmin');
  assert.ok(profileCode.includes('ProfilePageSkeleton'), 'ProfileView must render ProfilePageSkeleton while Clerk loads');
});

test('Eclipse 14: Step 8 Discovery Tools adopt Eclipse Dark surfaces, 2:3 posters, honest metadata, and mobile tap-to-assign tier controls', () => {
  const matchmaker = read('src/components/RecommendationSystem.tsx');
  assert.ok(matchmaker.includes('EmptyState'), 'RecommendationSystem must use Eclipse EmptyState');
  assert.ok(matchmaker.includes('aspect-[2/3]'), 'RecommendationSystem results must use 2:3 posters');

  const compare = read('src/components/CompareAnimeModal.tsx');
  assert.ok(compare.includes('Select Anime A') && compare.includes('Select Anime B'), 'CompareAnimeModal must provide clean Anime A & B picker slots');
  assert.ok(compare.includes('aspect-[2/3]'), 'CompareAnimeModal must use 2:3 posters');

  const tier = read('src/components/AnimeTierListMaker.tsx');
  assert.ok(tier.includes('data-testid="tier-tap-assign-bar"'), 'AnimeTierListMaker must include mobile tap-to-assign tier bar');
  assert.ok(tier.includes('aspect-[2/3]'), 'AnimeTierListMaker must use 2:3 posters');

  const roulette = read('src/components/RouletteModal.tsx');
  assert.ok(roulette.includes('Roll Random Anime'), 'RouletteModal must feature a single prominent Roll Random Anime CTA');
  assert.ok(roulette.includes('aspect-[2/3]'), 'RouletteModal result card must use 2:3 poster');
  assert.equal(roulette.includes('8.9'), false, 'RouletteModal must never invent fallback rating 8.9');
});

test('Eclipse 15: Step 9 Chat, Auth, Forms, Legal, and AdminDashboard adopt Eclipse Dark tokens, delivery states, reply previews, and ConfirmDialogs', () => {
  const liveChat = read('src/components/LiveChat.tsx');
  assert.ok(liveChat.includes('data-testid="chat-message-bubble"'), 'LiveChat must render elevated Eclipse message bubbles');
  assert.ok(liveChat.includes('data-testid="chat-reply-preview"'), 'LiveChat must support Reply preview above composer');
  assert.ok(liveChat.includes('Failed to send') && liveChat.includes('Sending…'), 'LiveChat must show explicit delivery states with Retry');

  const authModal = read('src/components/AuthModal.tsx');
  assert.ok(authModal.includes('bg-[#12141E]') && authModal.includes('border-[#292B39]') && authModal.includes('bg-[#B49AF8]'), 'AuthModal must use Eclipse Dark tokens');

  const dubModal = read('src/components/DubInfoModal.tsx');
  assert.ok(dubModal.includes('role="alert"') && dubModal.includes('min-h-[44px]'), 'DubInfoModal must show inline errors and 44px inputs');

  const adminDash = read('src/components/AdminDashboard.tsx');
  assert.ok(adminDash.includes('ConfirmDialog'), 'AdminDashboard must use ConfirmDialog for destructive actions');
  assert.ok(adminDash.includes('AdminSkeleton'), 'AdminDashboard must use AdminSkeleton instead of generic spinners');
  assert.ok(adminDash.split('\n').length < 2200, 'AdminDashboard must remain under 2200 lines');
});



