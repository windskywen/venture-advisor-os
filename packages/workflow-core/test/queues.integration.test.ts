import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createWorkflowQueueEvents,
  createWorkflowQueues,
  createWorkflowWorkers,
} from '../src/index.js';

const redisUrl = loadEnvironmentValue('REDIS_URL');

const describeIfRedis = redisUrl ? describe : describe.skip;

describeIfRedis('workflow queues integration', () => {
  it('processes a queued case-start job with BullMQ and Redis', async () => {
    const connection = parseRedisConnection(redisUrl!);
    const queues = createWorkflowQueues(connection, {
      removeOnComplete: true,
      removeOnFail: true,
    });
    const events = createWorkflowQueueEvents(connection);
    const processedCaseIds: string[] = [];
    const workers = createWorkflowWorkers(
      connection,
      {
        caseStart: async (job) => {
          processedCaseIds.push(job.data.caseId);
          return {
            caseId: job.data.caseId,
            accepted: true,
          };
        },
        agentRun: async () => ({ ok: true }),
        caseReview: async () => ({ ok: true }),
        reportRender: async () => ({ ok: true }),
        prdGeneration: async () => ({ ok: true }),
        pocGeneration: async () => ({ ok: true }),
      },
      {
        concurrency: 1,
      },
    );

    try {
      await Promise.all([
        queues.caseStart.waitUntilReady(),
        events.caseStart.waitUntilReady(),
        workers.caseStart.waitUntilReady(),
      ]);
      await queues.caseStart.obliterate({ force: true });

      const job = await queues.caseStart.add('caseStart', {
        caseId: 'integration-case-1',
        requestedAt: '2026-03-12T10:00:00.000Z',
      });
      const result = await job.waitUntilFinished(events.caseStart, 10_000);

      expect(result).toEqual({
        caseId: 'integration-case-1',
        accepted: true,
      });
      expect(processedCaseIds).toEqual(['integration-case-1']);
    } finally {
      await queues.caseStart.obliterate({ force: true }).catch(() => undefined);
      await Promise.allSettled([workers.close(), events.close(), queues.close()]);
    }
  });
});

function parseRedisConnection(value: string) {
  const url = new URL(value);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null,
  };
}

function loadEnvironmentValue(name: string): string | undefined {
  const envFilePath = resolve(process.cwd(), '.env');
  const fileEnv = loadDotEnv(envFilePath);
  const value = fileEnv[name] ?? process.env[name];

  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function loadDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  const parsed: Record<string, string> = {};
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

    parsed[line.slice(0, separatorIndex).trim()] = line
      .slice(separatorIndex + 1)
      .trim();
  }

  return parsed;
}
