import {
  renderAgentPrompt,
  type PromptTemplateRegistry,
  type RenderedAgentPrompt,
} from '@venture-advisor-os/agent-specs';
import {
  VcCriticOutputSchema,
  type VcCriticOutput,
} from '@venture-advisor-os/shared-types';

import type {
  AgentRuntimeAdapter,
  AgentRuntimeResponse,
} from './agent-runtime.js';
import { executeWithMalformedOutputRetry } from './malformed-output-retry.js';
import { extractJsonSummary } from './normalization-utils.js';
import { assertOutputConventions } from './output-conventions.js';

export interface VcCriticExecutionInput {
  registry: PromptTemplateRegistry;
  runtime: AgentRuntimeAdapter;
  caseContext: Record<string, unknown> & {
    topic: string;
    market_facts_summary: Record<string, unknown>;
    opportunity_summary: Record<string, unknown>;
  };
  priorOutputs?: Record<string, unknown>;
  stopConditions?: readonly string[];
}

export interface VcCriticExecutionResult {
  renderedPrompt: RenderedAgentPrompt;
  runtimeResponse: AgentRuntimeResponse;
  normalizedOutput: VcCriticOutput;
}

export async function executeVcCritic(
  input: VcCriticExecutionInput,
): Promise<VcCriticExecutionResult> {
  const renderedPrompt = renderAgentPrompt({
    registry: input.registry,
    agentName: 'VCCritic',
    caseContext: input.caseContext,
    priorOutputs: input.priorOutputs,
    stopConditions: input.stopConditions,
  });
  const retryResult = await executeWithMalformedOutputRetry({
    runtime: input.runtime,
    request: {
      agentName: 'VCCritic',
      prompt: renderedPrompt.prompt,
      inputPayload: renderedPrompt.inputPayload,
    },
    normalize(rawOutput) {
      assertOutputConventions({
        registry: input.registry,
        agentName: 'VCCritic',
        rawOutput,
      });
      return normalizeVcCriticOutput(rawOutput);
    },
  });
  if (!retryResult.success) {
    throw new Error(retryResult.validationErrors.join(' '));
  }

  const runtimeResponse = retryResult.response;
  const normalizedOutput = retryResult.normalizedOutput;

  return {
    renderedPrompt,
    runtimeResponse,
    normalizedOutput,
  };
}

export function normalizeVcCriticOutput(
  rawOutput: string | unknown,
): VcCriticOutput {
  const normalizedOutput = VcCriticOutputSchema.parse(
    extractJsonSummary(rawOutput),
  );

  if (normalizedOutput.score_breakdown.length === 0) {
    throw new Error(
      'VCCritic output must include at least one scoring breakdown entry.',
    );
  }

  if (normalizedOutput.recommendation.trim().length === 0) {
    throw new Error('VCCritic output must include a recommendation.');
  }

  return normalizedOutput;
}
