import { z } from 'zod';

import {
  loadWorkflowConfig,
  type EnvironmentLike,
  type WorkflowConfig,
} from './config.js';

const REQUIRED_ENV_VALUE_SCHEMA = z.string().trim().min(1);
const NON_PLACEHOLDER_SECRET_SCHEMA = REQUIRED_ENV_VALUE_SCHEMA.refine(
  (value) => value.toLowerCase() !== 'replace-me',
  'must be set to a non-placeholder value',
);
const URL_ENV_VALUE_SCHEMA = z.url();
const POSITIVE_INTEGER_STRING_SCHEMA = z
  .string()
  .trim()
  .refine((value) => {
    const number = Number.parseInt(value, 10);
    return Number.isInteger(number) && number > 0;
  }, 'must be a positive integer');

const CommonRuntimeEnvironmentSchema = z.object({
  databaseUrl: URL_ENV_VALUE_SCHEMA,
  redisUrl: URL_ENV_VALUE_SCHEMA,
  storageRoot: REQUIRED_ENV_VALUE_SCHEMA,
});

const GatewayApiRuntimeEnvironmentSchema = CommonRuntimeEnvironmentSchema.extend({
  apiPort: z.number().int().positive(),
  workflowConfig: z.custom<WorkflowConfig>(),
});

const TelegramBotRuntimeEnvironmentSchema = z.object({
  telegramBotToken: NON_PLACEHOLDER_SECRET_SCHEMA,
  telegramWebhookSecret: NON_PLACEHOLDER_SECRET_SCHEMA,
});

const WorkerRuntimeEnvironmentSchema = CommonRuntimeEnvironmentSchema.extend({
  copilotRuntimePath: REQUIRED_ENV_VALUE_SCHEMA.refine(
    (value) => value.toLowerCase() !== 'replace-me',
    'must be set to a non-placeholder value',
  ),
  workflowConfig: z.custom<WorkflowConfig>(),
});

export type CommonRuntimeEnvironment = z.infer<
  typeof CommonRuntimeEnvironmentSchema
>;
export type GatewayApiRuntimeEnvironment = z.infer<
  typeof GatewayApiRuntimeEnvironmentSchema
>;
export type TelegramBotRuntimeEnvironment = z.infer<
  typeof TelegramBotRuntimeEnvironmentSchema
>;
export type WorkerRuntimeEnvironment = z.infer<
  typeof WorkerRuntimeEnvironmentSchema
>;

export function loadCommonRuntimeEnvironment(
  env: EnvironmentLike = getDefaultEnvironment(),
): CommonRuntimeEnvironment {
  return CommonRuntimeEnvironmentSchema.parse({
    databaseUrl: readRequiredUrlEnv(env, 'DATABASE_URL'),
    redisUrl: readRequiredUrlEnv(env, 'REDIS_URL'),
    storageRoot: readRequiredStringEnv(env, 'STORAGE_ROOT'),
  });
}

export function loadGatewayApiRuntimeEnvironment(
  env: EnvironmentLike = getDefaultEnvironment(),
): GatewayApiRuntimeEnvironment {
  return GatewayApiRuntimeEnvironmentSchema.parse({
    ...loadCommonRuntimeEnvironment(env),
    apiPort: readPositiveIntegerEnv(env, 'API_PORT'),
    workflowConfig: loadWorkflowConfig(env),
  });
}

export function loadTelegramBotRuntimeEnvironment(
  env: EnvironmentLike = getDefaultEnvironment(),
): TelegramBotRuntimeEnvironment {
  return TelegramBotRuntimeEnvironmentSchema.parse({
    telegramBotToken: readRequiredSecretEnv(env, 'TELEGRAM_BOT_TOKEN'),
    telegramWebhookSecret: readRequiredSecretEnv(
      env,
      'TELEGRAM_WEBHOOK_SECRET',
    ),
  });
}

export function loadWorkerRuntimeEnvironment(
  env: EnvironmentLike = getDefaultEnvironment(),
): WorkerRuntimeEnvironment {
  return WorkerRuntimeEnvironmentSchema.parse({
    ...loadCommonRuntimeEnvironment(env),
    copilotRuntimePath: readRequiredStringEnv(env, 'COPILOT_RUNTIME_PATH'),
    workflowConfig: loadWorkflowConfig(env),
  });
}

function readRequiredStringEnv(
  env: EnvironmentLike,
  name: string,
): string {
  return REQUIRED_ENV_VALUE_SCHEMA.parse(env[name]);
}

function readRequiredSecretEnv(
  env: EnvironmentLike,
  name: string,
): string {
  return NON_PLACEHOLDER_SECRET_SCHEMA.parse(env[name]);
}

function readRequiredUrlEnv(env: EnvironmentLike, name: string): string {
  const value = readRequiredStringEnv(env, name);
  return URL_ENV_VALUE_SCHEMA.parse(value);
}

function readPositiveIntegerEnv(
  env: EnvironmentLike,
  name: string,
): number {
  const value = POSITIVE_INTEGER_STRING_SCHEMA.parse(env[name]);
  return Number.parseInt(value, 10);
}

function getDefaultEnvironment(): EnvironmentLike {
  const processLike = (globalThis as { process?: { env?: EnvironmentLike } })
    .process;
  return processLike?.env ?? {};
}
