import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('gateway operational endpoints', () => {
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

  it('returns a healthy readiness payload without requiring API auth', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app, {
      authToken: 'top-secret',
      operational: {
        checks: {
          database: async () => ({ ready: true }),
          queue: async () => ({ ready: true }),
          worker: async () => ({ ready: true }),
          storage: async () => ({ ready: true }),
        },
        now: () => new Date('2026-03-12T10:40:00.000Z'),
      },
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      generatedAt: '2026-03-12T10:40:00.000Z',
      checks: {
        database: {
          ready: true,
        },
        queue: {
          ready: true,
        },
        worker: {
          ready: true,
        },
        storage: {
          ready: true,
        },
      },
    });
  });

  it('returns a degraded readiness payload when any dependency is unavailable', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app, {
      operational: {
        checks: {
          database: async () => ({ ready: true }),
          queue: async () => ({ ready: false, detail: 'Redis unavailable' }),
          worker: async () => ({ ready: true }),
          storage: async () => {
            throw new Error('Storage root is not writable');
          },
        },
        now: () => new Date('2026-03-12T10:41:00.000Z'),
      },
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'degraded',
      generatedAt: '2026-03-12T10:41:00.000Z',
      checks: {
        database: {
          ready: true,
        },
        queue: {
          ready: false,
          detail: 'Redis unavailable',
        },
        worker: {
          ready: true,
        },
        storage: {
          ready: false,
          detail: 'Storage root is not writable',
        },
      },
    });
  });

  it('returns readiness metrics and custom gauges in Prometheus format', async () => {
    const app = createGatewayApiApp(createDependencies());
    const server = createGatewayApiHttpServer(app, {
      operational: {
        checks: {
          database: async () => ({ ready: true }),
          queue: async () => ({ ready: true }),
          worker: async () => ({ ready: false, detail: 'No heartbeat' }),
          storage: async () => ({ ready: true }),
        },
        collectMetrics: async () => ({
          gateway_api_inflight_requests: 2,
        }),
      },
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/metrics`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(body).toContain('gateway_api_ready 0');
    expect(body).toContain(
      'gateway_api_dependency_ready{component="database"} 1',
    );
    expect(body).toContain(
      'gateway_api_dependency_ready{component="worker"} 0',
    );
    expect(body).toContain('gateway_api_inflight_requests 2');
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
  };
}
