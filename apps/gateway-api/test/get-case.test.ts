import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('GET /api/cases/:caseId', () => {
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

  it('returns the case summary including latest decision, readiness flags, and manual-review state', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases/case-456`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      caseId: 'case-456',
      topic: 'AI note-taking for consultants',
      region: 'AU',
      founderProfile: 'Solo technical founder',
      preferredBusinessModels: ['SaaS'],
      constraints: ['Bootstrap-friendly'],
      researchStyle: 'MARKET_TIMING',
      browsingAutonomy: {
        profile: 'STANDARD',
        allowAdjacentExploration: false,
        allowCompetitorExploration: true,
        allowOpenEndedQueries: false,
        maxSources: 5,
        recencyWindowDays: 120,
      },
      status: 'APPROVED_FOR_PRD',
      currentIteration: 2,
      maxIterations: 3,
      approvedSourceIterationNo: 2,
      latestDecision: 'PASS',
      finalDecision: 'PASS',
      manualReviewRequired: false,
      hasPrd: true,
      hasPoc: false,
      nextSteps: ['Generate the POC once the PRD is reviewed and ready.'],
      createdAt: '2026-03-12T09:00:00.000Z',
      updatedAt: '2026-03-12T10:15:00.000Z',
      portfolioEscalationMetadata: {},
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
            region: 'AU',
            founderProfile: 'Solo technical founder',
            preferredBusinessModels: ['SaaS'],
            constraints: ['Bootstrap-friendly'],
            researchStyle: 'MARKET_TIMING',
            browsingAutonomy: {
              profile: 'STANDARD',
              allowAdjacentExploration: false,
              allowCompetitorExploration: true,
              allowOpenEndedQueries: false,
              maxSources: 5,
              recencyWindowDays: 120,
            },
            status: 'APPROVED_FOR_PRD',
            currentIteration: 2,
            maxIterations: 3,
            approvedSourceIterationId: 'iter-2',
            approvedSourceIterationNo: 2,
            finalDecision: 'PASS',
            manualReviewRequired: false,
            createdAt: '2026-03-12T09:00:00.000Z',
            updatedAt: '2026-03-12T10:15:00.000Z',
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
          return {
            agentOutputId: 'judge-out-2',
            caseId: 'case-456',
            iterationId: 'iter-2',
            iterationNo: 2,
            agentName: 'Judge',
            rawOutput: '{}',
            normalizedOutput: {
              decision: 'PASS',
            },
            validationErrors: [],
            createdAt: '2026-03-12T10:10:00.000Z',
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
          return auditLog;
        },
      },
    },
    artifactIndex: {
      async listCaseArtifacts() {
        return [
          {
            name: 'prd.md',
            path: 'storage/cases/case-456/prd.md',
            kind: 'prd',
          },
        ];
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
    now: () => new Date('2026-03-12T10:16:00.000Z'),
  };
}
