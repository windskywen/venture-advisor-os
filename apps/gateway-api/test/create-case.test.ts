import { afterEach, describe, expect, it } from 'vitest';

import { loadWorkflowConfig } from '@venture-advisor-os/shared-types';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('POST /api/cases', () => {
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

  it('creates a case with TOPIC_ACCEPTED status and the default iteration budget', async () => {
    const createdCases: Array<Record<string, unknown>> = [];
    const auditLogs: Array<Record<string, unknown>> = [];
    const app = createGatewayApiApp(createDependencies(createdCases, auditLogs));
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'AI note-taking for consultants',
        region: 'AU',
        founderProfile: 'Solo technical founder',
        preferredBusinessModels: ['SaaS'],
        constraints: ['Bootstrap-friendly'],
        researchStyle: 'COMPETITOR_INTENSIVE',
        browsingAutonomy: {
          profile: 'EXPANDED',
          allowAdjacentExploration: true,
          allowOpenEndedQueries: true,
          maxSources: 9,
          recencyWindowDays: 365,
        },
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'TOPIC_ACCEPTED',
    });
    expect(createdCases).toHaveLength(1);
    expect(createdCases[0]).toMatchObject({
      topic: 'AI note-taking for consultants',
      region: 'AU',
      founderProfile: 'Solo technical founder',
      preferredBusinessModels: ['SaaS'],
      constraints: ['Bootstrap-friendly'],
      researchStyle: 'COMPETITOR_INTENSIVE',
      browsingAutonomy: {
        profile: 'EXPANDED',
        allowAdjacentExploration: true,
        allowCompetitorExploration: true,
        allowOpenEndedQueries: true,
        maxSources: 9,
        recencyWindowDays: 365,
      },
      status: 'TOPIC_ACCEPTED',
      currentIteration: 0,
      maxIterations: 3,
      manualReviewRequired: false,
    });
    expect(auditLogs).toEqual([
      expect.objectContaining({
        caseId: expect.any(String),
        action: 'CASE_CREATED',
        actor: 'user',
        metadata: expect.objectContaining({
          status: 'TOPIC_ACCEPTED',
          currentIteration: 0,
          maxIterations: 3,
        }),
      }),
    ]);
  });
});

function createDependencies(
  createdCases: Array<Record<string, unknown>>,
  auditLogs: Array<Record<string, unknown>>,
): GatewayApiAppDependencies {
  return {
    repositories: {
      cases: {
        async create(caseRecord) {
          createdCases.push(caseRecord);
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
    now: () => new Date('2026-03-12T10:10:00.000Z'),
    workflowConfig: loadWorkflowConfig({
      DEFAULT_RESEARCH_STYLE: 'BALANCED',
      BROWSING_AUTONOMY_PROFILE: 'STANDARD',
      BROWSING_ALLOW_ADJACENT_EXPLORATION: 'true',
      BROWSING_ALLOW_COMPETITOR_EXPLORATION: 'true',
      BROWSING_ALLOW_OPEN_ENDED_QUERIES: 'true',
      BROWSING_MAX_SOURCES_PER_QUERY: '10',
      BROWSING_RECENCY_WINDOW_DAYS: '365',
    }),
  };
}
