import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT_DIR = process.cwd();

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

test('No inline CREATE TABLE or ALTER TABLE DDL statements exist in runtime API routes or src modules', () => {
  const runtimeFiles = [
    ...collectSourceFiles(path.join(ROOT_DIR, 'functions')),
    ...collectSourceFiles(path.join(ROOT_DIR, 'src')),
  ];

  assert.ok(runtimeFiles.length > 0, 'Expected runtime files to inspect');

  const ddlPattern = /\b(CREATE\s+TABLE|ALTER\s+TABLE)\b/i;
  const offending: string[] = [];

  for (const filePath of runtimeFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (ddlPattern.test(content)) {
      offending.push(path.relative(ROOT_DIR, filePath));
    }
  }

  assert.deepEqual(
    offending,
    [],
    `Found forbidden runtime inline DDL in: ${offending.join(', ')}`
  );
});

test('wrangler.toml configures migrations_dir and package.json exposes db:migrate', () => {
  const wranglerToml = fs.readFileSync(path.join(ROOT_DIR, 'wrangler.toml'), 'utf8');
  assert.match(wranglerToml, /\[\[d1_databases\]\]/);
  assert.match(wranglerToml, /migrations_dir\s*=\s*"migrations"/);

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['db:migrate'], 'wrangler d1 migrations apply DB --local');
});

test('All versioned SQL migrations in migrations/ execute cleanly in SQLite and create core tables', async () => {
  const migrationsDir = path.join(ROOT_DIR, 'migrations');
  assert.equal(fs.existsSync(migrationsDir), true);

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  assert.deepEqual(migrationFiles, [
    '0001_initial_schema.sql',
    '0002_add_watchlist.sql',
    '0003_add_chat_messages.sql',
    '0004_add_community_submissions.sql',
  ]);

  const db = new DatabaseSync(':memory:');

  for (const fileName of migrationFiles) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8');
    db.exec(sqlText);
  }

  const tablesRes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC;")
    .all() as Array<{ name: string }>;
  const tableNames = tablesRes.map((row) => String(row.name));

  for (const requiredTable of [
    'anime',
    'analytics_events',
    'analytics_pageviews',
    'analytics_sessions',
    'chat_messages',
    'cloudflare_logs',
    'community_submission_logs',
    'episodes',
    'feedback',
    'reviews',
    'user_ratings',
    'user_votes',
    'users',
    'watchlist',
  ]) {
    assert.ok(
      tableNames.includes(requiredTable),
      `Expected migrated schema to include table "${requiredTable}"`
    );
  }

  db.close();
});
