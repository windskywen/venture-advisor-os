import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('GET /dashboard', () => {
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

  it('renders a web dashboard that combines portfolio, opportunity ranking, and runtime metrics', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app, {
      authToken: 'top-secret',
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/dashboard`, {
      headers: {
        authorization: 'Bearer top-secret',
      },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('<title>Venture Advisor OS Dashboard</title>');
    expect(body).toContain('Portfolio Queue');
    expect(body).toContain('Opportunity Ranking');
    expect(body).toContain('Runtime Metrics');
    expect(body).toContain('AI bookkeeping');
    expect(body).toContain('Schema Success');
  });
});

function createDependencies(): GatewayApiAppDependencies {
  const caseRecord = {
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
  };

  return {
    repositories: {
      cases: {
        async create(caseRecord) {
          return caseRecord;
        },
        async getById(caseId) {
          return caseId === caseRecord.caseId ? caseRecord : null;
        },
        async getNextPendingCase() {
          return null;
        },
        async listAll() {
          return [caseRecord];
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
        return {
          generatedAt: '2026-03-12T11:30:00.000Z',
          productMetrics: {
            generatedAt: '2026-03-12T11:30:00.000Z',
            topicsReachingJudgeCompletion: 12,
            prePrdRejectionRate: 0.4,
            averageIterationsPerCase: 2.3,
            passToPrdCompletionRate: 0.8,
            passToPocCompletionRate: 0.7,
            averageTimeToDecisionMs: 3600000,
            schemaValidationSuccessRate: 0.95,
            manualOverrideCount: 3,
            stagnationDetectedCount: 2,
            stagnationRejectedCount: 1,
            targetedRerunRate: 0.5,
          },
          founderValue: {
            measurementCount: 2,
            averagePerceivedUsefulnessScore: 4.5,
            averageConfidenceIncreaseScore: 4,
            averageManualResearchMinutesSaved: 80,
            latestMeasurementAt: '2026-03-12T10:45:00.000Z',
            byRespondentType: {
              OPERATOR: 1,
              FOUNDER: 1,
            },
          },
        };
      },
      async getOpportunityRankingReport() {
        return {
          generatedAt: '2026-03-12T11:30:00.000Z',
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
    now: () => new Date('2026-03-12T11:30:00.000Z'),
  };
}
