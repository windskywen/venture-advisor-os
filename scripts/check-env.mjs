import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const args = parseArguments(process.argv.slice(2));
const envFilePath = resolve(process.cwd(), '.env');
const fileEnv = loadDotEnv(envFilePath);
const env = { ...fileEnv, ...process.env };

const requirements = {
  common: ['DATABASE_URL', 'REDIS_URL', 'STORAGE_ROOT'],
  'gateway-api': ['API_PORT'],
  'telegram-bot': ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'],
  worker: [
    'COPILOT_RUNTIME_PATH',
    'AGENT_TIMEOUT_MS',
    'REPORT_RENDER_TIMEOUT_MS',
    'PRD_GENERATION_TIMEOUT_MS',
    'POC_GENERATION_TIMEOUT_MS',
  ],
};
const availableScopes = Object.keys(requirements);
const selectedScopes =
  args.scopes.length > 0 ? args.scopes : [...availableScopes];
const invalidScopes = selectedScopes.filter(
  (scope) => availableScopes.includes(scope) === false,
);

if (invalidScopes.length > 0) {
  console.error(`Unknown env check scope(s): ${invalidScopes.join(', ')}`);
  console.error(`Available scopes: ${availableScopes.join(', ')}`);
  process.exit(1);
}

const missing = selectedScopes.flatMap((scope) =>
  requirements[scope]
    .filter((name) => !hasValue(env[name]))
    .map((name) => ({ scope, name })),
);

const invalid = [];

if (includesScope('common')) {
  validateUrl('DATABASE_URL');
  validateUrl('REDIS_URL');
  validateResolvedPath('STORAGE_ROOT');
}

if (includesScope('gateway-api')) {
  validatePositiveInteger('API_PORT');
}

if (includesScope('telegram-bot')) {
  validateNonPlaceholderSecret('TELEGRAM_BOT_TOKEN');
  validateNonPlaceholderSecret('TELEGRAM_WEBHOOK_SECRET');
}

if (includesScope('worker')) {
  validatePositiveInteger('AGENT_TIMEOUT_MS');
  validatePositiveInteger('REPORT_RENDER_TIMEOUT_MS');
  validatePositiveInteger('PRD_GENERATION_TIMEOUT_MS');
  validatePositiveInteger('POC_GENERATION_TIMEOUT_MS');
  validateAbsolutePath('COPILOT_RUNTIME_PATH');
}

if (missing.length > 0 || invalid.length > 0) {
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    for (const entry of missing) {
      console.error(`- ${entry.name} (${entry.scope})`);
    }
  }

  if (invalid.length > 0) {
    console.error('Invalid environment variables:');
    for (const entry of invalid) {
      console.error(`- ${entry.name}: ${entry.reason}`);
    }
  }

  process.exitCode = 1;
} else {
  console.log(
    `Environment configuration is valid for scopes: ${selectedScopes.join(', ')}`,
  );
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

function includesScope(scope) {
  return selectedScopes.includes(scope);
}

function validateUrl(name) {
  const value = env[name];
  if (!hasValue(value)) {
    return;
  }

  try {
    new URL(value);
  } catch {
    invalid.push({ name, reason: 'must be a valid URL' });
  }
}

function validatePositiveInteger(name) {
  const value = env[name];
  if (!hasValue(value)) {
    return;
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    invalid.push({ name, reason: 'must be a positive integer' });
  }
}

function validateNonPlaceholderSecret(name) {
  const value = env[name];
  if (!hasValue(value)) {
    return;
  }

  if (args.allowPlaceholderSecrets) {
    return;
  }

  if (value.trim().toLowerCase() === 'replace-me') {
    invalid.push({ name, reason: 'must be replaced with a real secret value' });
  }
}

function validateResolvedPath(name) {
  const value = env[name];
  if (!hasValue(value)) {
    return;
  }

  try {
    resolve(process.cwd(), value);
  } catch {
    invalid.push({ name, reason: 'must be a valid filesystem path' });
  }
}

function validateAbsolutePath(name) {
  const value = env[name];
  if (!hasValue(value)) {
    return;
  }

  if (!isAbsolute(value)) {
    invalid.push({ name, reason: 'must be an absolute filesystem path' });
  }
}

function parseArguments(argv) {
  const scopes = [];
  let allowPlaceholderSecrets = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--allow-placeholder-secrets') {
      allowPlaceholderSecrets = true;
      continue;
    }

    if (argument === '--scope') {
      const value = argv[index + 1];
      if (typeof value === 'string') {
        scopes.push(...splitScopes(value));
        index += 1;
      }
      continue;
    }

    if (argument.startsWith('--scope=')) {
      scopes.push(...splitScopes(argument.slice('--scope='.length)));
    }
  }

  return {
    scopes,
    allowPlaceholderSecrets,
  };
}

function splitScopes(value) {
  return value
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}
