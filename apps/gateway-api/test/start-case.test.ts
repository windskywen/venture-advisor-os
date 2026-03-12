import { afterEach, describe, expect, it } from 'vitest';

import {
  createStructuredLogger,
  type StructuredLogEntry,
} from '@venture-advisor-os/shared-types';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('POST /api/cases/:caseId/start', () => {
  const servers: Array<ReturnType<typeof createGatewayApiHttpServer>> = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            });
          }),
      ),
    );
  });

  it('enqueues the first workflow execution and returns an accepted response', async () => {
    const queuedJobs: Array<Record<string, unknown>> = [];
    const auditLogs: Array<Record<string, unknown>> = [];
    const app = createGatewayApiApp(createDependencies(queuedJobs, auditLogs));
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases/case-123/start`, {
      method: 'POST',
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      caseId: 'case-123',
      accepted: true,
      queuedJobId: 'job-case-start-1',
    });
    expect(queuedJobs).toEqual([
      {
        jobName: 'caseStart',
        data: {
          caseId: 'case-123',
          requestedAt: '2026-03-12T10:12:00.000Z',
        },
      },
    ]);
    expect(auditLogs).toEqual([
      expect.objectContaining({
        caseId: 'case-123',
        action: 'CASE_START_REQUESTED',
        actor: 'user',
        metadata: expect.objectContaining({
          queuedJobId: 'job-case-start-1',
          requestedAt: '2026-03-12T10:12:00.000Z',
        }),
      }),
    ]);
  });

  it('propagates requestId and standard correlation fields into start-case logs', async () => {
    const entries: StructuredLogEntry[] = [];
    const logger = createStructuredLogger({
      now: () => new Date('2026-03-12T10:12:00.000Z'),
      write(_line, entry) {
        entries.push(entry);
      },
    });
    const app = createGatewayApiApp({
      ...createDependencies([], []),
      logger,
    });
    const server = createGatewayApiHttpServer(app, {
      logger,
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases/case-123/start`, {
      method: 'POST',
      headers: {
        'x-request-id': 'req-123',
      },
    });

    expect(response.status).toBe(202);
    expect(entries).toContainEqual({
      timestamp: '2026-03-12T10:12:00.000Z',
      level: 'info',
      event: 'case.start.enqueued',
      message: 'Queued the first workflow execution for a case.',
      context: {
        requestId: 'req-123',
        caseId: 'case-123',
        jobId: 'job-case-start-1',
      },
    });
  });
});

function createDependencies(
  queuedJobs: Array<Record<string, unknown>>,
  auditLogs: Array<Record<string, unknown>>,
): GatewayApiAppDependencies {
  return {
    repositories: {
      cases: {
        async create(caseRecord) {
          return caseRecord;
        },
        async getById(caseId) {
          return {
            caseId,
            topic: 'AI note-taking for consultants',
            preferredBusinessModels: [],
            constraints: [],
            status: 'TOPIC_ACCEPTED',
            currentIteration: 0,
            maxIterations: 3,
            manualReviewRequired: false,
            createdAt: '2026-03-12T10:00:00.000Z',
            updatedAt: '2026-03-12T10:00:00.000Z',
            portfolioEscalationMetadata: {},
          };
        },
        async getNextPendingCase() {
          return null;
        },
        async update(caseRecord) {
          return caseRecord;
        },
      },
      iterations: {
        async listByCaseId() {
          return [];
        },
      },
      agentOutputs: {
        async getLatestByCaseIdAndAgentName() {
          return null;
        },
        async getLatestNormalizedByCaseId() {
          return {};
        },
      },
      judgeTasks: {
        async listByIterationId() {
          return [];
        },
      },
      approvals: {
        async create(approval) {
          return approval;
        },
      },
      auditLogs: {
        async create(auditLog) {
          auditLogs.push(auditLog);
          return auditLog;
        },
      },
    },
    artifactIndex: {
      async listCaseArtifacts() {
        return [];
      },
      async listLatestOutputArtifacts() {
        return [];
      },
    },
    queues: {
      caseStart: {
        async add(jobName, data) {
          queuedJobs.push({
            jobName,
            data,
          });
          return {
            id: 'job-case-start-1',
          };
        },
      },
      prdGeneration: {
        async add() {
          return {
            id: 'unused-prd-job',
          };
        },
      },
      pocGeneration: {
        async add() {
          return {
            id: 'unused-poc-job',
          };
        },
      },
    },
    now: () => new Date('2026-03-12T10:12:00.000Z'),
  };
}
