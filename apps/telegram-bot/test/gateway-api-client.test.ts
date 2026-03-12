import { createServer } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import { createTelegramGatewayApiClient } from '../src/index.js';

describe('telegram gateway api client', () => {
  const servers: ReturnType<typeof createServer>[] = [];

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

  it('posts create-case requests to the gateway API with bearer auth', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      observedRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.statusCode = 201;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          caseId: 'case-456',
          status: 'TOPIC_ACCEPTED',
        }),
      );
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const client = createTelegramGatewayApiClient({
      baseUrl,
      authToken: 'shared-secret',
    });

    const response = await client.createCase({
      topic: 'AI compliance tooling for SMBs',
    });

    expect(response).toEqual({
      caseId: 'case-456',
      status: 'TOPIC_ACCEPTED',
    });
    expect(observedRequests).toEqual([
      {
        method: 'POST',
        url: '/api/cases',
        authorization: 'Bearer shared-secret',
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          topic: 'AI compliance tooling for SMBs',
        }),
      },
    ]);
  });

  it('posts start-case requests to the gateway API', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      observedRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.statusCode = 202;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          caseId: 'case-789',
          accepted: true,
          queuedJobId: 'job-case-start-2',
        }),
      );
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const client = createTelegramGatewayApiClient({
      baseUrl,
      authToken: 'shared-secret',
    });

    const response = await client.startCase('case-789');

    expect(response).toEqual({
      caseId: 'case-789',
      accepted: true,
      queuedJobId: 'job-case-start-2',
    });
    expect(observedRequests).toEqual([
      {
        method: 'POST',
        url: '/api/cases/case-789/start',
        authorization: 'Bearer shared-secret',
        contentType: 'application/json; charset=utf-8',
        body: '',
      },
    ]);
  });

  it('requests case status from the gateway API', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      observedRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.statusCode = 200;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          caseId: 'case-321',
          topic: 'AI compliance tooling for SMBs',
          preferredBusinessModels: ['SaaS'],
          constraints: [],
          status: 'TOPIC_ACCEPTED',
          currentIteration: 0,
          maxIterations: 3,
          manualReviewRequired: false,
          hasPrd: false,
          hasPoc: false,
          nextSteps: ['Start the case to enqueue the first A -> B -> C -> J iteration.'],
          createdAt: '2026-03-12T09:00:00.000Z',
          updatedAt: '2026-03-12T09:05:00.000Z',
        }),
      );
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const client = createTelegramGatewayApiClient({
      baseUrl,
      authToken: 'shared-secret',
    });

    const response = await client.getCase('case-321');

    expect(response).toEqual({
      caseId: 'case-321',
      topic: 'AI compliance tooling for SMBs',
      preferredBusinessModels: ['SaaS'],
      constraints: [],
      status: 'TOPIC_ACCEPTED',
      currentIteration: 0,
      maxIterations: 3,
      manualReviewRequired: false,
      hasPrd: false,
      hasPoc: false,
      nextSteps: ['Start the case to enqueue the first A -> B -> C -> J iteration.'],
      createdAt: '2026-03-12T09:00:00.000Z',
      updatedAt: '2026-03-12T09:05:00.000Z',
    });
    expect(observedRequests).toEqual([
      {
        method: 'GET',
        url: '/api/cases/case-321',
        authorization: 'Bearer shared-secret',
        contentType: 'application/json; charset=utf-8',
        body: '',
      },
    ]);
  });

  it('requests case outputs from the gateway API', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      observedRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.statusCode = 200;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          caseId: 'case-321',
          latestNormalizedOutputs: {
            Judge: {
              next_iteration_tasks: [],
            },
          },
          fileRefs: [],
        }),
      );
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const client = createTelegramGatewayApiClient({
      baseUrl,
      authToken: 'shared-secret',
    });

    const response = await client.getCaseOutputs('case-321');

    expect(response).toEqual({
      caseId: 'case-321',
      latestNormalizedOutputs: {
        Judge: {
          next_iteration_tasks: [],
        },
      },
      fileRefs: [],
    });
    expect(observedRequests).toEqual([
      {
        method: 'GET',
        url: '/api/cases/case-321/outputs',
        authorization: 'Bearer shared-secret',
        contentType: 'application/json; charset=utf-8',
        body: '',
      },
    ]);
  });

  it('posts operator approvals to the gateway API', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      observedRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.statusCode = 202;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          caseId: 'case-654',
          accepted: true,
          status: 'APPROVED_FOR_PRD',
        }),
      );
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const client = createTelegramGatewayApiClient({
      baseUrl,
      authToken: 'shared-secret',
    });

    const response = await client.approveCase('case-654', 'FORCE_PASS_TO_PRD');

    expect(response).toEqual({
      caseId: 'case-654',
      accepted: true,
      status: 'APPROVED_FOR_PRD',
    });
    expect(observedRequests).toEqual([
      {
        method: 'POST',
        url: '/api/cases/case-654/approve',
        authorization: 'Bearer shared-secret',
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          action: 'FORCE_PASS_TO_PRD',
        }),
      },
    ]);
  });

  it('posts manual reject commands to the gateway API', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      observedRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.statusCode = 202;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          caseId: 'case-987',
          accepted: true,
          status: 'REJECTED',
        }),
      );
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const client = createTelegramGatewayApiClient({
      baseUrl,
      authToken: 'shared-secret',
    });

    const response = await client.rejectCase('case-987');

    expect(response).toEqual({
      caseId: 'case-987',
      accepted: true,
      status: 'REJECTED',
    });
    expect(observedRequests).toEqual([
      {
        method: 'POST',
        url: '/api/cases/case-987/reject',
        authorization: 'Bearer shared-secret',
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({}),
      },
    ]);
  });

  it('posts PRD generation requests to the gateway API', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      observedRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.statusCode = 202;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          caseId: 'case-222',
          accepted: true,
          status: 'PRD_IN_PROGRESS',
        }),
      );
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const client = createTelegramGatewayApiClient({
      baseUrl,
      authToken: 'shared-secret',
    });

    const response = await client.generatePrd('case-222');

    expect(response).toEqual({
      caseId: 'case-222',
      accepted: true,
      status: 'PRD_IN_PROGRESS',
    });
    expect(observedRequests).toEqual([
      {
        method: 'POST',
        url: '/api/cases/case-222/generate-prd',
        authorization: 'Bearer shared-secret',
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({}),
      },
    ]);
  });

  it('posts POC generation requests to the gateway API', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      observedRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.statusCode = 202;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          caseId: 'case-333',
          accepted: true,
          status: 'POC_IN_PROGRESS',
        }),
      );
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const client = createTelegramGatewayApiClient({
      baseUrl,
      authToken: 'shared-secret',
    });

    const response = await client.generatePoc('case-333');

    expect(response).toEqual({
      caseId: 'case-333',
      accepted: true,
      status: 'POC_IN_PROGRESS',
    });
    expect(observedRequests).toEqual([
      {
        method: 'POST',
        url: '/api/cases/case-333/generate-poc',
        authorization: 'Bearer shared-secret',
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({}),
      },
    ]);
  });

  it('requests the next pending topic from the gateway API', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      observedRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.statusCode = 200;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          case: {
            caseId: 'case-444',
            topic: 'AI bookkeeping for freelancers',
            preferredBusinessModels: ['SaaS'],
            constraints: [],
            status: 'TOPIC_ACCEPTED',
            currentIteration: 0,
            maxIterations: 3,
            manualReviewRequired: false,
            hasPrd: false,
            hasPoc: false,
            nextSteps: [
              'Start the case to enqueue the first A -> B -> C -> J iteration.',
            ],
            createdAt: '2026-03-12T09:00:00.000Z',
            updatedAt: '2026-03-12T09:05:00.000Z',
          },
        }),
      );
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const client = createTelegramGatewayApiClient({
      baseUrl,
      authToken: 'shared-secret',
    });

    const response = await client.getNextTopic();

    expect(response).toEqual({
      case: {
        caseId: 'case-444',
        topic: 'AI bookkeeping for freelancers',
        preferredBusinessModels: ['SaaS'],
        constraints: [],
        status: 'TOPIC_ACCEPTED',
        currentIteration: 0,
        maxIterations: 3,
        manualReviewRequired: false,
        hasPrd: false,
        hasPoc: false,
        nextSteps: [
          'Start the case to enqueue the first A -> B -> C -> J iteration.',
        ],
        createdAt: '2026-03-12T09:00:00.000Z',
        updatedAt: '2026-03-12T09:05:00.000Z',
      },
    });
    expect(observedRequests).toEqual([
      {
        method: 'GET',
        url: '/api/cases/next-topic',
        authorization: 'Bearer shared-secret',
        contentType: 'application/json; charset=utf-8',
        body: '',
      },
    ]);
  });

  it('requests the ranked portfolio queue from the gateway API', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      observedRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.statusCode = 200;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          generatedAt: '2026-03-12T10:30:00.000Z',
          nextTopicCaseId: 'case-444',
          rankedCases: [],
          summary: {
            totalCases: 0,
            nextTopicEligibleCount: 0,
            byPriorityBand: {
              'fresh-actionable': 0,
              'manual-review-failed': 0,
              active: 0,
              completed: 0,
              rejected: 0,
            },
          },
        }),
      );
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const client = createTelegramGatewayApiClient({
      baseUrl,
      authToken: 'shared-secret',
    });

    const response = await client.getPortfolio(3);

    expect(response).toEqual({
      generatedAt: '2026-03-12T10:30:00.000Z',
      nextTopicCaseId: 'case-444',
      rankedCases: [],
      summary: {
        totalCases: 0,
        nextTopicEligibleCount: 0,
        byPriorityBand: {
          'fresh-actionable': 0,
          'manual-review-failed': 0,
          active: 0,
          completed: 0,
          rejected: 0,
        },
      },
    });
    expect(observedRequests).toEqual([
      {
        method: 'GET',
        url: '/api/cases/portfolio?limit=3',
        authorization: 'Bearer shared-secret',
        contentType: 'application/json; charset=utf-8',
        body: '',
      },
    ]);
  });
});
