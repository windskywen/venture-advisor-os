import type { AgentName } from '@venture-advisor-os/shared-types';

export interface AgentRuntimeRequest {
  agentName: AgentName;
  prompt: string;
  inputPayload: Record<string, unknown>;
}

export interface AgentRuntimeResponse {
  agentName: AgentName;
  rawOutput: string;
  metadata?: {
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    latencyMs?: number;
    backend?: string;
  };
}

export interface AgentRuntimeAdapter {
  run(request: AgentRuntimeRequest): Promise<AgentRuntimeResponse>;
}

export type MockAgentRuntimeHandler = (
  request: AgentRuntimeRequest,
) => Promise<AgentRuntimeResponse> | AgentRuntimeResponse;

export interface AgentPromptTransport {
  send(request: AgentRuntimeRequest): Promise<AgentRuntimeResponse>;
}

export function createMockAgentRuntimeAdapter(
  handler: MockAgentRuntimeHandler,
): AgentRuntimeAdapter {
  return {
    run(request) {
      return Promise.resolve(handler(request));
    },
  };
}

export function createCodexRuntimeAdapter(
  transport: AgentPromptTransport,
): AgentRuntimeAdapter {
  return {
    run(request) {
      return transport.send(request);
    },
  };
}
