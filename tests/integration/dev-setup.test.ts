import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bootstrapScriptPath = resolve(repoRoot, 'scripts', 'bootstrap-dev.mjs');
const checkEnvScriptPath = resolve(repoRoot, 'scripts', 'check-env.mjs');

describe('developer setup scripts', () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map((directory) =>
        rm(directory, {
          recursive: true,
          force: true,
        }),
      ),
    );
  });

  it('backfills missing env keys and validates the requested env scopes', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'venture-advisor-os-dev-'));
    tempDirectories.push(workspace);

    await writeFile(
      resolve(workspace, '.env.example'),
      [
        'DATABASE_URL=postgres://postgres:postgres@localhost:5432/ventrueadvisor',
        'REDIS_URL=redis://localhost:6379',
        'STORAGE_ROOT=./storage',
        'API_PORT=3000',
      ].join('\n') + '\n',
    );
    await writeFile(
      resolve(workspace, '.env'),
      [
        'DATABASE_URL=postgres://postgres:postgres@localhost:5432/ventrueadvisor',
        'REDIS_URL=redis://localhost:6379',
        'STORAGE_ROOT=./storage',
      ].join('\n') + '\n',
    );

    execFileSync(process.execPath, [bootstrapScriptPath], {
      cwd: workspace,
      stdio: 'pipe',
    });
    execFileSync(process.execPath, [checkEnvScriptPath, '--scope', 'common,gateway-api'], {
      cwd: workspace,
      stdio: 'pipe',
    });

    const envContents = await readFile(resolve(workspace, '.env'), 'utf8');

    expect(envContents).toContain('API_PORT=3000');
  });
});
