import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createGatewayApiApp,
  createGatewayApiHttpServer,
  type GatewayApiAppDependencies,
} from '../src/index.js';

describe('runtime model routes', () => {
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

  it('returns the current runtime model selection', async () => {
    const selection = {
      modelId: 'gpt-5-mini',
      updatedAt: '2026-03-13T00:20:00.000Z',
      updatedBy: 'telegram',
    };
    const app = createGatewayApiApp(
      createDependencies({
        selection,
      }),
    );
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/runtime/model`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      runtimeMode: 'copilot-sdk',
      selection,
      auth: {
        isAuthenticated: true,
        login: 'ivan',
        authType: 'token',
        statusMessage: 'Authenticated.',
      },
      availableModels: [
        {
          id: 'gpt-5-mini',
          name: 'GPT-5 Mini',
          supportsReasoningEffort: true,
          defaultReasoningEffort: 'medium',
        },
      ],
    });
  });

  it('updates the persisted runtime model selection', async () => {
    const persistedSelections: Array<Record<string, unknown>> = [];
    const app = createGatewayApiApp(
      createDependencies({
        selection: null,
        onPersist(selection) {
          persistedSelections.push(selection);
        },
      }),
    );
    const server = createGatewayApiHttpServer(app);
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/api/runtime/model`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        modelId: 'gpt-5-mini',
        updatedBy: 'telegram',
      }),
    });

    expect(response.status).toBe(200);
    expect(persistedSelections).toEqual([
      {
        modelId: 'gpt-5-mini',
        updatedAt: '2026-03-13T00:20:00.000Z',
        updatedBy: 'telegram',
      },
    ]);
    await expect(response.json()).resolves.toMatchObject({
      runtimeMode: 'copilot-sdk',
      selection: {
        modelId: 'gpt-5-mini',
        updatedBy: 'telegram',
      },
    });
  });
});

function createDependencies(input: {
  selection: {
    modelId: string | null;
    updatedAt: string;
    updatedBy: string;
  } | null;
  onPersist?: (selection: {
    modelId: string | null;
    updatedAt: string;
    updatedBy: string;
  }) => void;
}): GatewayApiAppDependencies {
  let selection = input.selection;

  return {
    repositories: {
      runtimeSettings: {
        async getCopilotModelSelection() {
          return selection;
        },
        async setCopilotModelSelection(nextSelection) {
          selection = nextSelection;
          input.onPersist?.(nextSelection);
          return nextSelection;
        },
      },
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
        async listAll() {
          return [];
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
    runtimeModelCatalog: {
      async getAuthStatus() {
        return {
          isAuthenticated: true,
          login: 'ivan',
          authType: 'token',
          statusMessage: 'Authenticated.',
        };
      },
      async listAvailableModels() {
        return [
          {
            id: 'gpt-5-mini',
            name: 'GPT-5 Mini',
            supportsReasoningEffort: true,
            defaultReasoningEffort: 'medium',
          },
        ];
      },
    },
    agentRuntimeMode: 'copilot-sdk',
    now: () => new Date('2026-03-13T00:20:00.000Z'),
  };
}
