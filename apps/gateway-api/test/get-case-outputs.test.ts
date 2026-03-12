import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('GET /api/cases/:caseId/outputs', () => {
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

  it('returns the latest normalized outputs and latest artifact refs', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases/case-321/outputs`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      caseId: 'case-321',
      latestNormalizedOutputs: {
        FactResearcher: {
          market_problem_definition: 'Manual note capture is slow.',
        },
        Judge: {
          decision: 'PASS',
        },
      },
      fileRefs: [
        {
          name: 'market_facts.md',
          path: 'storage/cases/case-321/iterations/2/outputs/market_facts.md',
          kind: 'normalized-output',
        },
        {
          name: 'prd.md',
          path: 'storage/cases/case-321/prd.md',
          kind: 'prd',
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
            createdAt: '2026-03-12T09:00:00.000Z',
            updatedAt: '2026-03-12T10:20:00.000Z',
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
          return {
            FactResearcher: {
              market_problem_definition: 'Manual note capture is slow.',
            },
            Judge: {
              decision: 'PASS',
            },
          };
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
        return [
          {
            name: 'market_facts.md',
            path: 'storage/cases/case-321/iterations/2/outputs/market_facts.md',
            kind: 'normalized-output',
          },
          {
            name: 'prd.md',
            path: 'storage/cases/case-321/prd.md',
            kind: 'prd',
          },
        ];
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
    now: () => new Date('2026-03-12T10:21:00.000Z'),
  };
}
