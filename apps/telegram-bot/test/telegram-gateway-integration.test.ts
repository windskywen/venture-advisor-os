import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';
import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../../gateway-api/src/index.js';

import {
  createTelegramBotApp,
  createTelegramCommandHandler,
  createTelegramGatewayApiClient,
} from '../src/index.js';

describe('telegram to gateway integration', () => {
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

  it('runs supported Telegram commands against the real gateway HTTP server', async () => {
    const dependencies = createDependencies();
    const gatewayApp = createGatewayApiApp(dependencies);
    const server = createGatewayApiHttpServer(gatewayApp, {
      authToken: 'shared-secret',
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const telegramApp = createTelegramBotApp({
      gatewayApi: createTelegramGatewayApiClient({
        baseUrl,
        authToken: 'shared-secret',
      }),
    });
    const handler = createTelegramCommandHandler(telegramApp);

    const newIdeaResponse = await handler.handle({
      text: '/newidea AI bookkeeping for freelancers',
    });
    const startResponse = await handler.handle({
      text: '/startcase case-start',
    });
    const statusResponse = await handler.handle({
      text: '/status case-status',
    });
    const approveResponse = await handler.handle({
      text: '/approve case-approve force_pass_to_prd',
      isOperator: true,
    });
    const rejectResponse = await handler.handle({
      text: '/reject case-reject',
      isOperator: true,
    });
    const prdResponse = await handler.handle({
      text: '/prd case-prd',
    });
    const pocResponse = await handler.handle({
      text: '/poc case-poc',
    });

    expect(newIdeaResponse.handled).toBe(true);
    expect(newIdeaResponse.text).toContain('AI bookkeeping for freelancers');
    expect(newIdeaResponse.text).toContain('TOPIC_ACCEPTED');
    expect(startResponse).toEqual({
      handled: true,
      text: 'Started case case-start. Workflow queued as job-case-start. Use /status case-start to track progress.',
    });
    expect(statusResponse).toEqual({
      handled: true,
      text: [
        'Case case-status',
        'Status: REVISE_REQUIRED',
        'Judge: REVISE',
        'Tasks: FACT_RESEARCHER:EVIDENCE_REFRESH:Refresh current SMB pricing evidence.',
        'PRD: not ready',
        'POC: not ready',
        'Next: Review Judge feedback and restart the targeted revise workflow.',
      ].join('\n'),
    });
    expect(approveResponse).toEqual({
      handled: true,
      text: 'Override FORCE_PASS_TO_PRD accepted for case case-approve. Status: APPROVED_FOR_PRD. Use /status case-approve to review next steps.',
    });
    expect(rejectResponse).toEqual({
      handled: true,
      text: 'Case case-reject closed with status REJECTED. Use /status case-reject to review closure details.',
    });
    expect(prdResponse).toEqual({
      handled: true,
      text: 'PRD generation requested for case case-prd. Status: PRD_IN_PROGRESS. Use /status case-prd to monitor progress.',
    });
    expect(pocResponse).toEqual({
      handled: true,
      text: 'POC generation requested for case case-poc. Status: POC_IN_PROGRESS. Use /status case-poc to monitor progress.',
    });
  });

  it('returns the fresh actionable next-topic ahead of failed manual-review cases', async () => {
    const dependencies = createDependencies();
    const gatewayApp = createGatewayApiApp(dependencies);
    const server = createGatewayApiHttpServer(gatewayApp, {
      authToken: 'shared-secret',
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const handler = createTelegramCommandHandler(
      createTelegramBotApp({
        gatewayApi: createTelegramGatewayApiClient({
          baseUrl,
          authToken: 'shared-secret',
        }),
      }),
    );

    const response = await handler.handle({
      text: '/next-topic',
    });

    expect(response).toEqual({
      handled: true,
      text: [
        'Next topic case case-fresh',
        'Topic: Fresh topic ready to start',
        'Status: TOPIC_ACCEPTED',
        'Latest decision: PENDING',
        'Next: Start the case to enqueue the first A -> B -> C -> J iteration.',
      ].join('\n'),
    });
  });

  it('returns an explicit empty-state message when no next-topic case is available', async () => {
    const dependencies = createDependencies({
      nextTopicCases: [],
    });
    const gatewayApp = createGatewayApiApp(dependencies);
    const server = createGatewayApiHttpServer(gatewayApp, {
      authToken: 'shared-secret',
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const handler = createTelegramCommandHandler(
      createTelegramBotApp({
        gatewayApi: createTelegramGatewayApiClient({
          baseUrl,
          authToken: 'shared-secret',
        }),
      }),
    );

    const response = await handler.handle({
      text: '/next-topic',
    });

    expect(response).toEqual({
      handled: true,
      text: 'No pending topic is available right now.',
    });
  });

  it('returns /status output while a case is still running asynchronously', async () => {
    const dependencies = createDependencies();
    const gatewayApp = createGatewayApiApp(dependencies);
    const server = createGatewayApiHttpServer(gatewayApp, {
      authToken: 'shared-secret',
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const handler = createTelegramCommandHandler(
      createTelegramBotApp({
        gatewayApi: createTelegramGatewayApiClient({
          baseUrl,
          authToken: 'shared-secret',
        }),
      }),
    );

    const response = await handler.handle({
      text: '/status case-running',
    });

    expect(response).toEqual({
      handled: true,
      text: [
        'Case case-running',
        'Status: RESEARCHING',
        'Judge: PENDING',
        'PRD: not ready',
        'POC: not ready',
        'Next: Monitor workflow progress or query outputs for more detail.',
      ].join('\n'),
    });
  });
});

function createDependencies(options: {
  nextTopicCases?: Array<{
    caseId: string;
    topic: string;
    status: 'TOPIC_ACCEPTED' | 'REVISE_REQUIRED' | 'PIVOT_REQUIRED' | 'FAILED';
    manualReviewRequired?: boolean;
    createdAt: string;
  }>;
} = {}): GatewayApiAppDependencies {
  const cases = new Map(
    [
      [
        'case-start',
        {
          caseId: 'case-start',
          topic: 'Startable case',
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
        'case-running',
        {
          caseId: 'case-running',
          topic: 'Running case',
          preferredBusinessModels: [],
          constraints: [],
          status: 'RESEARCHING',
          currentIteration: 1,
          maxIterations: 3,
          manualReviewRequired: false,
          createdAt: '2026-03-12T08:00:00.000Z',
          updatedAt: '2026-03-12T08:15:00.000Z',
          portfolioEscalationMetadata: {},
        },
      ],
      [
        'case-status',
        {
          caseId: 'case-status',
          topic: 'Status case',
          preferredBusinessModels: ['SaaS'],
          constraints: [],
          status: 'REVISE_REQUIRED',
          currentIteration: 1,
          maxIterations: 3,
          manualReviewRequired: false,
          createdAt: '2026-03-12T08:00:00.000Z',
          updatedAt: '2026-03-12T08:30:00.000Z',
          portfolioEscalationMetadata: {},
        },
      ],
      [
        'case-approve',
        {
          caseId: 'case-approve',
          topic: 'Approval case',
          preferredBusinessModels: [],
          constraints: [],
          status: 'FAILED',
          currentIteration: 2,
          maxIterations: 3,
          manualReviewRequired: true,
          createdAt: '2026-03-12T08:00:00.000Z',
          updatedAt: '2026-03-12T09:00:00.000Z',
          portfolioEscalationMetadata: {},
        },
      ],
      [
        'case-reject',
        {
          caseId: 'case-reject',
          topic: 'Reject case',
          preferredBusinessModels: [],
          constraints: [],
          status: 'FAILED',
          currentIteration: 2,
          maxIterations: 3,
          manualReviewRequired: true,
          createdAt: '2026-03-12T08:00:00.000Z',
          updatedAt: '2026-03-12T09:00:00.000Z',
          portfolioEscalationMetadata: {},
        },
      ],
      [
        'case-prd',
        {
          caseId: 'case-prd',
          topic: 'PRD case',
          preferredBusinessModels: [],
          constraints: [],
          status: 'APPROVED_FOR_PRD',
          currentIteration: 1,
          maxIterations: 3,
          approvedSourceIterationId: 'iter-prd',
          approvedSourceIterationNo: 1,
          finalDecision: 'PASS',
          manualReviewRequired: false,
          createdAt: '2026-03-12T08:00:00.000Z',
          updatedAt: '2026-03-12T09:00:00.000Z',
          portfolioEscalationMetadata: {},
        },
      ],
      [
        'case-poc',
        {
          caseId: 'case-poc',
          topic: 'POC case',
          preferredBusinessModels: [],
          constraints: [],
          status: 'PRD_IN_PROGRESS',
          currentIteration: 1,
          maxIterations: 3,
          approvedSourceIterationId: 'iter-poc',
          approvedSourceIterationNo: 1,
          finalDecision: 'PASS',
          manualReviewRequired: false,
          createdAt: '2026-03-12T08:00:00.000Z',
          updatedAt: '2026-03-12T09:00:00.000Z',
          portfolioEscalationMetadata: {},
        },
      ],
    ] as const,
  );
  const createdCases: Array<Record<string, unknown>> = [];
  const nextTopicCases =
    options.nextTopicCases ??
    [
      {
        caseId: 'case-failed-review',
        topic: 'Failed case awaiting manual review',
        status: 'FAILED' as const,
        manualReviewRequired: true,
        createdAt: '2026-03-12T07:00:00.000Z',
      },
      {
        caseId: 'case-fresh',
        topic: 'Fresh topic ready to start',
        status: 'TOPIC_ACCEPTED' as const,
        createdAt: '2026-03-12T08:00:00.000Z',
      },
    ];

  return {
    repositories: {
      cases: {
        async create(caseRecord) {
          createdCases.push(caseRecord);
          cases.set(caseRecord.caseId, {
            ...caseRecord,
            portfolioEscalationMetadata: {},
          });
          return caseRecord;
        },
        async getById(caseId) {
          return (
            cases.get(caseId) ??
            nextTopicCases
              .map((entry) => ({
                ...entry,
                preferredBusinessModels: [] as string[],
                constraints: [] as string[],
                currentIteration: 0,
                maxIterations: 3,
                manualReviewRequired: entry.manualReviewRequired ?? false,
                createdAt: entry.createdAt,
                updatedAt: entry.createdAt,
                portfolioEscalationMetadata: {},
              }))
              .find((caseRecord) => caseRecord.caseId === caseId) ??
            null
          );
        },
        async getNextPendingCase() {
          const eligibleCases = nextTopicCases
            .map((entry) => ({
              ...entry,
              preferredBusinessModels: [] as string[],
              constraints: [] as string[],
              currentIteration: 0,
              maxIterations: 3,
              manualReviewRequired: entry.manualReviewRequired ?? false,
              createdAt: entry.createdAt,
              updatedAt: entry.createdAt,
              portfolioEscalationMetadata: {},
            }))
            .filter(
              (caseRecord) =>
                caseRecord.status === 'TOPIC_ACCEPTED' ||
                caseRecord.status === 'REVISE_REQUIRED' ||
                caseRecord.status === 'PIVOT_REQUIRED' ||
                (caseRecord.status === 'FAILED' &&
                  caseRecord.manualReviewRequired === true),
            )
            .sort((left, right) => {
              const leftPriority =
                left.status === 'FAILED' && left.manualReviewRequired ? 1 : 0;
              const rightPriority =
                right.status === 'FAILED' && right.manualReviewRequired ? 1 : 0;

              if (leftPriority !== rightPriority) {
                return leftPriority - rightPriority;
              }

              return (
                left.createdAt.localeCompare(right.createdAt) ||
                left.caseId.localeCompare(right.caseId)
              );
            });

          return eligibleCases[0] ?? null;
        },
        async update(caseRecord) {
          cases.set(caseRecord.caseId, caseRecord);
          return caseRecord;
        },
      },
      iterations: {
        async listByCaseId(caseId) {
          if (caseId === 'case-approve' || caseId === 'case-reject') {
            return [
              {
                iterationId: `iter-${caseId}-1`,
                caseId,
                iterationNo: 1,
                statusAtStart: 'RESEARCHING',
                statusAtEnd: 'JUDGE_REVIEW',
                judgeDecision: 'REVISE',
                agentOutputIds: [],
                judgeTaskIds: [],
                scoreDetailIds: [],
                startedAt: '2026-03-12T08:10:00.000Z',
                completedAt: '2026-03-12T08:40:00.000Z',
              },
              {
                iterationId: `iter-${caseId}-2`,
                caseId,
                iterationNo: 2,
                statusAtStart: 'RESEARCHING',
                statusAtEnd: 'FAILED',
                judgeDecision: 'REVISE',
                agentOutputIds: [],
                judgeTaskIds: [],
                scoreDetailIds: [],
                startedAt: '2026-03-12T09:00:00.000Z',
                completedAt: '2026-03-12T09:30:00.000Z',
              },
            ];
          }

          return [];
        },
      },
      agentOutputs: {
        async getLatestByCaseIdAndAgentName(caseId, agentName) {
          if (agentName !== 'Judge') {
            return null;
          }

          if (
            caseId === 'case-prd' ||
            caseId === 'case-poc' ||
            caseId === 'case-status'
          ) {
            return {
              agentOutputId: `judge-${caseId}`,
              caseId,
              iterationId: `iter-${caseId}`,
              iterationNo: 1,
              agentName: 'Judge',
              rawOutput: '{}',
              normalizedOutput: {
                decision: caseId === 'case-status' ? 'REVISE' : 'PASS',
              },
              validationErrors: [],
              createdAt: '2026-03-12T09:00:00.000Z',
            };
          }

          return null;
        },
        async getLatestNormalizedByCaseId(caseId) {
          if (caseId === 'case-status') {
            return {
              Judge: {
                next_iteration_tasks: [
                  {
                    target_agent: 'FACT_RESEARCHER',
                    task_type: 'EVIDENCE_REFRESH',
                    description: 'Refresh current SMB pricing evidence.',
                    blocking: true,
                  },
                ],
              },
            };
          }

          return {};
        },
      },
      judgeTasks: {
        async listByIterationId(iterationId) {
          if (iterationId.includes('case-approve')) {
            return [
              {
                taskId: 'task-approve-1',
                caseId: 'case-approve',
                iterationId,
                iterationNo: 2,
                taskType: 'EVIDENCE_REFRESH',
                targetAgent: 'FACT_RESEARCHER',
                description: 'Refresh evidence.',
                blocking: true,
              },
            ];
          }

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
        if (caseId === 'case-poc') {
          return [
            {
              name: 'prd.md',
              path: 'storage/cases/case-poc/prd.md',
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
            id: 'job-case-start',
          };
        },
      },
      prdGeneration: {
        async add() {
          return {
            id: 'job-prd',
          };
        },
      },
      pocGeneration: {
        async add() {
          return {
            id: 'job-poc',
          };
        },
      },
    },
    now: () => new Date('2026-03-12T10:30:00.000Z'),
  };
}
