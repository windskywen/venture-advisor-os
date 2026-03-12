import { CopilotClient } from '@github/copilot-sdk';
import type {
  GetAuthStatusResponse,
  ModelInfo,
} from '@github/copilot-sdk';
import type {
  RuntimeModelAuthStatusDto,
  RuntimeModelOptionDto,
} from '@venture-advisor-os/shared-types';

import type {
  AgentRuntimeAdapter,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from './agent-runtime.js';

const PERMISSION_DENIED_RESULT = {
  kind: 'denied-no-approval-rule-and-could-not-request-from-user',
} as const;

const COPILOT_RUNTIME_SYSTEM_APPEND = [
  'You are running inside Venture Advisor OS.',
  'Do not request shell, filesystem, or network tool access.',
  'Answer directly in plain text following the prompt contract exactly.',
].join(' ');

export interface CopilotSdkRuntimeOptions {
  cliPath?: string;
  githubToken?: string;
  useLoggedInUser?: boolean;
  workingDirectory?: string;
  timeoutMs: number;
  clientName?: string;
}

export interface CopilotModelSelectionStore {
  getSelectedModelId(): Promise<string | null>;
}

export interface ClosableAgentRuntimeAdapter extends AgentRuntimeAdapter {
  close(): Promise<void>;
}

export interface ClosableRuntimeModelCatalog {
  getAuthStatus(): Promise<RuntimeModelAuthStatusDto>;
  listAvailableModels(): Promise<RuntimeModelOptionDto[]>;
  close(): Promise<void>;
}

export function createCopilotSdkAgentRuntimeAdapter(
  options: CopilotSdkRuntimeOptions & {
    selectionStore?: CopilotModelSelectionStore;
  },
): ClosableAgentRuntimeAdapter {
  const clientManager = createCopilotSdkClientManager(options);

  return {
    async run(request: AgentRuntimeRequest): Promise<AgentRuntimeResponse> {
      const selectedModelId =
        (await options.selectionStore?.getSelectedModelId()) ?? null;
      return clientManager.runPrompt({
        request,
        selectedModelId,
      });
    },
    close() {
      return clientManager.close();
    },
  };
}

export function createCopilotSdkModelCatalog(
  options: CopilotSdkRuntimeOptions,
): ClosableRuntimeModelCatalog {
  const clientManager = createCopilotSdkClientManager(options);

  return {
    getAuthStatus() {
      return clientManager.getAuthStatus();
    },
    listAvailableModels() {
      return clientManager.listAvailableModels();
    },
    close() {
      return clientManager.close();
    },
  };
}

function createCopilotSdkClientManager(options: CopilotSdkRuntimeOptions) {
  let client: CopilotClient | undefined;
  let clientPromise: Promise<CopilotClient> | undefined;

  return {
    async runPrompt(input: {
      request: AgentRuntimeRequest;
      selectedModelId: string | null;
    }): Promise<AgentRuntimeResponse> {
      const copilotClient = await getClient();
      const resolvedModelId = input.selectedModelId ?? undefined;
      const startedAt = Date.now();
      const session = await copilotClient.createSession({
        clientName: options.clientName ?? 'venture-advisor-os',
        model: resolvedModelId,
        onPermissionRequest: () => PERMISSION_DENIED_RESULT,
        availableTools: [],
        infiniteSessions: {
          enabled: false,
        },
        systemMessage: {
          mode: 'append',
          content: COPILOT_RUNTIME_SYSTEM_APPEND,
        },
        workingDirectory: options.workingDirectory,
      });

      try {
        const assistantMessage = await session.sendAndWait(
          {
            prompt: input.request.prompt,
            mode: 'immediate',
          },
          options.timeoutMs,
        );
        const content = assistantMessage?.data.content;
        if (typeof content !== 'string' || content.trim().length === 0) {
          throw new Error(
            `Copilot runtime returned no assistant message for ${input.request.agentName}.`,
          );
        }

        return {
          agentName: input.request.agentName,
          rawOutput: content,
          metadata: {
            backend: resolvedModelId
              ? `copilot-sdk:${resolvedModelId}`
              : 'copilot-sdk',
            latencyMs: Date.now() - startedAt,
          },
        };
      } finally {
        await session.disconnect().catch(() => undefined);
      }
    },
    async listAvailableModels(): Promise<RuntimeModelOptionDto[]> {
      try {
        const copilotClient = await getClient();
        const models = await copilotClient.listModels();
        return models.map(mapModelInfoToDto);
      } catch {
        return [];
      }
    },
    async getAuthStatus(): Promise<RuntimeModelAuthStatusDto> {
      try {
        const copilotClient = await getClient();
        return mapAuthStatusToDto(await copilotClient.getAuthStatus());
      } catch (error) {
        return {
          isAuthenticated: false,
          statusMessage: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async close(): Promise<void> {
      if (!client) {
        return;
      }

      const activeClient = client;
      client = undefined;
      clientPromise = undefined;
      const shutdownErrors = await activeClient.stop();
      if (shutdownErrors.length > 0) {
        throw shutdownErrors[0];
      }
    },
  };

  async function getClient(): Promise<CopilotClient> {
    if (client) {
      return client;
    }

    if (!clientPromise) {
      clientPromise = (async () => {
        const createdClient = new CopilotClient({
          cliPath: options.cliPath,
          githubToken: options.githubToken,
          useLoggedInUser: options.useLoggedInUser ?? options.githubToken === undefined,
          logLevel: 'error',
          cwd: options.workingDirectory,
        });
        await createdClient.start();
        client = createdClient;
        return createdClient;
      })().catch((error) => {
        clientPromise = undefined;
        throw error;
      });
    }

    return clientPromise;
  }
}

function mapAuthStatusToDto(
  status: GetAuthStatusResponse,
): RuntimeModelAuthStatusDto {
  return {
    isAuthenticated: status.isAuthenticated,
    authType: status.authType,
    login: status.login,
    statusMessage: status.statusMessage,
  };
}

function mapModelInfoToDto(model: ModelInfo): RuntimeModelOptionDto {
  return {
    id: model.id,
    name: model.name,
    supportsReasoningEffort:
      model.capabilities.supports.reasoningEffort === true,
    defaultReasoningEffort: model.defaultReasoningEffort,
  };
}
