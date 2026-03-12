import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadTelegramBotRuntimeEnvironment } from '@venture-advisor-os/shared-types';

import { createTelegramCommandHandler } from './adapters/command-handler.js';
import { createTelegramGatewayApiClient } from './adapters/gateway-api.js';
import { createTelegramBotApiClient } from './adapters/telegram-api.js';
import { createTelegramWebhookServer } from './adapters/webhook-runner.js';
import { createTelegramBotApp } from './app/index.js';

const env = loadEnvironment();
const runtime = loadTelegramBotRuntimeEnvironment(env);
const webhookPort = readPositiveInteger(env.TELEGRAM_WEBHOOK_PORT, 3001);
const webhookPath = normalizeWebhookPath(env.TELEGRAM_WEBHOOK_PATH);
const gatewayBaseUrl = readTrimmedString(
  env.GATEWAY_API_BASE_URL,
  'http://localhost:3000',
);
const gatewayAuthToken = readOptionalString(env.GATEWAY_API_AUTH_TOKEN);
const operatorUserIds = readCsvValues(env.TELEGRAM_OPERATOR_USER_IDS);

const app = createTelegramBotApp({
  gatewayApi: createTelegramGatewayApiClient({
    baseUrl: gatewayBaseUrl,
    authToken: gatewayAuthToken,
  }),
});
const commandHandler = createTelegramCommandHandler(app);
const botApi = createTelegramBotApiClient({
  botToken: runtime.telegramBotToken,
});
const server = createTelegramWebhookServer({
  commandHandler,
  botApi,
  webhookSecret: runtime.telegramWebhookSecret,
  path: webhookPath,
  operatorUserIds,
});

server.listen(webhookPort, () => {
  console.log(
    `Telegram webhook server listening on http://localhost:${webhookPort}${webhookPath}`,
  );
  console.log(`Gateway API target: ${gatewayBaseUrl}`);
});

registerSignalHandlers();

function registerSignalHandlers(): void {
  let shuttingDown = false;

  const handleSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down Telegram webhook server.`);
    server.close((error) => {
      if (error) {
        console.error('Telegram webhook shutdown failed.', error);
        process.exit(1);
        return;
      }

      process.exit(0);
    });
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
}

function loadEnvironment(): Record<string, string | undefined> {
  const cwd = process.cwd();

  return {
    ...process.env,
    ...loadDotEnv(resolve(cwd, '.env.example')),
    ...loadDotEnv(resolve(cwd, '.env')),
  };
}

function loadDotEnv(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const parsed: Record<string, string> = {};
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/u);

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

function readPositiveInteger(
  value: string | undefined,
  defaultValue: number,
): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function readTrimmedString(
  value: string | undefined,
  defaultValue: string,
): string {
  return value?.trim().length ? value.trim() : defaultValue;
}

function readOptionalString(value: string | undefined): string | undefined {
  return value?.trim().length ? value.trim() : undefined;
}

function readCsvValues(value: string | undefined): string[] {
  if (!value?.trim().length) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeWebhookPath(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return '/telegram/webhook';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
