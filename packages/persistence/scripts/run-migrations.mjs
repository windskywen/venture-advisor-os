import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const { Client } = pg;

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(currentDirectory, '..');
const repoRoot = resolve(packageRoot, '..', '..');
const migrationsDirectory = resolve(packageRoot, 'migrations');
const migrationsTableName = 'schema_migrations';

const env = loadEnvironment();
const databaseUrl = env.DATABASE_URL;

if (!hasValue(databaseUrl)) {
  console.error('DATABASE_URL is required to run migrations.');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
});

try {
  await client.connect();
  await ensureMigrationsTable(client);

  const appliedMigrations = await readAppliedMigrations(client);
  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();
  const pendingMigrations = migrationFiles.filter(
    (fileName) => !appliedMigrations.has(fileName),
  );

  if (pendingMigrations.length === 0) {
    console.log('No pending migrations.');
    process.exit(0);
  }

  for (const fileName of pendingMigrations) {
    const migrationSql = readFileSync(
      resolve(migrationsDirectory, fileName),
      'utf8',
    );

    console.log(`Applying migration ${fileName}...`);
    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query(
      `INSERT INTO ${migrationsTableName} (migration_name) VALUES ($1)`,
      [fileName],
    );
    await client.query('COMMIT');
  }

  console.log(`Applied ${pendingMigrations.length} migration(s).`);
} catch (error) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Ignore rollback failures after a broken connection.
  }

  console.error('Migration run failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${migrationsTableName} (
      migration_name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function readAppliedMigrations(client) {
  const result = await client.query(
    `SELECT migration_name FROM ${migrationsTableName} ORDER BY migration_name`,
  );

  return new Set(result.rows.map((row) => row.migration_name));
}

function loadEnvironment() {
  const envFilePath = resolve(repoRoot, '.env');
  const fileEnv = loadDotEnv(envFilePath);
  return {
    ...process.env,
    ...fileEnv,
  };
}

function loadDotEnv(path) {
  if (!existsSync(path)) {
    return {};
  }

  const parsed = {};
  const lines = readFileSync(path, 'utf8').split(/\r?\n/u);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
