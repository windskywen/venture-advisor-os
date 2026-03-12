import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('GET /api/cases/portfolio', () => {
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

  it('returns a ranked multi-topic portfolio using fresh-first next-topic ordering', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases/portfolio?limit=4`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      generatedAt: '2026-03-12T10:45:00.000Z',
      nextTopicCaseId: 'case-fresh',
      rankedCases: [
        expect.objectContaining({
          rank: 1,
          priorityBand: 'fresh-actionable',
          eligibleForNextTopic: true,
          case: expect.objectContaining({
            caseId: 'case-fresh',
            status: 'TOPIC_ACCEPTED',
          }),
        }),
        expect.objectContaining({
          rank: 2,
          priorityBand: 'fresh-actionable',
          eligibleForNextTopic: true,
          case: expect.objectContaining({
            caseId: 'case-revise',
            status: 'REVISE_REQUIRED',
            latestDecision: 'REVISE',
          }),
        }),
        expect.objectContaining({
          rank: 3,
          priorityBand: 'manual-review-failed',
          eligibleForNextTopic: true,
          case: expect.objectContaining({
            caseId: 'case-failed',
            status: 'FAILED',
          }),
        }),
        expect.objectContaining({
          rank: 4,
          priorityBand: 'active',
          eligibleForNextTopic: false,
          case: expect.objectContaining({
            caseId: 'case-active',
            status: 'RESEARCHING',
          }),
        }),
      ],
      summary: {
        totalCases: 6,
        nextTopicEligibleCount: 3,
        byPriorityBand: {
          'fresh-actionable': 2,
          'manual-review-failed': 1,
          active: 1,
          completed: 1,
          rejected: 1,
        },
      },
    });
  });
});

function createDependencies(): GatewayApiAppDependencies {
  const cases = new Map([
    [
      'case-fresh',
      {
        caseId: 'case-fresh',
        topic: 'Fresh topic ready to start',
        preferredBusinessModels: [],
        constraints: [],
        status: 'TOPIC_ACCEPTED',
        currentIteration: 0,
        maxIterations: 3,
        manualReviewRequired: false,
        createdAt: '2026-03-12T08:00:00.000Z',
        updatedAt: '2026-03-12T08:00:00.000Z',
        portfolioEscalationMetadata: {},
      },
    ],
    [
      'case-revise',
      {
        caseId: 'case-revise',
        topic: 'Needs one revise pass',
        preferredBusinessModels: [],
        constraints: [],
        status: 'REVISE_REQUIRED',
        currentIteration: 1,
        maxIterations: 3,
        manualReviewRequired: false,
        createdAt: '2026-03-12T08:30:00.000Z',
        updatedAt: '2026-03-12T09:10:00.000Z',
        portfolioEscalationMetadata: {},
      },
    ],
    [
      'case-failed',
      {
        caseId: 'case-failed',
        topic: 'Manual review follow-up',
        preferredBusinessModels: [],
        constraints: [],
        status: 'FAILED',
        currentIteration: 2,
        maxIterations: 3,
        manualReviewRequired: true,
        createdAt: '2026-03-12T07:00:00.000Z',
        updatedAt: '2026-03-12T10:00:00.000Z',
        portfolioEscalationMetadata: {},
      },
    ],
    [
      'case-active',
      {
        caseId: 'case-active',
        topic: 'Currently researching',
        preferredBusinessModels: [],
        constraints: [],
        status: 'RESEARCHING',
        currentIteration: 1,
        maxIterations: 3,
        manualReviewRequired: false,
        createdAt: '2026-03-12T06:00:00.000Z',
        updatedAt: '2026-03-12T10:15:00.000Z',
        portfolioEscalationMetadata: {},
      },
    ],
    [
      'case-completed',
      {
        caseId: 'case-completed',
        topic: 'Completed opportunity',
        preferredBusinessModels: [],
        constraints: [],
        status: 'COMPLETED',
        currentIteration: 2,
        maxIterations: 3,
        finalDecision: 'PASS',
        manualReviewRequired: false,
        createdAt: '2026-03-12T05:00:00.000Z',
        updatedAt: '2026-03-12T10:30:00.000Z',
        portfolioEscalationMetadata: {},
      },
    ],
    [
      'case-rejected',
      {
        caseId: 'case-rejected',
        topic: 'Rejected opportunity',
        preferredBusinessModels: [],
        constraints: [],
        status: 'REJECTED',
        currentIteration: 2,
        maxIterations: 3,
        finalDecision: 'REJECT',
        manualReviewRequired: false,
        rejectionRationale: 'Weak demand signal.',
        rejectionCategory: 'WEAK_MARKET',
        createdAt: '2026-03-12T04:00:00.000Z',
        updatedAt: '2026-03-12T10:40:00.000Z',
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
          return cases.get('case-fresh') ?? null;
        },
        async listAll() {
          return [...cases.values()];
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
          if (caseId === 'case-revise') {
            return {
              agentOutputId: 'judge-case-revise',
              caseId,
              iterationId: 'iter-case-revise-1',
              iterationNo: 1,
              agentName: 'Judge',
              rawOutput: '{}',
              normalizedOutput: {
                decision: 'REVISE',
              },
              validationErrors: [],
              createdAt: '2026-03-12T09:05:00.000Z',
            };
          }

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
    now: () => new Date('2026-03-12T10:45:00.000Z'),
  };
}
