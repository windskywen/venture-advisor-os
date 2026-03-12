import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  createArtifactIndexService,
  createFileStorageAdapter,
  createOperatorMetricsReportService,
  createOpportunityRankingReportService,
  createPersistenceDatabase,
  createPersistenceRepositories,
} from '@venture-advisor-os/persistence';
import {
  loadGatewayApiRuntimeEnvironment,
  type EnvironmentLike,
} from '@venture-advisor-os/shared-types';
import {
  createCopilotSdkModelCatalog,
  createWorkflowQueues,
  type WorkflowQueues,
} from '@venture-advisor-os/workflow-core';
import type { ConnectionOptions } from 'bullmq';

import { createGatewayApiHttpServer } from './adapters/http.js';
import { createGatewayApiApp } from './app/index.js';

const WORKER_HEARTBEAT_FILE_NAME = '.worker-heartbeat.json';
const MAX_WORKER_HEARTBEAT_AGE_MS = 90_000;

const env = loadEnvironment();
const runtime = loadGatewayApiRuntimeEnvironment(env);
const database = createPersistenceDatabase({
  connectionString: runtime.databaseUrl,
});
const repositories = createPersistenceRepositories(database);
const storage = createFileStorageAdapter({
  storageRootDirectory: runtime.storageRoot,
});
const artifactIndex = createArtifactIndexService(storage);
const queues = createWorkflowQueues(createRedisConnection(runtime.redisUrl));
const operatorMetrics = createOperatorMetricsReportService({
  repositories,
  artifactIndex,
});
const opportunityRanking = createOpportunityRankingReportService({
  repositories,
});
const runtimeModelCatalog = createCopilotSdkModelCatalog({
  cliPath: runtime.copilotCliPath,
  githubToken: runtime.githubToken,
  useLoggedInUser: runtime.useLoggedInUser,
  timeoutMs: runtime.workflowConfig.timeoutBudgets.agentRunMs,
  workingDirectory: process.cwd(),
});

await mkdir(resolve(runtime.storageRoot), { recursive: true });

const app = createGatewayApiApp({
  repositories,
  artifactIndex,
  queues,
  workflowConfig: runtime.workflowConfig,
  agentRuntimeMode: runtime.agentRuntimeMode,
  runtimeModelCatalog,
  reporting: {
    getOperatorMetricsReport() {
      return operatorMetrics.collect();
    },
    getOpportunityRankingReport() {
      return opportunityRanking.collect();
    },
  },
});
const server = createGatewayApiHttpServer(app, {
  operational: {
    checks: {
      database: async () => {
        await database.query('SELECT 1');
        return {
          ready: true,
        };
      },
      queue: async () => {
        await assertQueueConnection(queues);
        return {
          ready: true,
        };
      },
      worker: () => readWorkerHealth(runtime.storageRoot),
      storage: async () => {
        await storage.ensureCaseWorkspace('__healthcheck__');
        await storage.deleteCaseWorkspace('__healthcheck__');
        return {
          ready: true,
        };
      },
    },
    collectMetrics() {
      return operatorMetrics.collect().then((report) => ({
        venture_advisor_topics_reaching_judge_completion_total:
          report.productMetrics.topicsReachingJudgeCompletion,
        venture_advisor_pre_prd_rejection_rate:
          report.productMetrics.prePrdRejectionRate,
        venture_advisor_average_iterations_per_case:
          report.productMetrics.averageIterationsPerCase,
        venture_advisor_pass_to_prd_completion_rate:
          report.productMetrics.passToPrdCompletionRate,
        venture_advisor_pass_to_poc_completion_rate:
          report.productMetrics.passToPocCompletionRate,
        venture_advisor_average_time_to_decision_ms:
          report.productMetrics.averageTimeToDecisionMs,
        venture_advisor_schema_validation_success_rate:
          report.productMetrics.schemaValidationSuccessRate,
        venture_advisor_manual_override_count:
          report.productMetrics.manualOverrideCount,
        venture_advisor_stagnation_detected_count:
          report.productMetrics.stagnationDetectedCount,
        venture_advisor_stagnation_rejected_count:
          report.productMetrics.stagnationRejectedCount,
        venture_advisor_targeted_rerun_rate:
          report.productMetrics.targetedRerunRate,
      }));
    },
  },
});

server.listen(runtime.apiPort, () => {
  console.log(
    `Gateway API listening on http://localhost:${runtime.apiPort} using ${runtime.databaseUrl}`,
  );
});

registerSignalHandlers(async () => {
  await Promise.all([
    new Promise<void>((resolveClose, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolveClose();
      });
    }),
    queues.close(),
    runtimeModelCatalog.close(),
    database.close(),
  ]);
});

function createRedisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const databaseIndex =
    url.pathname.length > 1 ? Number.parseInt(url.pathname.slice(1), 10) : 0;

  return {
    host: url.hostname,
    port: Number.parseInt(url.port || '6379', 10),
    db: Number.isNaN(databaseIndex) ? 0 : databaseIndex,
    username: url.username || undefined,
    password: url.password || undefined,
  };
}

async function assertQueueConnection(queues: WorkflowQueues): Promise<void> {
  await queues.caseStart.getJobCounts('waiting');
}

function registerSignalHandlers(cleanup: () => Promise<void>): void {
  let shuttingDown = false;

  const handleSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down Gateway API.`);
    cleanup()
      .then(() => {
        process.exit(0);
      })
      .catch((error) => {
        console.error('Gateway API shutdown failed.', error);
        process.exit(1);
      });
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
}

function readWorkerHealth(storageRoot: string): {
  ready: boolean;
  detail?: string;
} {
  const heartbeatPath = resolve(storageRoot, WORKER_HEARTBEAT_FILE_NAME);
  if (!existsSync(heartbeatPath)) {
    return {
      ready: false,
      detail: 'Worker heartbeat file is missing.',
    };
  }

  try {
    const payload = JSON.parse(readFileSync(heartbeatPath, 'utf8')) as {
      updatedAt?: string;
    };
    if (!payload.updatedAt) {
      return {
        ready: false,
        detail: 'Worker heartbeat file is malformed.',
      };
    }

    const ageMs = Date.now() - new Date(payload.updatedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > MAX_WORKER_HEARTBEAT_AGE_MS) {
      return {
        ready: false,
        detail: 'Worker heartbeat is stale.',
      };
    }

    return {
      ready: true,
    };
  } catch (error) {
    return {
      ready: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function loadEnvironment(): EnvironmentLike {
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
