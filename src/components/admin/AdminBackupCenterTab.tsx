import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  FileJson,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import {
  validateContentBackupBundle,
  type ContentBackupValidationReport,
  type CoreContentBackupTable,
} from '../../utils/adminPhase3Intelligence';
import type { CsvDryRunSummary } from '../../utils/adminOpsPro';
import { generateFailedCsvRowsExport } from '../../utils/adminPhase35Polish';

export interface AdminBackupCenterTabProps {
  onFallbackExportCsv: () => void;
  onExportSql: () => void;
  onTriggerCsvUpload: () => void;
  isUploadingCsv: boolean;
  csvDryRunReport: CsvDryRunSummary | null;
  onCancelCsvDryRun: () => void;
  onCommitStagedCsv: () => void;
  onOpenCsvHelp: () => void;
  onDownloadSampleCsv: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const CORE_CONTENT_TABLES: Array<{
  key: CoreContentBackupTable;
  label: string;
  description: string;
}> = [
  {
    key: 'anime',
    label: 'Anime Catalog (anime)',
    description: 'Canonical titles, artwork, metadata & verified OTT links',
  },
  {
    key: 'anime_dub_matrix',
    label: 'Dub Matrix (anime_dub_matrix)',
    description: 'Season-by-season regional dub status & episode availability',
  },
  {
    key: 'anime_translations',
    label: 'Regional Translations (anime_translations)',
    description:
      'Native synopsis translations across Tamil, Hindi, Telugu, Malayalam, Kannada & Bengali',
  },
  {
    key: 'anime_franchise_links',
    label: 'Universe & Watch Order (anime_franchise_links)',
    description: 'Franchise timeline entries, sequence orders & relation tags',
  },
  {
    key: 'anime_cast_entries',
    label: 'Characters & Voice Cast (anime_cast_entries)',
    description: 'Character roles and verified Indian / Japanese voice actors',
  },
  {
    key: 'dub_reviews',
    label: '5-Slider Dub Reviews (dub_reviews)',
    description: 'Community regional dub quality scores & written reviews',
  },
];

export const AdminBackupCenterTab: React.FC<AdminBackupCenterTabProps> = ({
  onFallbackExportCsv,
  onExportSql,
  onTriggerCsvUpload,
  isUploadingCsv,
  csvDryRunReport,
  onCancelCsvDryRun,
  onCommitStagedCsv,
  onOpenCsvHelp,
  onDownloadSampleCsv,
  onSuccess,
  onError,
}) => {
  const [tableCounts, setTableCounts] = useState<Record<string, number> | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  // JSON Backup Dry-Run Validator State
  const [isValidatingJson, setIsValidatingJson] = useState(false);
  const [selectedJsonFileName, setSelectedJsonFileName] = useState<string | null>(null);
  const [jsonValidationResult, setJsonValidationResult] =
    useState<ContentBackupValidationReport | null>(null);
  const jsonValidatorInputRef = useRef<HTMLInputElement>(null);

  const loadBackupStats = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const res = await cloudflareApi.fetchAdminBackupStats();
      if (res && res.counts) {
        setTableCounts(res.counts);
      }
    } catch {
      // Keep graceful null state if offline
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    void loadBackupStats();
  }, [loadBackupStats]);

  // 1. Server-Side Full Catalog CSV Export
  const handleServerCatalogCsvExport = async () => {
    setIsExportingCsv(true);
    try {
      const res = await cloudflareApi.exportFullCatalogCsvFromServer();
      const csvText = typeof res === 'string' ? res : res.csv;
      if (!csvText) {
        throw new Error('Empty CSV payload returned from server');
      }
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `anidub_d1_catalog_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onSuccess(`Exported full D1 catalog CSV snapshot (${res.rowCount || 0} rows) from server!`);
    } catch {
      // Fallback to client-side loaded catalog if server endpoint is unreachable
      onFallbackExportCsv();
    } finally {
      setIsExportingCsv(false);
    }
  };

  // 2. Full Content JSON Backup (Versioned bundle of public content tables, excluding secrets)
  const handleFullContentJsonBackup = async () => {
    setIsExportingJson(true);
    try {
      const res = await cloudflareApi.exportFullContentJsonBackup();
      const bundle = res.bundle || res;
      const prettyJson = JSON.stringify(bundle, null, 2);
      const blob = new Blob([prettyJson], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `anidub_content_backup_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onSuccess(
        `Exported versioned Full Content JSON Backup (${bundle.schemaVersion || 'anidub-content-backup-v2.3'})!`
      );
    } catch (err: any) {
      onError(err?.message || 'Failed to generate Full Content JSON Backup.');
    } finally {
      setIsExportingJson(false);
    }
  };

  // 3. Safe Backup Validator (Dry-Run Check — never overwrites production data!)
  const handleInspectJsonBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedJsonFileName(file.name);
    setIsValidatingJson(true);
    setJsonValidationResult(null);

    try {
      const rawText = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        setJsonValidationResult({
          valid: false,
          schemaVersion: null,
          exportedAt: null,
          tableCounts: {
            anime: 0,
            anime_dub_matrix: 0,
            anime_translations: 0,
            anime_franchise_links: 0,
            anime_cast_entries: 0,
            dub_reviews: 0,
          },
          totalRows: 0,
          warnings: [],
          errors: ['Selected file is not valid JSON syntax.'],
        });
        onError('Backup Dry-Run Check: Invalid JSON syntax.');
        return;
      }

      try {
        const serverCheck = await cloudflareApi.validateContentBackupJson(parsed);
        if (serverCheck && serverCheck.report) {
          setJsonValidationResult(serverCheck.report);
          if (serverCheck.report.valid) {
            onSuccess(`Backup Validator (Dry-Run): "${file.name}" passed schema & table checks!`);
          } else {
            onError(`Backup Validator (Dry-Run): "${file.name}" reported compatibility errors.`);
          }
          return;
        }
      } catch {
        // Fallback to local deterministic validator
      }

      const localCheck = validateContentBackupBundle(parsed);
      setJsonValidationResult(localCheck);
      if (localCheck.valid) {
        onSuccess(`Backup Validator (Dry-Run): "${file.name}" passed schema & table checks!`);
      } else {
        onError(`Backup Validator (Dry-Run): "${file.name}" reported compatibility errors.`);
      }
    } catch (err: any) {
      onError(err?.message || 'Unable to inspect JSON backup file.');
    } finally {
      setIsValidatingJson(false);
      if (jsonValidatorInputRef.current) {
        jsonValidatorInputRef.current.value = '';
      }
    }
  };

  return (
    <div
      data-testid="admin-backup-center-tab"
      className="max-w-5xl mx-auto space-y-6 text-[var(--text-primary)]"
    >
      {/* Hidden JSON Backup Validator Input */}
      <input
        ref={jsonValidatorInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleInspectJsonBackupFile}
        className="hidden"
      />

      {/* 1. REAL D1 CORE CONTENT TABLE ROW COUNTS */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
                Full Backup &amp; Recovery Center
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Real-time Cloudflare D1 table row counts, versioned exports, and safe dry-run validators.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadBackupStats()}
            disabled={loadingCounts}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingCounts ? 'animate-spin' : ''}`} />
            <span>Refresh Counts</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {CORE_CONTENT_TABLES.map((tbl) => {
            const countVal =
              tableCounts && typeof tableCounts[tbl.key] === 'number'
                ? tableCounts[tbl.key]
                : null;
            return (
              <div
                key={tbl.key}
                data-testid={`backup-table-count-${tbl.key}`}
                className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[var(--text-primary)] truncate">
                      {tbl.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-black font-mono text-[var(--accent-primary)] shrink-0">
                      {loadingCounts && countVal === null
                        ? '...'
                        : countVal !== null
                          ? countVal.toLocaleString()
                          : '0'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    {tbl.description}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-[var(--text-secondary)]">
                  Table: <code className="text-[var(--text-primary)]">{tbl.key}</code>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. SEPARATE EXPORT ACTIONS & SAFE VALIDATORS */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-5 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-[var(--text-primary)]">
            Export Snapshots &amp; Safe Dry-Run Tools
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            All exports exclude private credentials and API secrets. Validators run in read-only dry-run mode and never overwrite production data.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Action 1: Server-Side Catalog CSV Export */}
          <button
            type="button"
            data-testid="backup-export-csv-btn"
            onClick={handleServerCatalogCsvExport}
            disabled={isExportingCsv}
            className="min-h-[48px] p-4 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-left space-y-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase text-emerald-500">
                1. Catalog CSV Export
              </span>
              {isExportingCsv ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              )}
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              Server-Side Catalog CSV
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Full D1 catalog export across all published &amp; draft anime rows.
            </p>
          </button>

          {/* Action 2: Full Content JSON Backup */}
          <button
            type="button"
            data-testid="backup-export-json-btn"
            onClick={handleFullContentJsonBackup}
            disabled={isExportingJson}
            className="min-h-[48px] p-4 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-left space-y-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase text-purple-500">
                2. Full Content JSON
              </span>
              {isExportingJson ? (
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              ) : (
                <FileJson className="w-4 h-4 text-purple-500" />
              )}
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              Export JSON Bundle
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Versioned backup of all 6 core content tables (zero secrets).
            </p>
          </button>

          {/* Action 3: Safe JSON Backup Validator (Dry-Run Check) */}
          <button
            type="button"
            data-testid="backup-validate-json-btn"
            onClick={() => jsonValidatorInputRef.current?.click()}
            disabled={isValidatingJson}
            className="min-h-[48px] p-4 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-left space-y-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase text-amber-500">
                3. Backup Validator
              </span>
              {isValidatingJson ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              Inspect JSON Backup (Dry-Run)
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Verify table counts &amp; schema compatibility without writing to D1.
            </p>
          </button>

          {/* Action 4: D1 SQL Backup */}
          <button
            type="button"
            data-testid="backup-export-sql-btn"
            onClick={onExportSql}
            className="min-h-[48px] p-4 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-left space-y-1.5 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase text-sky-500">
                4. D1 SQL Dump
              </span>
              <Database className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              Export D1 SQL Statements
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Generate idempotent INSERT OR REPLACE SQL statements.
            </p>
          </button>
        </div>

        {/* JSON Backup Validator Dry-Run Result Panel */}
        {jsonValidationResult && (
          <div
            data-testid="json-backup-validation-panel"
            className={`p-4 rounded-2xl border space-y-3 ${
              jsonValidationResult.valid
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {jsonValidationResult.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <div>
                  <h4 className="text-sm font-extrabold text-[var(--text-primary)]">
                    Backup Validator (Dry-Run Check):{' '}
                    {jsonValidationResult.valid ? 'Compatible Bundle' : 'Validation Failed'}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    File: <span className="font-mono">{selectedJsonFileName || 'backup.json'}</span>{' '}
                    · Schema:{' '}
                    <span className="font-mono">
                      {jsonValidationResult.schemaVersion || 'Unspecified'}
                    </span>{' '}
                    · Exported:{' '}
                    <span className="font-mono">
                      {jsonValidationResult.exportedAt || 'Unspecified'}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setJsonValidationResult(null)}
                className="min-h-[36px] px-3 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] self-start sm:self-center cursor-pointer"
              >
                Dismiss
              </button>
            </div>

            {Object.keys(jsonValidationResult.tableCounts).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {Object.entries(jsonValidationResult.tableCounts).map(([tbl, cnt]) => (
                  <div
                    key={tbl}
                    className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                  >
                    <div className="text-[10px] font-mono text-[var(--text-secondary)] truncate">
                      {tbl}
                    </div>
                    <div className="text-sm font-black text-[var(--text-primary)] mt-0.5">
                      {Number(cnt).toLocaleString()} rows
                    </div>
                  </div>
                ))}
              </div>
            )}

            {jsonValidationResult.errors.length > 0 && (
              <ul className="text-xs text-red-500 font-semibold space-y-1">
                {jsonValidationResult.errors.map((err, idx) => (
                  <li key={idx}>• {err}</li>
                ))}
              </ul>
            )}

            {jsonValidationResult.warnings.length > 0 && (
              <ul className="text-xs text-amber-500 font-semibold space-y-1">
                {jsonValidationResult.warnings.map((warn, idx) => (
                  <li key={idx}>• {warn}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 3. SAFE CSV IMPORT DRY-RUN CARD */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Upload className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Safe CSV Catalog Import (Dry-Run First)</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Upload a CSV spreadsheet to preview valid rows, duplicates, and validation warnings before committing to the Pending Moderation queue.
            </p>
          </div>
          <button
            type="button"
            data-testid="backup-upload-csv-btn"
            onClick={onTriggerCsvUpload}
            disabled={isUploadingCsv}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isUploadingCsv ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>Select CSV File for Dry-Run</span>
          </button>
        </div>

        {/* Safe CSV Dry-Run Report Preview */}
        {csvDryRunReport && (
          <div
            data-testid="csv-dry-run-preview"
            className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--accent-primary)]/40 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-[var(--text-primary)]">
                  CSV Dry-Run Validation Summary
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Review parsed rows and duplicates before committing to the Pending Moderation queue.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  Total: {csvDryRunReport.totalRows}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  Valid: {csvDryRunReport.validCount}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  Duplicates: {csvDryRunReport.duplicateCount}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-500 border border-red-500/30">
                  Errors: {csvDryRunReport.invalidCount}
                </span>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              {csvDryRunReport.rows.map((row) => (
                <div
                  key={row.rowIndex}
                  className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[var(--text-primary)] truncate">
                      Row #{row.rowIndex}: {row.title || '(Missing Title)'}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate">
                      {row.type} · {row.year || 'N/A'} · Languages:{' '}
                      {row.languages || 'Unverified'} · OTT: {row.platform || 'Unverified'}
                    </div>
                    {row.errors.length > 0 && (
                      <div className="text-[11px] text-red-500 font-semibold mt-0.5">
                        {row.errors.join(' • ')}
                      </div>
                    )}
                    {row.warnings.length > 0 && (
                      <div className="text-[11px] text-amber-500 font-semibold mt-0.5">
                        {row.warnings.join(' • ')}
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase shrink-0 ${
                      row.status === 'valid'
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : row.status === 'duplicate'
                          ? 'bg-amber-500/15 text-amber-500'
                          : 'bg-red-500/15 text-red-500'
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div>
                {(csvDryRunReport.invalidCount > 0 || csvDryRunReport.duplicateCount > 0) && (
                  <button
                    type="button"
                    data-testid="download-failed-csv-rows-btn"
                    onClick={() => {
                      const failedCsv = generateFailedCsvRowsExport(
                        csvDryRunReport.rows.map((r) => ({
                          rowNumber: r.rowIndex,
                          title: r.title,
                          slug: r.title
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, ''),
                          status: r.status,
                          errors: r.errors,
                          raw: {
                            title: r.title,
                            type: r.type || '',
                            year: String(r.year || ''),
                            languages: r.languages || '',
                            platform: r.platform || '',
                          },
                        }))
                      );
                      if (!failedCsv) return;
                      const blob = new Blob([failedCsv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute(
                        'download',
                        `anidub_failed_csv_rows_${new Date().toISOString().slice(0, 10)}.csv`
                      );
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                      onSuccess('Downloaded failed/duplicate CSV rows with error_reason column.');
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-extrabold text-amber-500 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      Download Failed Rows (.csv) ({csvDryRunReport.invalidCount + csvDryRunReport.duplicateCount})
                    </span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onCancelCsvDryRun}
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel Dry-Run
                </button>
                <button
                  type="button"
                  disabled={isUploadingCsv || csvDryRunReport.validCount === 0}
                  onClick={onCommitStagedCsv}
                  className="min-h-[44px] px-5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold cursor-pointer disabled:opacity-50"
                >
                  Commit {csvDryRunReport.validCount} Valid Rows to Pending Queue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenCsvHelp}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>View CSV Format Guide &amp; Sample Template</span>
          </button>
          <button
            type="button"
            onClick={onDownloadSampleCsv}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Sample CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
