import { afterEach, describe, expect, it } from 'vitest';

import { loadWorkflowConfig } from '@venture-advisor-os/shared-types';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  createInMemoryGatewayApiIdempotencyStore,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('gateway request protections', () => {
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

  it('rejects unauthorized requests when a shared bearer token is configured', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app, {
      authToken: 'shared-secret',
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'Unauthorized test case',
      }),
    });

    expect(response.status).toBe(401);
  });

  it('propagates request IDs and replays idempotent POST responses for duplicate keys', async () => {
    const createdCases: Array<Record<string, unknown>> = [];
    const app = createGatewayApiApp(createDependencies(createdCases));
    const server = createGatewayApiHttpServer(app, {
      idempotencyStore: createInMemoryGatewayApiIdempotencyStore(),
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const headers = {
      'content-type': 'application/json',
      'x-request-id': 'req-123',
      'idempotency-key': 'idem-abc',
    };
    const body = JSON.stringify({
      topic: 'AI note-taking for consultants',
    });

    const firstResponse = await fetch(
      `${baseUrl}/api/cases`,
      {
        method: 'POST',
        headers,
        body,
      },
    );
    const secondResponse = await fetch(
      `${baseUrl}/api/cases`,
      {
        method: 'POST',
        headers,
        body,
      },
    );

    expect(firstResponse.headers.get('x-request-id')).toBe('req-123');
    expect(secondResponse.headers.get('x-request-id')).toBe('req-123');
    await expect(firstResponse.json()).resolves.toEqual({
      caseId: 'case-idempotent',
      status: 'TOPIC_ACCEPTED',
    });
    await expect(secondResponse.json()).resolves.toEqual({
      caseId: 'case-idempotent',
      status: 'TOPIC_ACCEPTED',
    });
    expect(createdCases).toHaveLength(1);
  });

  it('returns 400 for invalid request payloads', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it('sanitizes trimmed API payload fields before persisting a case', async () => {
    const createdCases: Array<Record<string, unknown>> = [];
    const app = createGatewayApiApp(createDependencies(createdCases));
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        topic: '  AI note-taking for consultants  ',
        region: '  AU  ',
        founderProfile: '  Former operator  ',
        preferredBusinessModels: ['  SaaS  '],
        constraints: ['  Bootstrap first  '],
      }),
    });

    expect(response.status).toBe(201);
    expect(createdCases).toEqual([
      expect.objectContaining({
        topic: 'AI note-taking for consultants',
        region: 'AU',
        founderProfile: 'Former operator',
        preferredBusinessModels: ['SaaS'],
        constraints: ['Bootstrap first'],
      }),
    ]);
  });

  it('caps browsing-autonomy requests to the configured policy ceiling before persisting a case', async () => {
    const createdCases: Array<Record<string, unknown>> = [];
    const app = createGatewayApiApp(
      createDependencies(createdCases, {
        workflowConfig: loadWorkflowConfig({
          BROWSING_AUTONOMY_PROFILE: 'STANDARD',
          BROWSING_ALLOW_ADJACENT_EXPLORATION: 'false',
          BROWSING_ALLOW_COMPETITOR_EXPLORATION: 'true',
          BROWSING_ALLOW_OPEN_ENDED_QUERIES: 'false',
          BROWSING_MAX_SOURCES_PER_QUERY: '5',
          BROWSING_RECENCY_WINDOW_DAYS: '120',
        }),
      }),
    );
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'Autonomy ceiling test',
        researchStyle: 'REGULATORY_RISK',
        browsingAutonomy: {
          profile: 'EXPANDED',
          allowAdjacentExploration: true,
          allowOpenEndedQueries: true,
          maxSources: 12,
          recencyWindowDays: 365,
        },
      }),
    });

    expect(response.status).toBe(201);
    expect(createdCases).toEqual([
      expect.objectContaining({
        researchStyle: 'REGULATORY_RISK',
        browsingAutonomy: {
          profile: 'EXPANDED',
          allowAdjacentExploration: false,
          allowCompetitorExploration: true,
          allowOpenEndedQueries: false,
          maxSources: 5,
          recencyWindowDays: 120,
        },
      }),
    ]);
  });

  it('returns 400 for malformed JSON request bodies', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/cases`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{"topic":',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'INVALID_JSON',
      message: 'Request body must be valid JSON.',
    });
  });

  it('returns 400 for unsafe case identifiers in API path parameters', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(
      `${baseUrl}/api/cases/%2E%2E%2Fsecret/start`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      },
    );

    expect(response.status).toBe(400);
  });
});

function createDependencies(
  createdCases: Array<Record<string, unknown>> = [],
  overrides: Partial<GatewayApiAppDependencies> = {},
): GatewayApiAppDependencies {
  return {
    repositories: {
      cases: {
        async create(caseRecord) {
          createdCases.push(caseRecord);
          return {
            ...caseRecord,
            caseId: 'case-idempotent',
          };
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
    now: () => new Date('2026-03-12T11:30:00.000Z'),
    ...overrides,
  };
}
