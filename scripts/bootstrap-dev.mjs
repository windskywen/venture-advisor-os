import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();
const envExamplePath = resolve(cwd, '.env.example');
const envPath = resolve(cwd, '.env');

if (!existsSync(envPath)) {
  copyFileSync(envExamplePath, envPath);
  console.log('Created .env from .env.example.');
} else {
  console.log('.env already exists. Leaving it unchanged.');
  const addedKeys = syncMissingEnvEntries(envExamplePath, envPath);
  if (addedKeys.length > 0) {
    console.log(`Added missing .env entries: ${addedKeys.join(', ')}`);
  } else {
    console.log('.env already contains all keys from .env.example.');
  }
}

const env = {
  ...loadDotEnv(envExamplePath),
  ...loadDotEnv(envPath),
  ...process.env,
};

const storageRoot = resolve(cwd, env.STORAGE_ROOT ?? './storage');
const requiredDirectories = [storageRoot, resolve(storageRoot, 'cases')];

for (const directory of requiredDirectories) {
  mkdirSync(directory, { recursive: true });
  console.log(`Ensured directory: ${directory}`);
}

console.log('Local bootstrap complete.');
console.log('Next steps:');
console.log('- Run "npm run services:up" to start PostgreSQL and Redis.');
console.log('- Run "npm run seed:dev" to create sample storage data.');

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

function syncMissingEnvEntries(examplePath, targetPath) {
  const exampleEntries = parseDotEnvEntries(readFileSync(examplePath, 'utf8'));
  const existingValues = loadDotEnv(targetPath);
  const missingEntries = exampleEntries.filter(
    (entry) =>
      entry.type === 'pair' &&
      Object.prototype.hasOwnProperty.call(existingValues, entry.key) === false,
  );

  if (missingEntries.length === 0) {
    return [];
  }

  const block = [
    '',
    '# Added by bootstrap:dev from .env.example',
    ...missingEntries.map((entry) => `${entry.key}=${entry.value}`),
    '',
  ].join('\n');

  appendFileSync(targetPath, block);

  return missingEntries.map((entry) => entry.key);
}

function parseDotEnvEntries(sourceText) {
  return sourceText.split(/\r?\n/u).map((rawLine) => {
    const trimmedLine = rawLine.trim();

    if (trimmedLine.length === 0) {
      return { type: 'blank' };
    }

    if (trimmedLine.startsWith('#')) {
      return { type: 'comment' };
    }

    const separatorIndex = rawLine.indexOf('=');
    if (separatorIndex === -1) {
      return { type: 'unknown' };
    }

    return {
      type: 'pair',
      key: rawLine.slice(0, separatorIndex).trim(),
      value: rawLine.slice(separatorIndex + 1).trim(),
    };
  });
}
