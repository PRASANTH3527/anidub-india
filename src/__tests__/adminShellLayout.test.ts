import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAdminWorkspaceRoute,
  partitionOverviewAttentionChecks,
  resolveMobileAdminActiveGroup,
  ADMIN_TOOLS_TABS,
  ADMIN_MORE_TABS,
  ADMIN_QUICK_PILL_TABS,
} from '../utils/adminShellLayout';

test('isAdminWorkspaceRoute hides public navigation on /admin and all /admin/* subroutes', () => {
  assert.equal(isAdminWorkspaceRoute('admin', '/'), true);
  assert.equal(isAdminWorkspaceRoute('explore', '/admin'), true);
  assert.equal(isAdminWorkspaceRoute('explore', '/admin/analytics'), true);
  assert.equal(isAdminWorkspaceRoute('explore', '/admin/catalog/42/edit'), true);
  assert.equal(isAdminWorkspaceRoute('explore', '/admin/catalog/new'), true);

  assert.equal(isAdminWorkspaceRoute('explore', '/'), false);
  assert.equal(isAdminWorkspaceRoute('schedule', '/schedule'), false);
  assert.equal(isAdminWorkspaceRoute('explore', '/anime/naruto'), false);
});

test('partitionOverviewAttentionChecks collapses zero-count checks into a 1-line strip and surfaces only real pending alerts', () => {
  const result = partitionOverviewAttentionChecks({
    pendingModerationCount: 0,
    openFeedbackCount: 0,
    unverifiedDubsCount: 0,
    missingTranslationsCount: 234,
  });

  assert.equal(result.actionableAlerts.length, 1);
  assert.equal(result.actionableAlerts[0].id, 'translations');
  assert.equal(result.actionableAlerts[0].title, '234 Missing Translations');
  assert.equal(result.actionableAlerts[0].actionLabel, 'Fix →');
  assert.equal(result.actionableAlerts[0].targetTab, 'translations');

  assert.equal(result.healthyChecks.length, 3);
  assert.equal(result.healthySummaryText, 'Moderation: 0 · Tickets: 0 · Unverified: 0 ✓');

  // All-zero state collapses all 4 cleanly
  const allClear = partitionOverviewAttentionChecks({
    pendingModerationCount: 0,
    openFeedbackCount: 0,
    unverifiedDubsCount: 0,
    missingTranslationsCount: 0,
  });
  assert.equal(allClear.actionableAlerts.length, 0);
  assert.equal(
    allClear.healthySummaryText,
    'Moderation: 0 · Tickets: 0 · Unverified: 0 · Translations: 0 ✓'
  );

  // All-nonzero state renders 4 alerts and no empty healthy strip
  const allActive = partitionOverviewAttentionChecks({
    pendingModerationCount: 2,
    openFeedbackCount: 3,
    unverifiedDubsCount: 5,
    missingTranslationsCount: 10,
  });
  assert.equal(allActive.actionableAlerts.length, 4);
  assert.equal(allActive.healthySummaryText, null);
});

test('resolveMobileAdminActiveGroup maps Tools and More sheets accurately and covers all restored & Phase 1-3.5 tabs', () => {
  assert.equal(resolveMobileAdminActiveGroup('overview'), 'overview');
  assert.equal(resolveMobileAdminActiveGroup('catalog'), 'catalog');
  assert.equal(resolveMobileAdminActiveGroup('editor'), 'catalog');
  assert.equal(resolveMobileAdminActiveGroup('dubs'), 'dubs');

  for (const toolsTab of ADMIN_TOOLS_TABS) {
    assert.equal(resolveMobileAdminActiveGroup(toolsTab), 'tools');
  }
  assert.deepEqual(
    [...ADMIN_TOOLS_TABS],
    ['imdb_checker', 'data_health', 'translations', 'franchises', 'cast']
  );

  for (const moreTab of ADMIN_MORE_TABS) {
    assert.equal(resolveMobileAdminActiveGroup(moreTab), 'more');
  }
  assert.deepEqual(
    [...ADMIN_MORE_TABS],
    ['moderation', 'analytics', 'activity_log', 'recycle_bin', 'backup', 'settings']
  );

  // Every major tab is reachable via the 1-tap horizontal quick-tab bar
  const pillIds = new Set(ADMIN_QUICK_PILL_TABS.map((t) => t.id));
  for (const required of [
    'overview',
    'catalog',
    'dubs',
    'backup',
    'imdb_checker',
    'data_health',
    'translations',
    'franchises',
    'cast',
    'moderation',
    'analytics',
    'activity_log',
    'recycle_bin',
    'settings',
  ] as const) {
    assert.ok(pillIds.has(required), `Missing quick-tab pill for ${required}`);
  }
});
