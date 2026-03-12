import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('POST /api/cases/:caseId/founder-value', () => {
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

  it('records lightweight founder-value measurements for operator follow-up', async () => {
    const recordedMeasurements: Array<Record<string, unknown>> = [];
    const recordedAuditLogs: Array<Record<string, unknown>> = [];
    const app = createGatewayApiApp(
      createDependencies(recordedMeasurements, recordedAuditLogs),
    );
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases/case-1/founder-value`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        perceivedUsefulnessScore: 4,
        confidenceIncreaseScore: 5,
        manualResearchMinutesSaved: 75,
        notes: 'Helped cut the initial validation pass.',
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      caseId: 'case-1',
      respondentType: 'OPERATOR',
      actor: 'operator',
      perceivedUsefulnessScore: 4,
      confidenceIncreaseScore: 5,
      manualResearchMinutesSaved: 75,
    });
    expect(recordedMeasurements).toHaveLength(1);
    expect(recordedMeasurements[0]).toMatchObject({
      caseId: 'case-1',
      respondentType: 'OPERATOR',
      actor: 'operator',
      perceivedUsefulnessScore: 4,
      confidenceIncreaseScore: 5,
      manualResearchMinutesSaved: 75,
    });
    expect(recordedAuditLogs).toEqual([
      expect.objectContaining({
        caseId: 'case-1',
        action: 'FOUNDER_VALUE_MEASUREMENT_RECORDED',
        actor: 'operator',
      }),
    ]);
  });
});

function createDependencies(
  recordedMeasurements: Array<Record<string, unknown>>,
  recordedAuditLogs: Array<Record<string, unknown>>,
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
            topic: 'AI analyst copilot',
            preferredBusinessModels: ['SaaS'],
            constraints: [],
            status: 'COMPLETED',
            currentIteration: 2,
            maxIterations: 3,
            finalDecision: 'PASS',
            manualReviewRequired: false,
            createdAt: '2026-03-12T10:00:00.000Z',
            updatedAt: '2026-03-12T10:30:00.000Z',
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
          recordedAuditLogs.push(auditLog);
          return auditLog;
        },
      },
      founderValueMeasurements: {
        async create(measurement) {
          recordedMeasurements.push(measurement);
          return measurement;
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
    now: () => new Date('2026-03-12T10:35:00.000Z'),
  };
}
