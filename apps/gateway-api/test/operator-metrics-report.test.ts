import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('GET /api/reports/metrics', () => {
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

  it('returns an operator-facing metrics report', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app, {
      authToken: 'top-secret',
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/reports/metrics`, {
      headers: {
        authorization: 'Bearer top-secret',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      generatedAt: '2026-03-12T11:00:00.000Z',
      productMetrics: {
        generatedAt: '2026-03-12T11:00:00.000Z',
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
        return {
          generatedAt: '2026-03-12T11:00:00.000Z',
          productMetrics: {
            generatedAt: '2026-03-12T11:00:00.000Z',
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
    },
  };
}
