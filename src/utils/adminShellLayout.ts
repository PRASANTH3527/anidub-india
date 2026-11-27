import type { AdminActiveTab, AdminOverviewStats } from '../components/admin/types';

/**
 * Returns true whenever the active tab or browser URL path is inside `/admin` or `/admin/*`.
 * Used to suppress the public site's top navbar and bottom navigation bar so there is never
 * a double header or navigation clash inside the Admin workspace.
 */
export function isAdminWorkspaceRoute(activeTab: string, pathname?: string | null): boolean {
  if (activeTab === 'admin') return true;
  if (!pathname) return false;
  const clean = pathname.trim().toLowerCase();
  return clean === '/admin' || clean.startsWith('/admin/');
}

export interface OverviewAttentionAlert {
  id: 'moderation' | 'tickets' | 'unverified' | 'translations';
  count: number;
  title: string;
  actionLabel: string;
  targetTab: AdminActiveTab;
  filterLanguage?: string;
  tone: 'amber' | 'sky' | 'rose' | 'purple';
}

export interface OverviewHealthyCheck {
  id: 'moderation' | 'tickets' | 'unverified' | 'translations';
  shortLabel: string;
  count: 0;
}

export interface PartitionedAttentionResult {
  actionableAlerts: OverviewAttentionAlert[];
  healthyChecks: OverviewHealthyCheck[];
  healthySummaryText: string | null;
}

/**
 * Declutters the Command Center "Needs Your Attention" card:
 * - Zero-count checks collapse into a single compact 1-line green status strip
 *   (e.g., "Moderation: 0 · Tickets: 0 · Unverified: 0 ✓").
 * - Only real non-zero items render actionable rows with inline "Fix →" buttons.
 */
export function partitionOverviewAttentionChecks(
  stats: Pick<
    AdminOverviewStats,
    'pendingModerationCount' | 'openFeedbackCount' | 'unverifiedDubsCount' | 'missingTranslationsCount'
  >,
  openFeedbackOverride?: number
): PartitionedAttentionResult {
  const pendingCount = Math.max(0, Number(stats.pendingModerationCount) || 0);
  const ticketCount = Math.max(
    0,
    openFeedbackOverride !== undefined ? Number(openFeedbackOverride) || 0 : Number(stats.openFeedbackCount) || 0
  );
  const unverifiedCount = Math.max(0, Number(stats.unverifiedDubsCount) || 0);
  const missingTranslationsCount = Math.max(0, Number(stats.missingTranslationsCount) || 0);

  const actionableAlerts: OverviewAttentionAlert[] = [];
  const healthyChecks: OverviewHealthyCheck[] = [];

  if (pendingCount > 0) {
    actionableAlerts.push({
      id: 'moderation',
      count: pendingCount,
      title: `${pendingCount.toLocaleString()} Pending Dub Submission${pendingCount === 1 ? '' : 's'}`,
      actionLabel: 'Review →',
      targetTab: 'moderation',
      tone: 'amber',
    });
  } else {
    healthyChecks.push({ id: 'moderation', shortLabel: 'Moderation: 0', count: 0 });
  }

  if (ticketCount > 0) {
    actionableAlerts.push({
      id: 'tickets',
      count: ticketCount,
      title: `${ticketCount.toLocaleString()} Open Feedback Ticket${ticketCount === 1 ? '' : 's'}`,
      actionLabel: 'Open →',
      targetTab: 'moderation',
      tone: 'sky',
    });
  } else {
    healthyChecks.push({ id: 'tickets', shortLabel: 'Tickets: 0', count: 0 });
  }

  if (unverifiedCount > 0) {
    actionableAlerts.push({
      id: 'unverified',
      count: unverifiedCount,
      title: `${unverifiedCount.toLocaleString()} Unverified Dub Tag${unverifiedCount === 1 ? '' : 's'}`,
      actionLabel: 'Fix →',
      targetTab: 'dubs',
      filterLanguage: 'Unverified',
      tone: 'rose',
    });
  } else {
    healthyChecks.push({ id: 'unverified', shortLabel: 'Unverified: 0', count: 0 });
  }

  if (missingTranslationsCount > 0) {
    actionableAlerts.push({
      id: 'translations',
      count: missingTranslationsCount,
      title: `${missingTranslationsCount.toLocaleString()} Missing Translation${missingTranslationsCount === 1 ? '' : 's'}`,
      actionLabel: 'Fix →',
      targetTab: 'translations',
      tone: 'purple',
    });
  } else {
    healthyChecks.push({ id: 'translations', shortLabel: 'Translations: 0', count: 0 });
  }

  const healthySummaryText =
    healthyChecks.length > 0
      ? `${healthyChecks.map((c) => c.shortLabel).join(' · ')} ✓`
      : null;

  return {
    actionableAlerts,
    healthyChecks,
    healthySummaryText,
  };
}

export type AdminMobileNavGroup = 'overview' | 'catalog' | 'dubs' | 'tools' | 'more';

export const ADMIN_TOOLS_TABS: readonly AdminActiveTab[] = [
  'imdb_checker',
  'data_health',
  'translations',
  'franchises',
  'cast',
] as const;

export const ADMIN_STUDIO_TABS: readonly AdminActiveTab[] = [
  'translations',
  'franchises',
  'cast',
] as const;

export const ADMIN_MORE_TABS: readonly AdminActiveTab[] = [
  'moderation',
  'analytics',
  'activity_log',
  'recycle_bin',
  'backup',
  'settings',
] as const;

export const ADMIN_QUICK_PILL_TABS: ReadonlyArray<{
  id: AdminActiveTab;
  label: string;
}> = [
  { id: 'overview', label: 'Home' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'dubs', label: 'Dubs' },
  { id: 'backup', label: 'Bulk CSV & Backup' },
  { id: 'imdb_checker', label: 'IMDb Checker' },
  { id: 'data_health', label: 'Data Health' },
  { id: 'translations', label: 'Translations' },
  { id: 'franchises', label: 'Franchise' },
  { id: 'cast', label: 'Cast' },
  { id: 'moderation', label: 'Moderation' },
  { id: 'analytics', label: 'Analytics 2.0' },
  { id: 'activity_log', label: 'Activity Log' },
  { id: 'recycle_bin', label: 'Recycle Bin' },
  { id: 'settings', label: 'Telegram & Settings' },
];

export function resolveMobileAdminActiveGroup(effectiveTab: AdminActiveTab): AdminMobileNavGroup {
  if (effectiveTab === 'overview') return 'overview';
  if (effectiveTab === 'catalog' || effectiveTab === 'editor') return 'catalog';
  if (effectiveTab === 'dubs') return 'dubs';
  if (ADMIN_TOOLS_TABS.includes(effectiveTab)) return 'tools';
  return 'more';
}
