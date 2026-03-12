import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('GET /api/reports/opportunities', () => {
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

  it('returns the cross-case opportunity ranking report', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app, {
      authToken: 'top-secret',
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/reports/opportunities`, {
      headers: {
        authorization: 'Bearer top-secret',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      generatedAt: '2026-03-12T11:15:00.000Z',
      rankedCases: [
        {
          caseId: 'case-pass',
          topic: 'AI bookkeeping',
          status: 'COMPLETED',
          latestDecision: 'PASS',
          opportunityScore: 100,
          vcScoreAverage: 8,
          evidenceScoreAverage: 8,
          founderValueScore: 4.5,
          approvedForBuild: true,
          updatedAt: '2026-03-12T10:30:00.000Z',
        },
      ],
      summary: {
        totalCases: 1,
        averageOpportunityScore: 100,
        approvedForBuildCount: 1,
        topOpportunityCaseId: 'case-pass',
        byDecision: {
          PASS: 1,
          REVISE: 0,
          PIVOT: 0,
          REJECT: 0,
          PENDING: 0,
        },
        byStatus: {
          COMPLETED: 1,
        },
      },
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
        async getById() {
          return null;
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
            id: 'unused-case-start-job',
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
    reporting: {
      async getOperatorMetricsReport() {
        throw new Error('unused');
      },
      async getOpportunityRankingReport() {
        return {
          generatedAt: '2026-03-12T11:15:00.000Z',
          rankedCases: [
            {
              caseId: 'case-pass',
              topic: 'AI bookkeeping',
              status: 'COMPLETED',
              latestDecision: 'PASS',
              opportunityScore: 100,
              vcScoreAverage: 8,
              evidenceScoreAverage: 8,
              founderValueScore: 4.5,
              approvedForBuild: true,
              updatedAt: '2026-03-12T10:30:00.000Z',
            },
          ],
          summary: {
            totalCases: 1,
            averageOpportunityScore: 100,
            approvedForBuildCount: 1,
            topOpportunityCaseId: 'case-pass',
            byDecision: {
              PASS: 1,
              REVISE: 0,
              PIVOT: 0,
              REJECT: 0,
              PENDING: 0,
            },
            byStatus: {
              COMPLETED: 1,
            },
          },
        };
      },
    },
  };
}
