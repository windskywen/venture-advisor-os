import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('GET /api/cases/:caseId/iterations', () => {
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

  it('returns iteration history with status, Judge decision, and task counts', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases/case-789/iterations`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      caseId: 'case-789',
      iterations: [
        {
          iterationNo: 1,
          status: 'JUDGE_REVIEW',
          judgeDecision: 'REVISE',
          nextTaskCount: 2,
          startedAt: '2026-03-12T08:00:00.000Z',
          completedAt: '2026-03-12T08:30:00.000Z',
        },
        {
          iterationNo: 2,
          status: 'APPROVED_FOR_PRD',
          judgeDecision: 'PASS',
          nextTaskCount: 0,
          startedAt: '2026-03-12T09:00:00.000Z',
          completedAt: '2026-03-12T09:20:00.000Z',
        },
      ],
    });
  });
});

function createDependencies(): GatewayApiAppDependencies {
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
            manualReviewRequired: false,
            createdAt: '2026-03-12T07:50:00.000Z',
            updatedAt: '2026-03-12T09:20:00.000Z',
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
          return [
            {
              iterationId: 'iter-1',
              caseId: 'case-789',
              iterationNo: 1,
              statusAtStart: 'RESEARCHING',
              statusAtEnd: 'JUDGE_REVIEW',
              judgeDecision: 'REVISE',
              agentOutputIds: [],
              judgeTaskIds: [],
              scoreDetailIds: [],
              startedAt: '2026-03-12T08:00:00.000Z',
              completedAt: '2026-03-12T08:30:00.000Z',
            },
            {
              iterationId: 'iter-2',
              caseId: 'case-789',
              iterationNo: 2,
              statusAtStart: 'RESEARCHING',
              statusAtEnd: 'APPROVED_FOR_PRD',
              judgeDecision: 'PASS',
              agentOutputIds: [],
              judgeTaskIds: [],
              scoreDetailIds: [],
              startedAt: '2026-03-12T09:00:00.000Z',
              completedAt: '2026-03-12T09:20:00.000Z',
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
        async listByIterationId(iterationId) {
          if (iterationId === 'iter-1') {
            return [
              {
                taskId: 'task-1',
                caseId: 'case-789',
                iterationId: 'iter-1',
                iterationNo: 1,
                taskType: 'EVIDENCE_REFRESH',
                targetAgent: 'FACT_RESEARCHER',
                description: 'Refresh evidence.',
                blocking: true,
              },
              {
                taskId: 'task-2',
                caseId: 'case-789',
                iterationId: 'iter-1',
                iterationNo: 1,
                taskType: 'MVP_RESCOPING',
                targetAgent: 'OPPORTUNITY_STRATEGIST',
                description: 'Reduce the MVP scope.',
                blocking: true,
              },
            ];
          }

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
    now: () => new Date('2026-03-12T09:30:00.000Z'),
  };
}
