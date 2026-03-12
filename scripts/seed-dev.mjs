import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();
const envPath = resolve(cwd, '.env');
const envExamplePath = resolve(cwd, '.env.example');
const env = {
  ...loadDotEnv(envExamplePath),
  ...loadDotEnv(envPath),
  ...process.env,
};

const storageRoot = resolve(cwd, env.STORAGE_ROOT ?? './storage');
const caseId = 'seed-case-001';
const caseRoot = resolve(storageRoot, 'cases', caseId);
const inputsRoot = resolve(caseRoot, 'iterations', '1', 'inputs');
const outputsRoot = resolve(caseRoot, 'iterations', '1', 'outputs');

mkdirSync(inputsRoot, { recursive: true });
mkdirSync(outputsRoot, { recursive: true });

writeJson(resolve(caseRoot, 'case.json'), {
  caseId,
  topic: 'AI copilot for venture opportunity triage',
  status: 'TOPIC_ACCEPTED',
  region: 'Global',
  founderProfile: 'Solo technical founder',
  preferredBusinessModels: ['B2B SaaS'],
  constraints: ['Bootstrapped MVP'],
  createdAt: new Date().toISOString(),
});

writeJson(resolve(inputsRoot, 'request.json'), {
  topic: 'AI copilot for venture opportunity triage',
  region: 'Global',
  founderProfile: 'Solo technical founder',
  preferredBusinessModels: ['B2B SaaS'],
  constraints: ['Bootstrapped MVP'],
});

writeJson(resolve(outputsRoot, 'summary.json'), {
  note: 'Seed data created by scripts/seed-dev.mjs',
  readyForWorkflow: false,
});

console.log(`Seeded local storage data at ${caseRoot}`);

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

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}
