import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';

const cwd = process.cwd();
const envPath = resolve(cwd, '.env');
const envExamplePath = resolve(cwd, '.env.example');
const env = {
  ...process.env,
  ...loadDotEnv(envExamplePath),
  ...loadDotEnv(envPath),
};
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

runNpmScript('bootstrap:dev');
runNpmScript('services:up');

await waitForTcpService(
  'PostgreSQL',
  parseServiceUrl(env.DATABASE_URL, 5432),
  30_000,
);
await waitForTcpService('Redis', parseServiceUrl(env.REDIS_URL, 6379), 30_000);
ensurePostgresDatabaseExists(env);

runNpmScript('db:migrate');
runNpmScript('seed:dev');

console.log('Local development setup complete.');
console.log('Recommended next checks:');
console.log('- npm run env:check -- --scope common,gateway-api');
console.log('- npm run typecheck');
console.log('- npm test');

function runNpmScript(name) {
  execSync(`${npmCommand} run ${name}`, {
    cwd,
    shell: true,
    stdio: 'inherit',
  });
}

function parseServiceUrl(urlValue, fallbackPort) {
  const url = new URL(urlValue);

  return {
    host: url.hostname,
    port: Number(url.port || fallbackPort),
  };
}

function ensurePostgresDatabaseExists(environment) {
  const databaseUrl = new URL(environment.DATABASE_URL);
  const databaseName = databaseUrl.pathname.replace(/^\//u, '');
  const postgresUser = environment.POSTGRES_USER ?? 'postgres';

  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(databaseName) === false) {
    throw new Error(
      `DATABASE_URL points to an unsupported local database name: ${databaseName}`,
    );
  }

  const existsOutput = execSync(
    [
      'docker compose exec -T postgres',
      `psql -U ${postgresUser} -d postgres -tAc`,
      `"SELECT 1 FROM pg_database WHERE datname = '${databaseName}'"`,
    ].join(' '),
    {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'inherit'],
      encoding: 'utf8',
    },
  ).trim();

  if (existsOutput === '1') {
    console.log(`Database ${databaseName} already exists.`);
    return;
  }

  execSync(
    [
      'docker compose exec -T postgres',
      `psql -U ${postgresUser} -d postgres -c`,
      `"CREATE DATABASE ${databaseName}"`,
    ].join(' '),
    {
      cwd,
      shell: true,
      stdio: 'inherit',
    },
  );

  console.log(`Created database ${databaseName}.`);
}

async function waitForTcpService(name, endpoint, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const reachable = await canConnect(endpoint.host, endpoint.port);
    if (reachable) {
      console.log(`${name} is reachable at ${endpoint.host}:${endpoint.port}.`);
      return;
    }

    await sleep(500);
  }

  throw new Error(
    `${name} did not become reachable at ${endpoint.host}:${endpoint.port} within ${timeoutMs}ms.`,
  );
}

function canConnect(host, port) {
  return new Promise((resolvePromise) => {
    const socket = new net.Socket();

    socket.setTimeout(1_000);
    socket.once('connect', () => {
      socket.destroy();
      resolvePromise(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolvePromise(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolvePromise(false);
    });

    socket.connect(port, host);
  });
}

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
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
