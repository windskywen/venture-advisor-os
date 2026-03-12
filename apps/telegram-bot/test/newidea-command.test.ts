import { describe, expect, it } from 'vitest';

import type { TelegramBotGatewayApi } from '../src/index.js';
import {
  createTelegramBotApp,
  createTelegramCommandHandler,
} from '../src/index.js';

describe('/newidea command', () => {
  it('creates a case from the provided topic and returns a start hint', async () => {
    const createCaseRequests: Array<Record<string, unknown>> = [];
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async createCase(request) {
          createCaseRequests.push(request);
          return {
            caseId: 'case-123',
            status: 'TOPIC_ACCEPTED',
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/newidea@ventureadvisorbot AI note-taking for consultants',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Created case case-123 for "AI note-taking for consultants" (TOPIC_ACCEPTED). Use /startcase case-123 to begin.',
    });
    expect(createCaseRequests).toEqual([
      {
        topic: 'AI note-taking for consultants',
      },
    ]);
  });

  it('returns usage guidance when the topic is missing', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/newidea',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Usage: /newidea {topic}',
    });
  });

  it('ignores unsupported commands', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/unknown command',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Unsupported command. Telegram is limited to workflow control commands.',
    });
  });

  it('blocks shell, git, and deploy-style commands in MVP', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/deploy production',
    });

    expect(response).toEqual({
      handled: true,
      text: 'MVP permissions are limited to L0 and L1. Local command, git, and deploy actions are disabled.',
    });
  });
});

describe('/startcase command', () => {
  it('starts a case and returns a status hint', async () => {
    const startedCaseIds: string[] = [];
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async startCase(caseId) {
          startedCaseIds.push(caseId);
          return {
            caseId,
            accepted: true,
            queuedJobId: 'job-case-start-1',
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/startcase case-123',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Started case case-123. Workflow queued as job-case-start-1. Use /status case-123 to track progress.',
    });
    expect(startedCaseIds).toEqual(['case-123']);
  });

  it('returns usage guidance when the case id is missing', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/startcase',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Usage: /startcase {caseId}',
    });
  });

  it('rejects path-like case ids for control-plane safety', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/startcase ../../secret',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Usage: /startcase {caseId}',
    });
  });

});

describe('/status command', () => {
  it('returns current state, latest decision, and next steps', async () => {
    const requestedCaseIds: string[] = [];
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async getCase(caseId) {
          requestedCaseIds.push(caseId);
          return {
            caseId,
            topic: 'AI note-taking for consultants',
            preferredBusinessModels: ['SaaS'],
            constraints: [],
            status: 'APPROVED_FOR_PRD',
            currentIteration: 2,
            maxIterations: 3,
            latestDecision: 'PASS',
            manualReviewRequired: false,
            hasPrd: false,
            hasPoc: false,
            nextSteps: ['Generate the PRD from the approved iteration.'],
            createdAt: '2026-03-12T09:00:00.000Z',
            updatedAt: '2026-03-12T09:30:00.000Z',
          };
        },
        async getCaseOutputs(caseId) {
          return {
            caseId,
            latestNormalizedOutputs: {},
            fileRefs: [],
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/status case-123',
    });

    expect(response).toEqual({
      handled: true,
      text: [
        'Case case-123',
        'Status: APPROVED_FOR_PRD',
        'Judge: PASS',
        'PRD: not ready',
        'POC: not ready',
        'Next: Generate the PRD from the approved iteration.',
      ].join('\n'),
    });
    expect(requestedCaseIds).toEqual(['case-123']);
  });

  it('includes revise tasks and readiness when Judge requests another iteration', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async getCase(caseId) {
          return {
            caseId,
            topic: 'AI note-taking for consultants',
            preferredBusinessModels: ['SaaS'],
            constraints: [],
            status: 'REVISE_REQUIRED',
            currentIteration: 1,
            maxIterations: 3,
            latestDecision: 'REVISE',
            manualReviewRequired: false,
            hasPrd: false,
            hasPoc: false,
            nextSteps: ['Review Judge feedback and restart the targeted revise workflow.'],
            createdAt: '2026-03-12T09:00:00.000Z',
            updatedAt: '2026-03-12T09:15:00.000Z',
          };
        },
        async getCaseOutputs(caseId) {
          return {
            caseId,
            latestNormalizedOutputs: {
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
            },
            fileRefs: [],
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/status case-222',
    });

    expect(response).toEqual({
      handled: true,
      text: [
        'Case case-222',
        'Status: REVISE_REQUIRED',
        'Judge: REVISE',
        'Tasks: FACT_RESEARCHER:EVIDENCE_REFRESH:Refresh current SMB pricing evidence.',
        'PRD: not ready',
        'POC: not ready',
        'Next: Review Judge feedback and restart the targeted revise workflow.',
      ].join('\n'),
    });
  });

  it('includes rejection rationale and downstream readiness flags', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async getCase(caseId) {
          return {
            caseId,
            topic: 'AI note-taking for consultants',
            preferredBusinessModels: ['SaaS'],
            constraints: [],
            status: 'REJECTED',
            currentIteration: 2,
            maxIterations: 3,
            latestDecision: 'REJECT',
            rejectionRationale: 'Evidence stayed too weak after the final iteration.',
            manualReviewRequired: false,
            hasPrd: false,
            hasPoc: false,
            nextSteps: ['Case is closed. Review the rejection rationale and move to the next topic.'],
            createdAt: '2026-03-12T09:00:00.000Z',
            updatedAt: '2026-03-12T09:20:00.000Z',
          };
        },
        async getCaseOutputs(caseId) {
          return {
            caseId,
            latestNormalizedOutputs: {},
            fileRefs: [],
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/status case-333',
    });

    expect(response).toEqual({
      handled: true,
      text: [
        'Case case-333',
        'Status: REJECTED',
        'Judge: REJECT',
        'Rejection: Evidence stayed too weak after the final iteration.',
        'PRD: not ready',
        'POC: not ready',
        'Next: Case is closed. Review the rejection rationale and move to the next topic.',
      ].join('\n'),
    });
  });

  it('returns usage guidance when the case id is missing', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/status',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Usage: /status {caseId}',
    });
  });
});

describe('/approve command', () => {
  it('allows operators to submit override approvals', async () => {
    const approvalRequests: Array<Record<string, unknown>> = [];
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async approveCase(caseId, action) {
          approvalRequests.push({
            caseId,
            action,
          });
          return {
            caseId,
            accepted: true,
            status: 'APPROVED_FOR_PRD',
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/approve case-123 force_pass_to_prd',
      isOperator: true,
    });

    expect(response).toEqual({
      handled: true,
      text: 'Override FORCE_PASS_TO_PRD accepted for case case-123. Status: APPROVED_FOR_PRD. Use /status case-123 to review next steps.',
    });
    expect(approvalRequests).toEqual([
      {
        caseId: 'case-123',
        action: 'FORCE_PASS_TO_PRD',
      },
    ]);
  });

  it('blocks non-operators from override approvals', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/approve case-123 FORCE_PASS_TO_PRD',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Operator access required for /approve.',
    });
  });

  it('returns usage guidance when the action is missing or invalid', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/approve case-123',
      isOperator: true,
    });

    expect(response).toEqual({
      handled: true,
      text: 'Usage: /approve {caseId} {FORCE_REVISE|FORCE_PIVOT|FORCE_PASS_TO_PRD}',
    });
  });
});

describe('/reject command', () => {
  it('allows operators to close a case manually', async () => {
    const rejectionRequests: string[] = [];
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async rejectCase(caseId) {
          rejectionRequests.push(caseId);
          return {
            caseId,
            accepted: true,
            status: 'REJECTED',
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/reject case-321',
      isOperator: true,
    });

    expect(response).toEqual({
      handled: true,
      text: 'Case case-321 closed with status REJECTED. Use /status case-321 to review closure details.',
    });
    expect(rejectionRequests).toEqual(['case-321']);
  });

  it('blocks non-operators from manual closure commands', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/reject case-321',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Operator access required for /reject.',
    });
  });

  it('returns usage guidance when the case id is missing', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/reject',
      isOperator: true,
    });

    expect(response).toEqual({
      handled: true,
      text: 'Usage: /reject {caseId}',
    });
  });
});

describe('/prd command', () => {
  it('requests downstream PRD generation for a case', async () => {
    const prdRequests: string[] = [];
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async generatePrd(caseId) {
          prdRequests.push(caseId);
          return {
            caseId,
            accepted: true,
            status: 'PRD_IN_PROGRESS',
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/prd case-555',
    });

    expect(response).toEqual({
      handled: true,
      text: 'PRD generation requested for case case-555. Status: PRD_IN_PROGRESS. Use /status case-555 to monitor progress.',
    });
    expect(prdRequests).toEqual(['case-555']);
  });

  it('returns usage guidance when the case id is missing', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/prd',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Usage: /prd {caseId}',
    });
  });
});

describe('/poc command', () => {
  it('requests downstream POC generation for a case', async () => {
    const pocRequests: string[] = [];
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async generatePoc(caseId) {
          pocRequests.push(caseId);
          return {
            caseId,
            accepted: true,
            status: 'POC_IN_PROGRESS',
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/poc case-555',
    });

    expect(response).toEqual({
      handled: true,
      text: 'POC generation requested for case case-555. Status: POC_IN_PROGRESS. Use /status case-555 to monitor progress.',
    });
    expect(pocRequests).toEqual(['case-555']);
  });

  it('returns usage guidance when the case id is missing', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub(),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/poc',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Usage: /poc {caseId}',
    });
  });
});

describe('/next-topic command', () => {
  it('returns the selected next pending case summary', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async getNextTopic() {
          return {
            case: {
              caseId: 'case-777',
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
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/next-topic',
    });

    expect(response).toEqual({
      handled: true,
      text: [
        'Next topic case case-777',
        'Topic: AI bookkeeping for freelancers',
        'Status: TOPIC_ACCEPTED',
        'Latest decision: PENDING',
        'Next: Start the case to enqueue the first A -> B -> C -> J iteration.',
      ].join('\n'),
    });
  });

  it('returns an explicit empty-state message when no case is pending', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async getNextTopic() {
          return {
            case: null,
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/next-topic',
    });

    expect(response).toEqual({
      handled: true,
      text: 'No pending topic is available right now.',
    });
  });
});

describe('/portfolio command', () => {
  it('returns the ranked portfolio queue summary', async () => {
    const app = createTelegramBotApp({
      gatewayApi: createGatewayApiStub({
        async getPortfolio() {
          return {
            generatedAt: '2026-03-12T10:30:00.000Z',
            nextTopicCaseId: 'case-fresh',
            rankedCases: [
              {
                rank: 1,
                priorityBand: 'fresh-actionable',
                eligibleForNextTopic: true,
                case: {
                  caseId: 'case-fresh',
                  topic: 'Fresh topic ready to start',
                  preferredBusinessModels: [],
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
                  createdAt: '2026-03-12T08:00:00.000Z',
                  updatedAt: '2026-03-12T08:00:00.000Z',
                },
              },
              {
                rank: 2,
                priorityBand: 'manual-review-failed',
                eligibleForNextTopic: true,
                case: {
                  caseId: 'case-review',
                  topic: 'Manual review follow-up',
                  preferredBusinessModels: [],
                  constraints: [],
                  status: 'FAILED',
                  currentIteration: 2,
                  maxIterations: 3,
                  manualReviewRequired: true,
                  hasPrd: false,
                  hasPoc: false,
                  nextSteps: ['Review Judge feedback and decide on operator action.'],
                  createdAt: '2026-03-12T07:00:00.000Z',
                  updatedAt: '2026-03-12T09:00:00.000Z',
                },
              },
            ],
            summary: {
              totalCases: 2,
              nextTopicEligibleCount: 2,
              byPriorityBand: {
                'fresh-actionable': 1,
                'manual-review-failed': 1,
                active: 0,
                completed: 0,
                rejected: 0,
              },
            },
          };
        },
      }),
    });
    const handler = createTelegramCommandHandler(app);

    const response = await handler.handle({
      text: '/portfolio 2',
    });

    expect(response).toEqual({
      handled: true,
      text: [
        'Portfolio queue (next: case-fresh)',
        '1. case-fresh [fresh-actionable] TOPIC_ACCEPTED - Fresh topic ready to start',
        '2. case-review [manual-review-failed] FAILED - Manual review follow-up',
        'Summary: total=2, next-topic eligible=2',
      ].join('\n'),
    });
  });

  it('returns usage guidance when the limit is invalid', async () => {
    const handler = createTelegramCommandHandler(
      createTelegramBotApp({
        gatewayApi: createGatewayApiStub(),
      }),
    );

    const response = await handler.handle({
      text: '/portfolio nope',
    });

    expect(response).toEqual({
      handled: true,
      text: 'Usage: /portfolio {limit?}',
    });
  });
});

describe('/model command', () => {
  it('returns the current runtime model configuration', async () => {
    const handler = createTelegramCommandHandler(
      createTelegramBotApp({
        gatewayApi: createGatewayApiStub({
          async getRuntimeModel() {
            return {
              runtimeMode: 'copilot-sdk',
              selection: {
                modelId: 'gpt-5-mini',
                updatedAt: '2026-03-13T00:20:00.000Z',
                updatedBy: 'telegram',
              },
              auth: {
                isAuthenticated: true,
                login: 'ivan',
              },
              availableModels: [
                {
                  id: 'gpt-5-mini',
                  name: 'GPT-5 Mini',
                  supportsReasoningEffort: true,
                  defaultReasoningEffort: 'medium',
                },
              ],
            };
          },
        }),
      }),
    );

    const response = await handler.handle({
      text: '/model',
    });

    expect(response).toEqual({
      handled: true,
      text: [
        'Runtime: copilot-sdk',
        'Selected: gpt-5-mini',
        'Auth: ready (ivan)',
        'Models:',
        '- gpt-5-mini (medium)',
        'Use /model {modelId} to switch or /model default to clear.',
      ].join('\n'),
    });
  });

  it('updates the current runtime model configuration', async () => {
    const updatedRequests: Array<Record<string, unknown>> = [];
    const handler = createTelegramCommandHandler(
      createTelegramBotApp({
        gatewayApi: createGatewayApiStub({
          async updateRuntimeModel(request) {
            updatedRequests.push(request);
            return {
              runtimeMode: 'copilot-sdk',
              selection: {
                modelId: 'gpt-5',
                updatedAt: '2026-03-13T00:25:00.000Z',
                updatedBy: 'telegram',
              },
              auth: {
                isAuthenticated: true,
              },
              availableModels: [],
            };
          },
        }),
      }),
    );

    const response = await handler.handle({
      text: '/model gpt-5',
    });

    expect(updatedRequests).toEqual([
      {
        modelId: 'gpt-5',
        updatedBy: 'telegram',
      },
    ]);
    expect(response).toEqual({
      handled: true,
      text: [
        'Runtime: copilot-sdk',
        'Selected: gpt-5',
        'Auth: ready',
        'Models: unavailable',
        'Use /model {modelId} to switch or /model default to clear.',
      ].join('\n'),
    });
  });
});

function createGatewayApiStub(
  overrides: Partial<TelegramBotGatewayApi> = {},
): TelegramBotGatewayApi {
  return {
    async createCase() {
      throw new Error('createCase should not be called in this test');
    },
    async startCase() {
      throw new Error('startCase should not be called in this test');
    },
    async getCase() {
      throw new Error('getCase should not be called in this test');
    },
    async getCaseOutputs() {
      throw new Error('getCaseOutputs should not be called in this test');
    },
    async approveCase() {
      throw new Error('approveCase should not be called in this test');
    },
    async rejectCase() {
      throw new Error('rejectCase should not be called in this test');
    },
    async generatePrd() {
      throw new Error('generatePrd should not be called in this test');
    },
    async generatePoc() {
      throw new Error('generatePoc should not be called in this test');
    },
    async getNextTopic() {
      throw new Error('getNextTopic should not be called in this test');
    },
    async getPortfolio() {
      throw new Error('getPortfolio should not be called in this test');
    },
    async getRuntimeModel() {
      throw new Error('getRuntimeModel should not be called in this test');
    },
    async updateRuntimeModel() {
      throw new Error('updateRuntimeModel should not be called in this test');
    },
    ...overrides,
  };
}
