import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('GET /api/cases/:caseId during async execution', () => {
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

  it('returns case status successfully while work is still running', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const researchingResponse = await fetch(`${baseUrl}/api/cases/case-researching`);
    const prdResponse = await fetch(`${baseUrl}/api/cases/case-prd-running`);
    const pocResponse = await fetch(`${baseUrl}/api/cases/case-poc-running`);

    expect(researchingResponse.status).toBe(200);
    const researchingCase = await researchingResponse.json();
    expect(researchingCase).toMatchObject({
      caseId: 'case-researching',
      status: 'RESEARCHING',
      nextSteps: ['Monitor workflow progress or query outputs for more detail.'],
    });
    expect(researchingCase).not.toHaveProperty('latestDecision');

    expect(prdResponse.status).toBe(200);
    await expect(prdResponse.json()).resolves.toMatchObject({
      caseId: 'case-prd-running',
      status: 'PRD_IN_PROGRESS',
      latestDecision: 'PASS',
      nextSteps: ['Wait for PRD generation to complete.'],
    });

    expect(pocResponse.status).toBe(200);
    await expect(pocResponse.json()).resolves.toMatchObject({
      caseId: 'case-poc-running',
      status: 'POC_IN_PROGRESS',
      latestDecision: 'PASS',
      nextSteps: ['Wait for POC generation to complete.'],
    });
  });
});

function createDependencies(): GatewayApiAppDependencies {
  const cases = new Map([
    [
      'case-researching',
      {
        caseId: 'case-researching',
        topic: 'Researching case',
        preferredBusinessModels: [],
        constraints: [],
        status: 'RESEARCHING',
        currentIteration: 1,
        maxIterations: 3,
        manualReviewRequired: false,
        createdAt: '2026-03-12T09:00:00.000Z',
        updatedAt: '2026-03-12T09:10:00.000Z',
        portfolioEscalationMetadata: {},
      },
    ],
    [
      'case-prd-running',
      {
        caseId: 'case-prd-running',
        topic: 'PRD running case',
        preferredBusinessModels: [],
        constraints: [],
        status: 'PRD_IN_PROGRESS',
        currentIteration: 2,
        maxIterations: 3,
        approvedSourceIterationId: 'iter-prd-2',
        approvedSourceIterationNo: 2,
        finalDecision: 'PASS',
        manualReviewRequired: false,
        createdAt: '2026-03-12T09:00:00.000Z',
        updatedAt: '2026-03-12T09:20:00.000Z',
        portfolioEscalationMetadata: {},
      },
    ],
    [
      'case-poc-running',
      {
        caseId: 'case-poc-running',
        topic: 'POC running case',
        preferredBusinessModels: [],
        constraints: [],
        status: 'POC_IN_PROGRESS',
        currentIteration: 2,
        maxIterations: 3,
        approvedSourceIterationId: 'iter-poc-2',
        approvedSourceIterationNo: 2,
        finalDecision: 'PASS',
        manualReviewRequired: false,
        createdAt: '2026-03-12T09:00:00.000Z',
        updatedAt: '2026-03-12T09:30:00.000Z',
        portfolioEscalationMetadata: {},
      },
    ],
  ]);

  return {
    repositories: {
      cases: {
        async create(caseRecord) {
          return caseRecord;
        },
        async getById(caseId) {
          return cases.get(caseId) ?? null;
        },
        async getNextPendingCase() {
          return null;
        },
        async update(caseRecord) {
          cases.set(caseRecord.caseId, caseRecord);
          return caseRecord;
        },
      },
      iterations: {
        async listByCaseId() {
          return [];
        },
      },
      agentOutputs: {
        async getLatestByCaseIdAndAgentName(caseId) {
          if (caseId === 'case-researching') {
            return null;
          }

          return {
            agentOutputId: `judge-${caseId}`,
            caseId,
            iterationId: `iter-${caseId}`,
            iterationNo: 2,
            agentName: 'Judge',
            rawOutput: '{}',
            normalizedOutput: {
              decision: 'PASS',
            },
            validationErrors: [],
            createdAt: '2026-03-12T09:15:00.000Z',
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
      async listCaseArtifacts(caseId) {
        if (caseId === 'case-poc-running') {
          return [
            {
              name: 'prd.md',
              path: 'storage/cases/case-poc-running/prd.md',
              kind: 'prd',
            },
          ];
        }

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
  };
}
