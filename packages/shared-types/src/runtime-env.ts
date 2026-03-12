import { z } from 'zod';

import {
  loadWorkflowConfig,
  type EnvironmentLike,
  type WorkflowConfig,
} from './config.js';
import { AgentRuntimeModeSchema } from './schemas.js';

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

const CopilotRuntimeEnvironmentSchema = z.object({
  agentRuntimeMode: AgentRuntimeModeSchema,
  copilotCliPath: REQUIRED_ENV_VALUE_SCHEMA.optional(),
  githubToken: NON_PLACEHOLDER_SECRET_SCHEMA.optional(),
  useLoggedInUser: z.boolean(),
});

const GatewayApiRuntimeEnvironmentSchema = CommonRuntimeEnvironmentSchema.extend(
  {
    apiPort: z.number().int().positive(),
    workflowConfig: z.custom<WorkflowConfig>(),
  },
).merge(CopilotRuntimeEnvironmentSchema);

const TelegramBotRuntimeEnvironmentSchema = z.object({
  telegramBotToken: NON_PLACEHOLDER_SECRET_SCHEMA,
  telegramWebhookSecret: NON_PLACEHOLDER_SECRET_SCHEMA,
});

const WorkerRuntimeEnvironmentSchema = CommonRuntimeEnvironmentSchema.extend({
  workflowConfig: z.custom<WorkflowConfig>(),
}).merge(CopilotRuntimeEnvironmentSchema);

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
    ...loadCopilotRuntimeEnvironment(env),
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
    ...loadCopilotRuntimeEnvironment(env),
    workflowConfig: loadWorkflowConfig(env),
  });
}

function loadCopilotRuntimeEnvironment(
  env: EnvironmentLike,
): z.infer<typeof CopilotRuntimeEnvironmentSchema> {
  const githubToken = readOptionalSecretEnv(env, 'GITHUB_TOKEN');

  return CopilotRuntimeEnvironmentSchema.parse({
    agentRuntimeMode: readEnumEnv(
      env,
      'COPILOT_RUNTIME_MODE',
      AgentRuntimeModeSchema.options,
      'deterministic-local-runtime',
    ),
    copilotCliPath: readOptionalStringEnv(env, 'COPILOT_CLI_PATH'),
    githubToken,
    useLoggedInUser: readBooleanEnv(
      env,
      'COPILOT_USE_LOGGED_IN_USER',
      githubToken === undefined,
    ),
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

function readOptionalSecretEnv(
  env: EnvironmentLike,
  name: string,
): string | undefined {
  const value = env[name];
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  return NON_PLACEHOLDER_SECRET_SCHEMA.parse(value);
}

function readOptionalStringEnv(
  env: EnvironmentLike,
  name: string,
): string | undefined {
  const value = env[name];
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
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

function readBooleanEnv(
  env: EnvironmentLike,
  name: string,
  defaultValue: boolean,
): boolean {
  const value = readOptionalStringEnv(env, name);
  if (value === undefined) {
    return defaultValue;
  }

  const normalizedValue = value.toLowerCase();
  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  return defaultValue;
}

function readEnumEnv<const Values extends readonly string[]>(
  env: EnvironmentLike,
  name: string,
  supportedValues: Values,
  defaultValue: Values[number],
): Values[number] {
  const value = readOptionalStringEnv(env, name);
  if (value === undefined) {
    return defaultValue;
  }

  return supportedValues.includes(value as Values[number])
    ? (value as Values[number])
    : defaultValue;
}

function getDefaultEnvironment(): EnvironmentLike {
  const processLike = (globalThis as { process?: { env?: EnvironmentLike } })
    .process;
  return processLike?.env ?? {};
}
