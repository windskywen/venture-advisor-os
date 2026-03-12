import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('POST /api/cases/:caseId/generate-prd', () => {
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

  it('queues PRD generation when downstream gating passes', async () => {
    const queuedJobs: Array<Record<string, unknown>> = [];
    const updatedCases: Array<Record<string, unknown>> = [];
    const auditLogs: Array<Record<string, unknown>> = [];
    const app = createGatewayApiApp(
      createDependencies(queuedJobs, updatedCases, auditLogs),
    );
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases/case-prd/generate-prd`, {
      method: 'POST',
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      caseId: 'case-prd',
      accepted: true,
      status: 'PRD_IN_PROGRESS',
      queuedJobId: 'job-prd-1',
    });
    expect(queuedJobs).toEqual([
      {
        jobName: 'prdGeneration',
        data: {
          caseId: 'case-prd',
          approvedIterationNo: 2,
        },
      },
    ]);
    expect(updatedCases).toEqual([
      expect.objectContaining({
        caseId: 'case-prd',
        status: 'PRD_IN_PROGRESS',
      }),
    ]);
    expect(auditLogs).toEqual([
      expect.objectContaining({
        caseId: 'case-prd',
        iterationId: 'iter-2',
        iterationNo: 2,
        action: 'GENERATE_PRD_REQUESTED',
        actor: 'system',
        metadata: expect.objectContaining({
          approvedIterationNo: 2,
          queuedJobId: 'job-prd-1',
        }),
      }),
    ]);
  });

  it('blocks PRD generation before PASS', async () => {
    const auditLogs: Array<Record<string, unknown>> = [];
    const app = createGatewayApiApp(
      createDependencies([], [], auditLogs, {
        latestJudgeDecision: 'REVISE',
      }),
    );
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases/case-prd/generate-prd`, {
      method: 'POST',
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'APP_ERROR',
      message:
        'PRD generation requires latestJudgeDecision=PASS and currentStatus to allow downstream generation. Received decision=REVISE, status=APPROVED_FOR_PRD, hasExistingPrd=false.',
    });
    expect(auditLogs).toEqual([]);
  });
});

function createDependencies(
  queuedJobs: Array<Record<string, unknown>>,
  updatedCases: Array<Record<string, unknown>>,
  auditLogs: Array<Record<string, unknown>>,
  options: {
    latestJudgeDecision?: 'PASS' | 'REVISE';
  } = {},
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
            status: 'APPROVED_FOR_PRD',
            currentIteration: 2,
            maxIterations: 3,
            approvedSourceIterationId: 'iter-2',
            approvedSourceIterationNo: 2,
            finalDecision: 'PASS',
            manualReviewRequired: false,
            createdAt: '2026-03-12T09:00:00.000Z',
            updatedAt: '2026-03-12T10:00:00.000Z',
            portfolioEscalationMetadata: {},
          };
        },
        async getNextPendingCase() {
          return null;
        },
        async update(caseRecord) {
          updatedCases.push(caseRecord);
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
          return {
            agentOutputId: 'judge-out-2',
            caseId: 'case-prd',
            iterationId: 'iter-2',
            iterationNo: 2,
            agentName: 'Judge',
            rawOutput: '{}',
            normalizedOutput: {
              decision: options.latestJudgeDecision ?? 'PASS',
            },
            validationErrors: [],
            createdAt: '2026-03-12T10:00:00.000Z',
          };
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
        async add() {
          return {
            id: 'unused-start-job',
          };
        },
      },
      prdGeneration: {
        async add(jobName, data) {
          queuedJobs.push({
            jobName,
            data,
          });
          return {
            id: 'job-prd-1',
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
    now: () => new Date('2026-03-12T10:45:00.000Z'),
  };
}
