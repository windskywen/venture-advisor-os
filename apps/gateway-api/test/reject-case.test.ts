import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('POST /api/cases/:caseId/reject', () => {
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

  it('force-rejects the case and persists the rejection rationale/category', async () => {
    const updatedCases: Array<Record<string, unknown>> = [];
    const approvals: Array<Record<string, unknown>> = [];
    const auditLogs: Array<Record<string, unknown>> = [];
    const app = createGatewayApiApp(
      createDependencies(updatedCases, approvals, auditLogs),
    );
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases/case-987/reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'The business case is no longer worth pursuing.',
        rejectionCategory: 'WEAK_MARKET',
        portfolioEscalationMetadata: {
          queueHint: 'next-topic',
        },
      }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      caseId: 'case-987',
      accepted: true,
      status: 'REJECTED',
    });
    expect(updatedCases).toEqual([
      expect.objectContaining({
        caseId: 'case-987',
        status: 'REJECTED',
        finalDecision: 'REJECT',
        rejectionRationale: 'The business case is no longer worth pursuing.',
        rejectionCategory: 'WEAK_MARKET',
        portfolioEscalationMetadata: {
          queueHint: 'next-topic',
        },
      }),
    ]);
    expect(approvals).toEqual([
      expect.objectContaining({
        requestedAction: 'FORCE_REJECT',
        status: 'RESOLVED',
        metadata: expect.objectContaining({
          approvalRecordRequired: true,
          riskLevel: 'high',
        }),
      }),
    ]);
    expect(auditLogs).toEqual([
      expect.objectContaining({
        action: 'MANUAL_OVERRIDE_FORCE_REJECT',
        actor: 'operator',
      }),
    ]);
  });

  it('does not apply FORCE_REJECT when the approval record cannot be persisted', async () => {
    const updatedCases: Array<Record<string, unknown>> = [];
    const approvals: Array<Record<string, unknown>> = [];
    const auditLogs: Array<Record<string, unknown>> = [];
    const app = createGatewayApiApp(
      createDependencies(updatedCases, approvals, auditLogs, {
        failApprovalCreate: true,
      }),
    );
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases/case-987/reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'Approval storage is required for force rejection.',
        rejectionCategory: 'WEAK_MARKET',
      }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'INTERNAL_SERVER_ERROR',
    });
    expect(updatedCases).toEqual([]);
    expect(approvals).toEqual([]);
    expect(auditLogs).toEqual([]);
  });
});

function createDependencies(
  updatedCases: Array<Record<string, unknown>>,
  approvals: Array<Record<string, unknown>>,
  auditLogs: Array<Record<string, unknown>>,
  options: {
    failApprovalCreate?: boolean;
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
            status: 'JUDGE_REVIEW',
            currentIteration: 2,
            maxIterations: 3,
            manualReviewRequired: false,
            createdAt: '2026-03-12T08:00:00.000Z',
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
          return [
            {
              iterationId: 'iter-2',
              caseId: 'case-987',
              iterationNo: 2,
              statusAtStart: 'RESEARCHING',
              statusAtEnd: 'JUDGE_REVIEW',
              judgeDecision: 'REVISE',
              agentOutputIds: [],
              judgeTaskIds: [],
              scoreDetailIds: [],
              startedAt: '2026-03-12T09:00:00.000Z',
              completedAt: '2026-03-12T09:30:00.000Z',
            },
          ];
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
          if (options.failApprovalCreate) {
            throw new Error('approval insert failed');
          }

          approvals.push(approval);
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
    now: () => new Date('2026-03-12T10:40:00.000Z'),
  };
}
