import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NATIVE_LANGUAGE_SCRIPT } from '../src/components/CatalogView';

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

test('Eclipse 1: tokens.css & index.css centralize all exact AniDub Eclipse dark design tokens and typography scale', () => {
  const css = read('src/index.css') + '\n' + read('src/styles/tokens.css');
  const requiredTokens = [
    '#0B0A10', // Canvas / Background
    '#12141E', // Surface
    '#191C29', // Elevated Surface
    '#B49AF8', // Primary Accent
    '#CBB6FF', // Selected Accent
    '#F4F3FA', // Primary Text
    '#A1A5B5', // Secondary Text
    '#292B39', // Border
    '#34D399', // Success
    '#F9C876', // Rating
    '#F87171', // Danger / Error
    '--font-size-page-heading-mobile: 24px',
    '--font-size-page-heading-desktop: 30px',
    '--font-size-section-heading-mobile: 18px',
    '--font-size-section-heading-desktop: 22px',
    '--font-size-card-title: 14px',
    '--line-height-card-title: 20px',
    '--font-size-body-mobile: 15px',
    '--font-size-body-desktop: 16px',
    '--font-size-meta: 12px',
    '--font-size-nav-label: 11px',
  ];

  for (const token of requiredTokens) {
    assert.ok(css.includes(token), `tokens.css/index.css must define Eclipse token ${token}`);
  }
  assert.ok(css.includes('prefers-reduced-motion'), 'index.css must respect prefers-reduced-motion');
});

test('Eclipse 2: IconRegistry.tsx defines 24x24 signature SVG icons with 1.8px rounded strokes and outline/duotone active variants for tabs and Direct 5-Icon Feature Bar', () => {
  const registry = read('src/components/IconRegistry.tsx');
  assert.ok(registry.includes('viewBox="0 0 24 24"'), 'Icons must use 24x24 viewBox');
  assert.ok(registry.includes('strokeWidth="1.8"'), 'Icons must use 1.8px stroke width');
  assert.ok(registry.includes('strokeLinecap="round"'), 'Icons must use rounded stroke caps');
  for (const iconExport of [
    'ExploreIcon',
    'ScheduleIcon',
    'LibraryIcon',
    'ProfileIcon',
    'ForYouIcon',
    'CompareIcon',
    'TierListIcon',
    'ChatIcon',
    'SubmitIcon',
    'SearchNavIcon',
    'SignatureNavIcon',
  ]) {
    assert.ok(registry.includes(iconExport), `IconRegistry must export ${iconExport}`);
  }
  assert.ok(registry.includes("fill={active ? 'var(--accent-primary)' : 'none'}"), 'Active variant must include duotone accent fill');
});

test('Eclipse 3: Reusable Button/IconButton system, single-row flagship header, 5-tab mobile bottom nav, and Tools Bottom Sheet / Popover menu', () => {
  const buttonCode = read('src/components/ui/Button.tsx');
  assert.ok(buttonCode.includes('min-h-[44px]'), 'Button must support 44px height');
  assert.ok(buttonCode.includes('min-h-[48px]'), 'Button must support 48px height');
  assert.ok(buttonCode.includes('sm:min-h-[40px]'), 'Button must support 40px compact desktop height with 44px mobile touch target');
  assert.ok(buttonCode.includes('bg-[var(--accent-primary)]'), 'Primary button must use semantic accent primary token');
  assert.ok(buttonCode.includes('export const IconButton'), 'Button.tsx must export IconButton primitive');

  const navbarCode = read('src/components/Navbar.tsx');
  assert.ok(navbarCode.includes('AniDubLogo'), 'Navbar must keep the AniDub India logo');
  assert.ok(navbarCode.includes('h-[56px] lg:h-[64px]'), 'Top header must be 56px mobile and 64px desktop');
  assert.equal(navbarCode.includes('data-testid="direct-feature-bar"'), false, 'Second sub-header row must be completely removed');
  assert.ok(navbarCode.includes('data-testid="navbar-search-shortcut"'), 'Navbar must render a 44x44px Search shortcut icon on the right');
  assert.ok(navbarCode.includes('data-testid="navbar-tools-trigger"'), 'Navbar must render a 44x44px Tools trigger button on the right');
  assert.ok(navbarCode.includes('LayoutGrid'), 'Tools trigger must use clean 4-squares LayoutGrid icon');
  assert.ok(navbarCode.includes('grid-cols-5'), 'Mobile bottom navigation bar must display 5 evenly spaced tabs');
  assert.ok(navbarCode.includes('data-testid="tools-mobile-bottom-sheet"'), 'Mobile Tools trigger must open a Bottom Sheet');
  assert.ok(navbarCode.includes('data-testid="tools-desktop-popover"'), 'Desktop Tools trigger must open an anchored Popover Dropdown');
  for (const label of ['For You', 'Compare', 'Tier List', 'Submit Anime']) {
    assert.ok(navbarCode.includes(`'${label}'`), `Tools menu must include "${label}"`);
  }
  assert.equal(navbarCode.includes('MoreHorizontal'), false, 'Three-Dot ("More") menu button must not be reintroduced');
  assert.ok(navbarCode.includes('SignatureNavIcon'), 'Navbar must render SignatureNavIcon for primary tabs and tools');
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
  assert.ok(cardCode.includes('bg-[var(--bg-surface)]'), 'AnimeCard must use semantic surface token');
  assert.ok(cardCode.includes('border-[var(--border-subtle)]'), 'AnimeCard must use semantic border token');
  assert.ok(cardCode.includes('line-clamp-2'), 'AnimeCard must enforce 2-line title clamp');
  assert.ok(cardCode.includes('w-11 h-11'), 'AnimeCard bookmark button must have a 44x44px touch target');
});

test('Eclipse 5: Reusable EmptyState, ErrorState, Modal/BottomSheet (with scroll lock), ConfirmDialog, and DynamicIsland Toast above bottom nav use semantic theme tokens', () => {
  const eclipseStateCode = read('src/components/ui/EclipseState.tsx');
  assert.ok(eclipseStateCode.includes('export const EmptyState'), 'EclipseState must export EmptyState');
  assert.ok(eclipseStateCode.includes('export const ErrorState'), 'EclipseState must export ErrorState');
  assert.ok(eclipseStateCode.includes('export const Modal'), 'EclipseState must export Modal');
  assert.ok(eclipseStateCode.includes('export const BottomSheet'), 'EclipseState must export BottomSheet');
  assert.ok(eclipseStateCode.includes('export const ConfirmDialog'), 'EclipseState must export ConfirmDialog');
  assert.ok(eclipseStateCode.includes("document.body.style.overflow = 'hidden'"), 'Modal/BottomSheet must enforce background scroll lock');
  assert.ok(eclipseStateCode.includes('bg-[var(--bg-surface)]'), 'EclipseState components must use semantic surface token');
  assert.ok(eclipseStateCode.includes('border-[var(--border-subtle)]'), 'EclipseState components must use semantic border token');

  const toastCode = read('src/components/DynamicIsland.tsx');
  assert.ok(toastCode.includes('bg-[var(--bg-surface)]'), 'DynamicIsland toast must use semantic surface token');
  assert.ok(toastCode.includes('border-[var(--border-subtle)]'), 'DynamicIsland toast must use semantic border token');
  assert.ok(
    toastCode.includes('bottom-[calc(env(safe-area-inset-bottom,0px)+4.25rem)]'),
    'Toast must appear cleanly above the 56px mobile bottom navigation bar'
  );
  assert.ok(
    toastCode.includes('min-w-[44px] min-h-[44px]'),
    'Toast dismiss button must have a 44x44px touch target'
  );
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
  assert.ok(skeletonCode.includes('bg-[var(--bg-surface)]'), 'Skeletons must use semantic surface token');
  assert.ok(skeletonCode.includes('bg-[var(--bg-elevated)]'), 'Skeletons must use semantic elevated pulse');

  const appCode = read('src/App.tsx');
  assert.ok(appCode.includes('PageViewSkeleton'), 'App.tsx must use PageViewSkeleton for view loading fallback');
  assert.ok(appCode.includes('DetailModalSkeleton'), 'App.tsx must use DetailModalSkeleton for modal loading fallback');
  assert.ok(appCode.includes('duration: 0.16'), 'App.tsx must use subtle 160ms transitions');
});

test('Eclipse 7: All remaining pages adopt semantic theme tokens (--bg-surface, --bg-elevated, --border-subtle, --accent-primary) and standardized hierarchy', () => {
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
    assert.ok(code.includes('--bg-surface') || code.includes('--bg-elevated'), `${relPath} must use semantic surface/elevated tokens`);
    assert.ok(code.includes('--border-subtle'), `${relPath} must use semantic border token`);
    assert.ok(code.includes('--accent-primary'), `${relPath} must use semantic primary accent token`);
  }

  const detailCode = read('src/components/AnimeDetailPage.tsx');
  assert.ok(detailCode.includes('Where to Watch (India)'), 'AnimeDetailPage must keep prominent Where to Watch card');
  assert.ok(detailCode.includes("'Overview'"), 'AnimeDetailPage must render Overview tab');
  assert.ok(detailCode.includes("'Seasons & Dubs'"), 'AnimeDetailPage must render Seasons & Dubs tab');
  assert.ok(detailCode.includes("'Watch Progress'"), 'AnimeDetailPage must render Watch Progress tab');
  assert.ok(detailCode.includes('Reviews ('), 'AnimeDetailPage must render Reviews tab');
});

test('Eclipse 8: Explore Page features sleek scrollable language rail, zero-select Filter & Sort Bottom Sheet with iOS toggles, and dedicated OTT Subscriptions Bottom Sheet', () => {
  const catalogCode = read('src/components/CatalogView.tsx');
  assert.ok(catalogCode.includes('h-[44px]') && catalogCode.includes('rounded-[12px]'), 'Search input must have 44px height and 12px border radius');
  assert.ok(catalogCode.includes('duration-180'), 'Language pills and filters must use 180ms transitions');
  assert.ok(catalogCode.includes("'all', 'tamil', 'hindi', 'telugu', 'malayalam', 'kannada', 'bengali'"), 'Language rail must include All, Tamil, Hindi, Telugu, Malayalam, Kannada, Bengali in order');
  assert.ok(catalogCode.includes('data-testid="explore-language-rail"'), 'Explore page must render single-row horizontal scrollable language rail');
  assert.ok(catalogCode.includes('data-testid="active-filter-count-badge"'), 'Filters button must show active filter count badge');
  assert.ok(catalogCode.includes('data-testid="smart-filter-drawer"'), 'Filters must open the filter bottom sheet');
  assert.equal(catalogCode.includes('<select'), false, 'Filter & Sort Anime sheet must not use clunky native <select> dropdowns');
  assert.ok(catalogCode.includes('Quick Sort'), 'Filter sheet must feature 1-tap Quick Sort chips');
  assert.ok(catalogCode.includes('Dub Languages'), 'Unified Filter sheet must consolidate Dub Languages');
  assert.ok(catalogCode.includes('role="switch"'), 'Filter sheet must use iOS-style toggle switches for Dub Availability');
  assert.ok(catalogCode.includes('Verified availability only'), 'Filter sheet must include Verified availability only toggle');
  assert.ok(catalogCode.includes('Fully dubbed seasons only'), 'Filter sheet must include Fully dubbed seasons only toggle');
  assert.ok(catalogCode.includes('Show results'), 'Filter sheet must include sticky Show results CTA');
  assert.ok(catalogCode.includes('Reset'), 'Filter sheet must include Reset button');
  assert.ok(
    catalogCode.includes('My Subscriptions &amp; OTT Coverage') ||
      catalogCode.includes('My Subscriptions & OTT Coverage'),
    'Explore page must include compact OTT coverage trigger strip'
  );
  assert.ok(catalogCode.includes('data-testid="ott-subscriptions-sheet"'), 'Explore page must open dedicated OTT Subscriptions Bottom Sheet');
  assert.ok(catalogCode.includes('gap-3 sm:gap-4 lg:gap-5'), 'Catalog grid must use 12px mobile and 16-20px desktop gaps');
});

test('Eclipse 9: Phase 3 AnimeCard uses 2:3 poster, 14px title with 40px min-height, ordered languages, poster fallback with Retry image, 44x44px touch targets, and Mobile Bottom Sheet overflow menu', async () => {
  const { extractCompactLanguageCodes, extractOrderedLanguages } = await import('../src/components/AnimeCard');
  assert.deepEqual(extractCompactLanguageCodes('Tamil, Hindi, Telugu'), ['TAM', 'HIN', 'TEL']);
  assert.deepEqual(extractOrderedLanguages('Telugu, Tamil, Hindi'), ['Tamil', 'Hindi', 'Telugu']);

  const cardCode = read('src/components/AnimeCard.tsx');
  assert.ok(cardCode.includes('aspect-[2/3]'), 'AnimeCard poster must use strict 2:3 aspect ratio');
  assert.ok(cardCode.includes('rounded-[var(--radius-card)]'), 'AnimeCard must use semantic card border radius');
  assert.ok(cardCode.includes('bg-[var(--bg-surface)]') && cardCode.includes('border-[var(--border-subtle)]'), 'AnimeCard must use semantic surface and border tokens');
  assert.ok(cardCode.includes('text-[14px]') && cardCode.includes('leading-[20px]') && cardCode.includes('min-h-[40px]'), 'AnimeCard title must be 14px with 20px line-height and 40px min-height');
  assert.ok(cardCode.includes('Poster unavailable') && cardCode.includes('Retry image'), 'AnimeCard must provide Poster unavailable fallback with Retry image action');
  assert.ok(cardCode.includes('w-11 h-11 min-w-[44px] min-h-[44px]'), 'Bookmark and Overflow buttons must have 44x44px touch target');
  assert.ok(cardCode.includes('duration-180'), 'AnimeCard interactions must use 180ms transitions');
  assert.ok(cardCode.includes("fill={isBookmarked ? 'var(--accent-primary)' : 'none'}"), 'Bookmark icon must transition to duotone accent fill when saved');
  assert.ok(cardCode.includes('line-clamp-2') && cardCode.includes('text-[var(--text-primary)]'), 'Title must use primary text token clamped to 2 lines');
  assert.ok(cardCode.includes("'Not verified'"), 'Missing platform must display Not verified instead of defaulting to Crunchyroll');
  assert.ok(cardCode.includes('data-testid="anime-card-overflow-sheet"'), 'AnimeCard must render Mobile Bottom Sheet for overflow menu');
  assert.ok(cardCode.includes('Share anime'), 'Overflow menu must include Share anime');
  assert.ok(cardCode.includes('Compare anime'), 'Overflow menu must include Compare anime');
  assert.ok(cardCode.includes('Save information offline'), 'Overflow menu must include Save information offline');
  assert.ok(cardCode.includes('Report incorrect information'), 'Overflow menu must include Report incorrect information');
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
  assert.ok(authModal.includes('bg-[var(--bg-surface)]') && authModal.includes('border-[var(--border-subtle)]') && authModal.includes('bg-[var(--accent-primary)]'), 'AuthModal must use semantic theme tokens');

  const dubModal = read('src/components/DubInfoModal.tsx');
  assert.ok(dubModal.includes('role="alert"') && dubModal.includes('min-h-[44px]'), 'DubInfoModal must show inline errors and 44px inputs');

  const adminDash = read('src/components/AdminDashboard.tsx');
  assert.ok(adminDash.includes('ConfirmDialog'), 'AdminDashboard must use ConfirmDialog for destructive actions');
  assert.ok(adminDash.includes('AdminSkeleton'), 'AdminDashboard must use AdminSkeleton instead of generic spinners');
  assert.ok(adminDash.split('\n').length < 2200, 'AdminDashboard must remain under 2200 lines');
});

test('Eclipse 16: Explore Catalog Hybrid Infinite Scroll deduplicates by Anime ID, pauses after 48 titles (4 batches of 12), and provides Eclipse loading/error/end/back-to-top states', async () => {
  const {
    CATALOG_BATCH_SIZE,
    CATALOG_BATCHES_PER_CYCLE,
    CATALOG_AUTO_LOAD_CYCLE_LIMIT,
    deduplicateAnimeById,
    shouldPauseAutoLoadCycle,
  } = await import('../src/components/CatalogView');

  assert.equal(CATALOG_BATCH_SIZE, 12);
  assert.equal(CATALOG_BATCHES_PER_CYCLE, 4);
  assert.equal(CATALOG_AUTO_LOAD_CYCLE_LIMIT, 48);

  const deduped = deduplicateAnimeById(
    [{ id: 1, title: 'Naruto' }, { id: 2, title: 'Bleach' }],
    [{ id: 2, title: 'Bleach Duplicate' }, { id: 3, title: 'One Piece' }]
  );
  assert.equal(deduped.length, 3);
  assert.deepEqual(deduped.map((x) => x.id), [1, 2, 3]);

  assert.equal(shouldPauseAutoLoadCycle(1, 12, true), false);
  assert.equal(shouldPauseAutoLoadCycle(3, 36, true), false);
  assert.equal(shouldPauseAutoLoadCycle(4, 48, true), true);
  assert.equal(shouldPauseAutoLoadCycle(4, 48, false), false);

  const catalogCode = read('src/components/CatalogView.tsx');
  assert.ok(catalogCode.includes("rootMargin: '500px'"), 'IntersectionObserver must prefetch with rootMargin: 500px');
  assert.ok(catalogCode.includes('Load more anime'), 'Must render Load more anime button when paused at 48-title cap');
  assert.ok(catalogCode.includes('Manual continuation after 48 titles'), 'Must display subtle helper text for 48-title pause');
  assert.ok(catalogCode.includes('Automatically loading next batch...'), 'Must display subtle automatic loading indicator');
  assert.ok(catalogCode.includes('You&apos;re all caught up') || catalogCode.includes("You're all caught up"), 'Must display end of catalog message');
  assert.ok(catalogCode.includes('data-testid="explore-back-to-top"'), 'Must provide floating 44x44px Back to Top button');
});




